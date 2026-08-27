import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const nextCli = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const basePath = process.env.GITHUB_PAGES_BASE_PATH ?? '';
const result = spawnSync(process.execPath, [nextCli, 'build'], {
  env: {
    ...process.env,
    GITHUB_PAGES: 'true',
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
