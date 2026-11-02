import { spawn } from "node:child_process";
import setup from "./reading-micro.setup.mjs";
setup();
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "-c", "tests/responsive/reading-micro.vite.config.mjs", "--host", "127.0.0.1", "--port", "8099", "--strictPort", "--configLoader", "native"], { stdio: "inherit", windowsHide: true });
process.on("SIGINT", () => server.kill());
process.on("SIGTERM", () => server.kill());
server.on("exit", (code) => process.exit(code ?? 0));
