import { spawn } from "node:child_process";

const child = spawn("expo", ["start"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 0));
