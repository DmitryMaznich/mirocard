import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export default function setup() {
  execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '-c', 'tests/responsive/vite.config.mjs', '--configLoader', 'native'], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)), stdio: 'pipe',
  });
}
