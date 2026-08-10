import { Client } from "ssh2";
import type { ConnectConfig } from "ssh2";
import type { Duplex } from "stream";

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

export interface SSHClient {
  client: Client;
  exec: (command: string) => Promise<{ stdout: string; stderr: string; code: number }>;
  execStream: (command: string) => Promise<Duplex>;
  close: () => void;
}

const CONNECT_TIMEOUT_MS = 15_000;
const KEEPALIVE_INTERVAL_MS = 10_000;
const KEEPALIVE_COUNT_MAX = 3;

function normalizeSshError(err: Error, config: SSHConfig): Error {
  const message = err.message || "SSH connection failed";

  if (/all configured authentication methods failed/i.test(message)) {
    return new Error(
      config.privateKey
        ? `SSH autentikacija nije uspjela za ${config.username}@${config.host}:${config.port}. Provjeri private key i SSH pristup.`
        : `SSH autentikacija nije uspjela za ${config.username}@${config.host}:${config.port}. Provjeri korisničko ime i lozinku.`
    );
  }

  if (/timed out/i.test(message)) {
    return new Error(`SSH konekcija na ${config.host}:${config.port} je istekla. Provjeri IP, port i firewall.`);
  }

  if (/ECONNREFUSED|Unable to connect/i.test(message)) {
    return new Error(`SSH server nije dostupan na ${config.host}:${config.port}. Provjeri da li SSH servis sluša na toj adresi i portu.`);
  }

  return err;
}

export function connectSSH(config: SSHConfig): Promise<SSHClient> {
  return new Promise((resolve, reject) => {
    if (!config.password && !config.privateKey) {
      reject(new Error("SSH konekcija zahtijeva lozinku ili private key"));
      return;
    }

    const client = new Client();
    let settled = false;

    const connectConfig: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      ...(config.password && { password: config.password, tryKeyboard: true }),
      ...(config.privateKey && { privateKey: config.privateKey }),
      readyTimeout: CONNECT_TIMEOUT_MS,
      keepaliveInterval: KEEPALIVE_INTERVAL_MS,
      keepaliveCountMax: KEEPALIVE_COUNT_MAX,
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimeout);
      try { client.end(); } catch {}
      reject(normalizeSshError(err, config));
    };

    client.on("keyboard-interactive", (_name, _instructions, _instructionsLang, prompts, finish) => {
      if (!config.password) {
        finish([]);
        return;
      }
      finish(prompts.map(() => config.password!));
    });

    client.on("ready", () => {
      if (settled) return;
      settled = true;
      clearTimeout(connectTimeout);

      const exec = (command: string): Promise<{ stdout: string; stderr: string; code: number }> => {
        return new Promise((execResolve, execReject) => {
          let settled = false;
          const cleanup = () => {
            client.removeListener("error", onClientError);
            client.removeListener("close", onClientClose);
          };
          const settleReject = (err: Error) => {
            if (settled) return;
            settled = true;
            cleanup();
            execReject(err);
          };
          const onClientError = (err: Error) => settleReject(err);
          const onClientClose = () => settleReject(new Error("SSH connection closed before command completed"));

          client.on("error", onClientError);
          client.on("close", onClientClose);

          client.exec(command, (err, stream) => {
            if (err) {
              settleReject(err);
              return;
            }

            let stdout = "";
            let stderr = "";

            stream.on("data", (data: Buffer) => {
              stdout += data.toString();
            });

            stream.stderr.on("data", (data: Buffer) => {
              stderr += data.toString();
            });

            stream.on("error", (streamErr: Error) => settleReject(streamErr));

            stream.on("close", (code: number) => {
              if (settled) return;
              settled = true;
              cleanup();
              execResolve({ stdout, stderr, code });
            });
          });
        });
      };

      const execStream = (command: string): Promise<Duplex> => {
        return new Promise((execResolve, execReject) => {
          let settled = false;
          let channel: Duplex | undefined;

          const cleanup = () => {
            client.removeListener("error", onClientError);
            client.removeListener("close", onClientClose);
          };

          const settleReject = (err: Error) => {
            if (settled) return;
            settled = true;
            cleanup();
            execReject(err);
          };

          const onClientError = (err: Error) => {
            if (!settled) {
              settleReject(err);
              return;
            }
            if (channel) channel.destroy(new Error("SSH connection dropped during command"));
          };

          const onClientClose = () => {
            if (!settled) {
              settleReject(new Error("SSH connection closed before command started"));
              return;
            }
            if (channel) channel.destroy();
          };

          client.on("error", onClientError);
          client.on("close", onClientClose);

          client.exec(command, (err, stream) => {
            if (err) {
              settleReject(err);
              return;
            }

            channel = stream;

            stream.on("error", () => {});

            stream.on("close", () => {
              channel = undefined;
              cleanup();
            });

            settled = true;
            execResolve(stream);
          });
        });
      };

      resolve({
        client,
        exec,
        execStream,
        close: () => client.end(),
      });
    });

    client.on("error", fail);

    const connectTimeout = setTimeout(() => {
      fail(new Error(`SSH connection to ${config.host}:${config.port} timed out after ${CONNECT_TIMEOUT_MS / 1000}s`));
    }, CONNECT_TIMEOUT_MS + 5_000);

    client.connect(connectConfig);
  });
}
