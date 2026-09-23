#!/usr/bin/env node
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const workersDirectory = resolve(__dirname, '..');
const remote = process.argv.includes('--remote');
const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['wrangler', 'd1', 'execute', 'chaos-garden-db', ...(remote ? ['--remote'] : ['--local']), '--file=canonical-cutover.sql'],
  { cwd: workersDirectory, encoding: 'utf8', stdio: 'inherit' },
);
process.exit(result.status ?? 1);
