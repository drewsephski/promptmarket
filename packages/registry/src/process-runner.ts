import { spawn } from "node:child_process";

export type ProcessResult = {
  code: number;
  stdout: string;
  stderr: string;
  stdoutBuffer: Uint8Array;
};

export interface ProcessRunner {
  run(
    command: string,
    args: readonly string[],
    options?: { cwd?: string },
  ): Promise<ProcessResult>;
}

export function createProcessRunner(): ProcessRunner {
  return {
    run(command, args, options) {
      return new Promise(function execute(resolve, reject) {
        const child = spawn(command, args, {
          cwd: options?.cwd,
          stdio: ["ignore", "pipe", "pipe"],
        });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        child.stdout.on("data", function collectStdout(chunk: Buffer) {
          stdout.push(chunk);
        });
        child.stderr.on("data", function collectStderr(chunk: Buffer) {
          stderr.push(chunk);
        });
        child.on("error", function onError(error: NodeJS.ErrnoException) {
          if (error.code === "ENOENT") {
            resolve({
              code: 127,
              stdout: "",
              stderr: `${command} was not found`,
              stdoutBuffer: new Uint8Array(),
            });
            return;
          }
          reject(error);
        });
        child.on("close", function onClose(code) {
          const out = Buffer.concat(stdout);
          const err = Buffer.concat(stderr);
          resolve({
            code: code ?? 1,
            stdout: out.toString("utf8"),
            stderr: err.toString("utf8"),
            stdoutBuffer: out,
          });
        });
      });
    },
  };
}
