import type { PreviewAdapter, PreviewConfig, PreviewStatus, PreviewLog } from "./adapter.js";

const FRAMEWORK_COMMANDS: Record<string, { dev: string; build: string; detect: string }> = {
  vite: {
    dev: "npx vite --host 0.0.0.0 --port",
    build: "npx vite build",
    detect: 'test -f "vite.config.ts" || test -f "vite.config.js" || test -f "vite.config.mjs"',
  },
  next: {
    dev: "npx next dev --port",
    build: "npx next build",
    detect: 'test -f "next.config.js" || test -f "next.config.mjs" || test -f "next.config.ts"',
  },
  nuxt: {
    dev: "npx nuxi dev --port",
    build: "npx nuxi build",
    detect: 'test -f "nuxt.config.ts" || test -f "nuxt.config.js"',
  },
  svelte: {
    dev: "npx vite dev --port",
    build: "npx vite build",
    detect: 'test -f "svelte.config.js" || test -f "svelte.config.ts"',
  },
  react: {
    dev: "npx react-scripts start",
    build: "npx react-scripts build",
    detect: 'grep -q "react-scripts" package.json 2>/dev/null',
  },
  vue: {
    dev: "npx vite --host 0.0.0.0 --port",
    build: "npx vite build",
    detect: 'grep -q "vue" package.json 2>/dev/null',
  },
  flask: {
    dev: "python3 app.py",
    build: "",
    detect: 'test -f "app.py" && grep -q "flask" app.py 2>/dev/null',
  },
  django: {
    dev: "python3 manage.py runserver 0.0.0.0:",
    build: "",
    detect: 'test -f "manage.py"',
  },
  static: {
    dev: "npx serve -l",
    build: "",
    detect: 'test -f "index.html"',
  },
};

const MAX_LOGS = 200;

