#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const FRONTEND_DIR = path.resolve(__dirname, '..');
const DEFAULT_PAGES_PROJECT_NAME = 'chaos-garden-frontend';

function resolveAstroCliPath() {
  const astroPackagePath = require.resolve('astro/package.json');
  return path.resolve(path.dirname(astroPackagePath), 'astro.js');
}

function resolveWranglerCliPath() {
  return require.resolve('wrangler/bin/wrangler.js');
}

function runNodeCli(cliPath, args, description) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: FRONTEND_DIR,
    env: process.env,
    stdio: 'inherit'
  });

  if (result.error) {
    throw new Error(`${description} failed to start. ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`${description} failed with exit code ${result.status}.`);
  }
}

function getRequiredApiUrl() {
  const apiUrl = process.env.PUBLIC_API_URL?.trim();
  if (!apiUrl) {
    throw new Error(
      'Missing PUBLIC_API_URL. Set it before building the frontend, for example: ' +
      '$env:PUBLIC_API_URL="https://chaos-garden-api.saadmankabir95.workers.dev"'
    );
  }

  return apiUrl;
}

function main() {
  const apiUrl = getRequiredApiUrl();
  const pagesProjectName = process.env.CLOUDFLARE_PAGES_PROJECT_NAME?.trim() || DEFAULT_PAGES_PROJECT_NAME;

  console.log(`Using PUBLIC_API_URL=${apiUrl}`);
  console.log(`Deploying Pages project: ${pagesProjectName}`);

  runNodeCli(resolveAstroCliPath(), ['build'], 'Astro build');
  runNodeCli(resolveWranglerCliPath(), ['pages', 'deploy', 'dist', '--project-name', pagesProjectName], 'Wrangler Pages deploy');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
