import type { VerifierAdapter, CheckResult, VerificationRequest, VerificationResult } from "./adapter.js";

export function createVerifierAdapter(
  executeCommand: (machineId: string, cmd: string) => Promise<string>
): VerifierAdapter {
  async function detectPackageManager(projectPath?: string): Promise<string> {
    const cwd = projectPath ? `cd ${projectPath} && ` : "";
    try {
      const lockfile = await executeCommand("any", `${cwd}ls package-lock.json 2>/dev/null`);
      if (lockfile.trim()) return "npm";
    } catch {}
    try {
      const yarn = await executeCommand("any", `${cwd}ls yarn.lock 2>/dev/null`);
      if (yarn.trim()) return "yarn";
    } catch {}
    try {
      const pnpm = await executeCommand("any", `${cwd}ls pnpm-lock.yaml 2>/dev/null`);
      if (pnpm.trim()) return "pnpm";
    } catch {}
    try {
      const bun = await executeCommand("any", `${cwd}ls bun.lockb 2>/dev/null`);
      if (bun.trim()) return "bun";
    } catch {}
    return "npm";
  }

  return {
    async verify(req: VerificationRequest): Promise<VerificationResult> {
      const { machineId, sessionId, stepId, checks, projectPath, filePatterns } = req;
      const checkNames: string[] = checks || ["build", "tests", "diff", "errors", "files"];
      const startTime = Date.now();

      const checkFns: Record<string, () => Promise<CheckResult>> = {
        build: () => this.verifyBuild(machineId, projectPath),
        tests: () => this.verifyTests(machineId, projectPath),
        diff: () => this.verifyDiff(machineId, sessionId),
        errors: () => this.verifyErrors(machineId, sessionId),
        files: () => this.verifyFiles(machineId, filePatterns || []),
      };

      const results = await Promise.allSettled(
        checkNames.map((name) => checkFns[name]?.() ?? Promise.resolve({
          name: name as any,
          passed: false,
          evidence: `Nepoznat check: ${name}`,
        }))
      );

      const checkResults: CheckResult[] = results.map((r, i) => {
        if (r.status === "fulfilled") return r.value;
        return {
          name: checkNames[i] as any,
          passed: false,
          evidence: `Greška: ${r.reason?.message || "unknown"}`,
        };
      });

      return {
        id: `${stepId}-${Date.now()}`,
        stepId,
        machineId,
        sessionId,
        overallPassed: checkResults.every((c) => c.passed),
        checks: checkResults,
        timestamp: new Date().toISOString(),
      };
    },

    async verifyBuild(machineId: string, projectPath?: string): Promise<CheckResult> {
      const start = Date.now();
      const cwd = projectPath ? `cd ${projectPath} && ` : "";

      // Detect package manager first
      let pm = "npm";
      try {
        const lockfile = await executeCommand(machineId, `${cwd}ls package-lock.json 2>/dev/null`);
        if (lockfile.trim()) pm = "npm";
        else {
          const yarn = await executeCommand(machineId, `${cwd}ls yarn.lock 2>/dev/null`);
          if (yarn.trim()) pm = "yarn";
          else {
            const pnpm = await executeCommand(machineId, `${cwd}ls pnpm-lock.yaml 2>/dev/null`);
            if (pnpm.trim()) pm = "pnpm";
            else {
              const bun = await executeCommand(machineId, `${cwd}ls bun.lockb 2>/dev/null`);
              if (bun.trim()) pm = "bun";
            }
          }
        }
      } catch {}

      try {
        const output = await executeCommand(
          machineId,
          `${cwd}${pm} run build 2>&1 | tail -30`
        );
        const failed = /error|failed|ERR!/i.test(output);
        return {
          name: "build",
          passed: !failed,
          evidence: failed ? `Build neuspješan:\n${output.slice(-500)}` : `Build uspješan (${pm})`,
          duration: Date.now() - start,
        };
      } catch (err: any) {
        return {
          name: "build",
          passed: false,
          evidence: `Build greška: ${err.message?.slice(0, 300)}`,
          duration: Date.now() - start,
        };
      }
    },

    async verifyTests(machineId: string, projectPath?: string): Promise<CheckResult> {
      const start = Date.now();
      const cwd = projectPath ? `cd ${projectPath} && ` : "";

      // Detect package manager
      let pm = "npm";
      try {
        const lockfile = await executeCommand(machineId, `${cwd}ls package-lock.json 2>/dev/null`);
        if (lockfile.trim()) pm = "npm";
        else {
          const yarn = await executeCommand(machineId, `${cwd}ls yarn.lock 2>/dev/null`);
          if (yarn.trim()) pm = "yarn";
          else {
            const pnpm = await executeCommand(machineId, `${cwd}ls pnpm-lock.yaml 2>/dev/null`);
            if (pnpm.trim()) pm = "pnpm";
          }
        }
      } catch {}

      try {
        // Check if test script exists
        const pkg = await executeCommand(machineId, `${cwd}cat package.json 2>/dev/null`);
        const hasTest = /"test"\s*:/.test(pkg);

        if (!hasTest) {
          return {
            name: "tests",
            passed: true,
            evidence: "Nema test skripte u package.json — preskačem",
            duration: Date.now() - start,
          };
        }

        const output = await executeCommand(
          machineId,
          `${cwd}${pm} test 2>&1 | tail -40`
        );
        const failed = /fail|error|ERR!/i.test(output) && !/passed/i.test(output);
        return {
          name: "tests",
          passed: !failed,
          evidence: failed ? `Testovi neuspješni:\n${output.slice(-500)}` : `Testovi prolaze (${pm})`,
          duration: Date.now() - start,
        };
      } catch (err: any) {
        return {
          name: "tests",
          passed: false,
          evidence: `Test greška: ${err.message?.slice(0, 300)}`,
          duration: Date.now() - start,
        };
      }
    },

    async verifyDiff(machineId: string, sessionId: string): Promise<CheckResult> {
      const start = Date.now();
      try {
        const output = await executeCommand(
          machineId,
          `git diff --stat HEAD 2>/dev/null || echo "no-git"`
        );

        if (output.includes("no-git") || !output.trim()) {
          return {
            name: "diff",
            passed: false,
            evidence: "Nema git repozitorija ili nema promjena",
            duration: Date.now() - start,
          };
        }

        // Count files changed
        const fileCount = (output.match(/^\s+\d+ file/gm) || []).length;
        const lines = output.trim().split("\n");
        const summary = lines[lines.length - 1] || "";

        return {
          name: "diff",
          passed: true,
          evidence: `Promjene: ${summary || output.slice(0, 300)}`,
          duration: Date.now() - start,
        };
      } catch (err: any) {
        return {
          name: "diff",
          passed: false,
          evidence: `Diff greška: ${err.message?.slice(0, 300)}`,
          duration: Date.now() - start,
        };
      }
    },

    async verifyErrors(machineId: string, sessionId: string): Promise<CheckResult> {
      const start = Date.now();
      try {
        // Check for recent error logs on the VPS
        const output = await executeCommand(
          machineId,
          `journalctl --no-pager -n 20 --since "5 min ago" 2>/dev/null | grep -i "error\|fatal\|panic" | tail -10 || echo ""`
        );

        if (output.trim()) {
          return {
            name: "errors",
            passed: false,
            evidence: `Greške pronađene:\n${output.slice(0, 500)}`,
            duration: Date.now() - start,
          };
        }

        // Also check for node/npm errors
        const nodeErrors = await executeCommand(
          machineId,
          `ls /tmp/straxor-wt-*/node_modules/.cache/ 2>/dev/null | head -5 || echo ""`
        ).catch(() => "");

        return {
          name: "errors",
          passed: true,
          evidence: "Nema kritičnih grešaka u zadnjih 5 min",
          duration: Date.now() - start,
        };
      } catch (err: any) {
        return {
          name: "errors",
          passed: true,
          evidence: "Nije moguće provjeriti greške — preskačem",
          duration: Date.now() - start,
        };
      }
    },

    async verifyFiles(machineId: string, patterns: string[]): Promise<CheckResult> {
      const start = Date.now();

      if (!patterns.length) {
        // Check for recently modified files via git
        try {
          const output = await executeCommand(
            machineId,
            `git diff --name-only HEAD 2>/dev/null || echo ""`
          );
          const files = output.trim().split("\n").filter(Boolean);

          if (!files.length) {
            return {
              name: "files",
              passed: false,
              evidence: "Nema pronađenih datoteka",
              duration: Date.now() - start,
            };
          }

          return {
            name: "files",
            passed: true,
            evidence: `${files.length} datoteka promijenjeno: ${files.slice(0, 5).join(", ")}${files.length > 5 ? ` (+${files.length - 5})` : ""}`,
            duration: Date.now() - start,
          };
        } catch {
          return {
            name: "files",
            passed: false,
            evidence: "Nije moguće pronaći datoteke",
            duration: Date.now() - start,
          };
        }
      }

      // Check specific patterns
      const results: string[] = [];
      let allFound = true;

      for (const pattern of patterns) {
        try {
          const output = await executeCommand(
            machineId,
            `ls ${pattern} 2>/dev/null || echo "MISSING"`
          );
          if (output.includes("MISSING")) {
            allFound = false;
            results.push(`❌ ${pattern} — nije pronađen`);
          } else {
            results.push(`✅ ${pattern}`);
          }
        } catch {
          allFound = false;
          results.push(`❌ ${pattern} — greška pri provjeri`);
        }
      }

      return {
        name: "files",
        passed: allFound,
        evidence: results.join("\n"),
        duration: Date.now() - start,
      };
    },
  };
}
