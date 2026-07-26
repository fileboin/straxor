import { Client } from "ssh2";
import type { ConnectConfig } from "ssh2";

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
  close: () => void;
}

export function connectSSH(config: SSHConfig): Promise<SSHClient> {
  return new Promise((resolve, reject) => {
    const client = new Client();

    const connectConfig: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      ...(config.password && { password: config.password }),
      ...(config.privateKey && { privateKey: config.privateKey }),
    };

    client.on("ready", () => {
      const exec = (command: string): Promise<{ stdout: string; stderr: string; code: number }> => {
        return new Promise((execResolve, execReject) => {
          client.exec(command, (err, stream) => {
            if (err) {
              execReject(err);
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

            stream.on("close", (code: number) => {
              execResolve({ stdout, stderr, code });
            });
          });
        });
      };

      resolve({
        client,
        exec,
        close: () => client.end(),
      });
    });

    client.on("error", (err) => {
      reject(err);
    });

    client.connect(connectConfig);
  });
}
