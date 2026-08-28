import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const nextCli = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const basePath = process.env.GITHUB_PAGES_BASE_PATH ?? '';
const commitDate = spawnSync('git', ['log', '-1', '--format=%cs'], { encoding: 'utf8' });
const lastUpdated = commitDate.status === 0 && commitDate.stdout.trim()
  ? commitDate.stdout.trim()
  : new Date().toISOString().slice(0, 10);
const result = spawnSync(process.execPath, [nextCli, 'build'], {
  env: {
    ...process.env,
    GITHUB_PAGES: 'true',
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_LAST_UPDATED: lastUpdated,
  },
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
