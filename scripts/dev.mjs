/**
 * `npm run dev` — the whole platform, from one terminal.
 *
 *   API        http://localhost:4000       Express + Mongo
 *   Dashboard  http://localhost:5173       the super-admin console
 *   Mobile     http://localhost:8081       Expo, with the QR code for a phone
 *
 * Three processes, one prefixed stream of output, one Ctrl-C to stop them all.
 * Written by hand rather than pulling in `concurrently` because the useful part
 * is not the parallelism — it is the ordering, the banner and the shutdown, none
 * of which a generic runner does the way this repo needs.
 *
 * **The API starts first and the others wait for it.** Expo and the dashboard
 * both make requests within a second of booting, and against a server that is
 * still connecting to Mongo those come back as connection-refused — which
 * surfaces as an empty dashboard and a "Network request failed" toast on the
 * phone, sending whoever is running it hunting for a bug that is really a race.
 *
 * Flags:
 *   --no-mobile     skip Expo (its Metro bundler is the slow, loud one)
 *   --no-admin      skip the dashboard
 *   --no-open       don't open a browser
 *   --tunnel        Expo over a tunnel, for a phone not on this Wi-Fi
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = new Set(process.argv.slice(2));
const withMobile = !args.has('--no-mobile');
const withAdmin = !args.has('--no-admin');
const openBrowser = !args.has('--no-open');
const tunnel = args.has('--tunnel');

const API_URL = 'http://localhost:4000';
const ADMIN_URL = 'http://localhost:5173';
const EXPO_URL = 'http://localhost:8081';

// ─── Output ─────────────────────────────────────────────────────────────────

const COLOURS = {
  api: '\x1b[36m',
  admin: '\x1b[35m',
  mobile: '\x1b[33m',
  dim: '\x1b[2m',
  off: '\x1b[0m',
};
/** Nothing is coloured when the output is being piped or captured. */
const tty = process.stdout.isTTY;
const paint = (colour, text) => (tty ? `${COLOURS[colour]}${text}${COLOURS.off}` : text);

function prefixed(name, stream) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    // Keep the trailing partial line for the next chunk, so a progress bar or a
    // half-written line is never split across two prefixes.
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) process.stdout.write(`${paint(name, `[${name}]`)} ${line}\n`);
    }
  });
}

// ─── Processes ──────────────────────────────────────────────────────────────

const children = [];

function start(name, command, extraArgs, env = {}) {
  const child = spawn(command, extraArgs, {
    cwd: ROOT,
    env: { ...process.env, ...env, FORCE_COLOR: tty ? '1' : '0' },
    // Piped rather than inherited so every line can be prefixed. The cost is
    // that Expo's interactive key commands (`r`, `j`) do not reach it — press
    // them in a separate `npm run dev:mobile` when you need them.
    stdio: ['ignore', 'pipe', 'pipe'],
    // npm on Windows is a .cmd, which cannot be exec'd without a shell.
    shell: process.platform === 'win32',
  });

  prefixed(name, child.stdout);
  prefixed(name, child.stderr);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    // One process dying alone leaves a half-running stack that looks fine in
    // the terminal and fails in the browser. Take the whole thing down.
    console.log(paint('dim', `\n[dev] ${name} exited (${signal ?? code}). Stopping everything.`));
    shutdown(code ?? 1);
  });

  children.push({ name, child });
  return child;
}

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const { child } of children) {
    if (child.exitCode !== null) continue;
    if (process.platform === 'win32') {
      // Metro and tsx watch spawn their own children; SIGTERM on Windows leaves
      // those orphaned and holding the ports, so kill the tree by pid.
      spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }

  // Give them a moment to go quietly before the process leaves.
  setTimeout(() => process.exit(code), 600).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// ─── Waiting for the API ────────────────────────────────────────────────────

/**
 * Poll `/api/health` until it answers.
 *
 * The health route is the honest signal: it is registered after the database
 * connects, so a reply means the API can actually serve a request rather than
 * merely that something is bound to the port.
 */
async function waitForApi(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (shuttingDown) return false;
    try {
      const response = await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return true;
    } catch {
      // Not up yet. Expected for the first few seconds.
    }
    await sleep(500);
  }
  return false;
}

function open(url) {
  const [command, commandArgs] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  spawn(command, commandArgs, { stdio: 'ignore', detached: true }).unref();
}

// ─── Go ─────────────────────────────────────────────────────────────────────

console.log(paint('dim', '[dev] starting the API…'));
start('api', 'npm', ['run', 'dev', '--workspace', '@m-ensemble/server']);

const ready = await waitForApi();

if (!ready && !shuttingDown) {
  console.log(
    paint(
      'dim',
      '[dev] the API has not answered on /api/health after 60s — check MONGODB_URI in apps/server/.env.\n' +
        '[dev] starting the rest anyway; they will work once it comes up.',
    ),
  );
}

if (withAdmin) start('admin', 'npm', ['run', 'dev', '--workspace', '@m-ensemble/admin']);

if (withMobile) {
  start(
    'mobile',
    'npm',
    ['run', 'start', '--workspace', '@m-ensemble/mobile', '--', ...(tunnel ? ['--tunnel'] : [])],
    // The app ships on mocks by default; running it from here means running it
    // against the API that just started, which is the whole point of one
    // command. An explicit value in apps/mobile/.env still wins — this only
    // fills in a default for the processes started here.
    { EXPO_PUBLIC_USE_MOCKS: process.env.EXPO_PUBLIC_USE_MOCKS ?? 'false' },
  );
}

if (!shuttingDown) {
  const banner = [
    '',
    paint('dim', '  ─────────────────────────────────────────────'),
    `  ${paint('api', 'API')}        ${API_URL}`,
    withAdmin ? `  ${paint('admin', 'Dashboard')}  ${ADMIN_URL}` : null,
    withMobile
      ? `  ${paint('mobile', 'Mobile')}     ${EXPO_URL}  ${paint('dim', '(scan the QR below)')}`
      : null,
    paint('dim', '  ─────────────────────────────────────────────'),
    paint('dim', '  Ctrl-C stops all of them.'),
    '',
  ]
    .filter(Boolean)
    .join('\n');
  console.log(banner);

  // A beat after the banner so the URL is still on screen when the tab opens,
  // and after Vite has bound its port so the first load is not a refused
  // connection the user has to reload past.
  if (withAdmin && openBrowser) {
    await sleep(2500);
    if (!shuttingDown) open(ADMIN_URL);
  }
}