export function createVPSPreviewAdapter(
  exec: (machineId: string, cmd: string) => Promise<string>,
  execBackground?: (machineId: string, cmd: string) => Promise<string>
): PreviewAdapter {
  // In-memory state per machine
  const states = new Map<string, {
    running: boolean;
    port: number;
    pid: number | null;
    framework: string | null;
    logs: PreviewLog[];
    url: string | null;
  }>();

  function getPort(machineId: string): number {
    // Round-robin from 5173
    const used = Array.from(states.entries())
      .filter(([k]) => k.startsWith(machineId))
      .map(([, v]) => v.port);
    let port = 5173;
    while (used.includes(port)) port++;
    return port;
  }

  function addLog(machineId: string, level: PreviewLog["level"], message: string) {
    const state = states.get(machineId);
    if (!state) return;
    state.logs.push({ timestamp: Date.now(), level, message });
    if (state.logs.length > MAX_LOGS) state.logs.shift();
  }

  return {
    async getFramework(machineId: string, rootPath?: string): Promise<string | null> {
      const root = rootPath || ".";
      for (const [name, fw] of Object.entries(FRAMEWORK_COMMANDS)) {
        try {
          const out = await exec(machineId, `cd "${root}" && ${fw.detect} 2>/dev/null && echo "YES" || echo "NO"`);
          if (out.trim() === "YES") return name;
        } catch { /* continue */ }
      }
      return null;
    },

    async start(config: PreviewConfig): Promise<PreviewStatus> {
      const { machineId, rootPath = ".", port: requestedPort } = config;

      // Stop existing preview on this machine
      const existing = states.get(machineId);
      if (existing?.running) {
        await this.stop(machineId);
      }

      const port = requestedPort || getPort(machineId);
      const framework = config.framework || await this.getFramework(machineId, rootPath) || "static";
      const fw = FRAMEWORK_COMMANDS[framework] || FRAMEWORK_COMMANDS.static;

      const state = {
        running: true,
        port,
        pid: null as number | null,
        framework,
        logs: [] as PreviewLog[],
        url: null as string | null,
      };
      states.set(machineId, state);

      addLog(machineId, "info", `Pokrećem ${framework} preview na portu ${port}…`);

      try {
        // Get the machine's IP or hostname for the URL
        const hostname = await exec(machineId, "hostname -I 2>/dev/null | awk '{print $1}' || echo localhost").catch(() => "localhost");

        const devCmd = config.devCommand || `${fw.dev} ${port}`;
        const fullCmd = `cd "${rootPath}" && nohup ${devCmd} > /tmp/straxor-preview.log 2>&1 & echo $!`;

        const pidStr = await exec(machineId, fullCmd);
        state.pid = parseInt(pidStr.trim(), 10) || null;

        // Wait a moment for server to start
        await new Promise((r) => setTimeout(r, 2000));

        // Check if still running
        if (state.pid) {
          const alive = await exec(machineId, `kill -0 ${state.pid} 2>/dev/null && echo "YES" || echo "NO"`);
          if (alive.trim() === "YES") {
            state.url = `http://${hostname.trim()}:${port}`;
            addLog(machineId, "info", `Preview pokrenut: ${state.url}`);
          } else {
            state.running = false;
            addLog(machineId, "error", "Preview proces nije preživio pokretanje");

            // Grab startup logs
            try {
              const logs = await exec(machineId, `tail -20 /tmp/straxor-preview.log 2>/dev/null`);
              logs.trim().split("\n").forEach((line) => addLog(machineId, "stderr", line));
            } catch { /* ok */ }
          }
        }
      } catch (err: any) {
        state.running = false;
        addLog(machineId, "error", `Greška: ${err.message}`);
      }

      return {
        running: state.running,
        url: state.url,
        internalUrl: `http://localhost:${port}`,
        target: "vps",
        port,
        pid: state.pid,
        uptime: state.running ? Date.now() : null,
        framework,
        error: state.running ? null : "Preview nije uspio",
      };
    },

    async stop(machineId: string): Promise<void> {
      const state = states.get(machineId);
      if (!state) return;

      if (state.pid) {
        try {
          await exec(machineId, `kill ${state.pid} 2>/dev/null; pkill -f "vite" 2>/dev/null; pkill -f "next" 2>/dev/null`);
        } catch { /* ok */ }
      }

      state.running = false;
      state.pid = null;
      state.url = null;
      addLog(machineId, "info", "Preview zaustavljen");
    },

    async getStatus(machineId: string): Promise<PreviewStatus> {
      const state = states.get(machineId);
      if (!state || !state.running) {
        return {
          running: false,
          url: null,
          internalUrl: null,
          target: "vps",
          port: 0,
          pid: null,
          uptime: null,
          framework: null,
          error: null,
        };
      }

      // Verify still alive
      if (state.pid) {
        try {
          const alive = await exec(machineId, `kill -0 ${state.pid} 2>/dev/null && echo "YES" || echo "NO"`);
          if (alive.trim() !== "YES") {
            state.running = false;
            state.pid = null;
            addLog(machineId, "warn", "Preview proces više ne postoji");
          }
        } catch {
          // Assume still running if we can't check
        }
      }

      return {
        running: state.running,
        url: state.url,
        internalUrl: `http://localhost:${state.port}`,
        target: "vps",
        port: state.port,
        pid: state.pid,
        uptime: state.running ? Date.now() : null,
        framework: state.framework,
        error: state.running ? null : "Preview je prestao",
      };
    },

    async getLogs(machineId: string, limit?: number): Promise<PreviewLog[]> {
      const state = states.get(machineId);
      if (!state) return [];
      const logs = limit ? state.logs.slice(-limit) : state.logs;

      // Also grab fresh logs from the dev server
      if (state.running) {
        try {
          const fresh = await exec(machineId, `tail -10 /tmp/straxor-preview.log 2>/dev/null`);
          fresh.trim().split("\n").filter(Boolean).forEach((line) => {
            const already = logs.some((l) => l.message === line);
            if (!already) {
              logs.push({ timestamp: Date.now(), level: "stdout", message: line });
            }
          });
        } catch { /* ok */ }
      }

      return logs;
    },
  };
}
