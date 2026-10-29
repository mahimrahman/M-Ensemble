/**
 * `npm run dev` — the whole platform, from one terminal.
 *
 *   API        http://localhost:4000       Express + Mongo
 *   Dashboard  http://localhost:5173       the super-admin console
 *   Mobile     http://localhost:8081       Expo, with the QR code for a phone
 *
 * Three processes and one Ctrl-C to stop them all. Written by hand rather than
 * pulling in `concurrently` because the useful part is not the parallelism — it
 * is the ordering, the banner and the shutdown, none of which a generic runner
 * does the way this repo needs.
 *
 * The API and the dashboard are piped so their lines can be prefixed. Expo is
 * not: it is started last and given the terminal directly, because its QR code
 * and its `r` / `j` keys only appear when its stdout is a real TTY.
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
 *   --stop          kill this repo's dev processes and exit, starting nothing
 */

import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = new Set(process.argv.slice(2));
const stopOnly = args.has('--stop');
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

/**
 * `interactive` hands the child our real terminal instead of a pipe.
 *
 * Only Expo needs it, and it needs it for a reason worth the inconsistency:
 * the QR code and the `r` / `j` key menu are drawn only when its stdout is a
 * TTY. Behind a pipe it decides it is running unattended and prints neither,
 * so the one command that is supposed to get a phone connected is the one
 * command that cannot. Prefixing that stream is not worth losing the QR.
 */
function start(name, command, extraArgs, env = {}, interactive = false) {
  const child = spawn(command, extraArgs, {
    cwd: ROOT,
    env: { ...process.env, ...env, FORCE_COLOR: tty ? '1' : '0' },
    // Piped rather than inherited so every line can be prefixed — except for
    // an interactive child, which is given the terminal directly.
    stdio: interactive ? 'inherit' : ['ignore', 'pipe', 'pipe'],
    // npm on Windows is a .cmd, which cannot be exec'd without a shell.
    shell: process.platform === 'win32',
  });

  // Nothing to prefix when the streams went straight to the terminal.
  if (!interactive) {
    prefixed(name, child.stdout);
    prefixed(name, child.stderr);
  }

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

// ─── Writing the tree down before it falls ──────────────────────────────────

/**
 * Every pid we have ever seen underneath one of our children.
 *
 * `taskkill /t` walks *live* parent links, and on Windows Ctrl-C is precisely
 * what breaks that walk. The console delivers CTRL_C_EVENT to every process
 * attached to it in the same instant, so the `npm` shim in the middle is
 * usually already gone by the time this process gets its SIGINT — and the
 * `tsx watch` and Metro processes below it, now reparented onto whatever
 * inherits orphans, cannot be reached from our pid by any walk at all. They
 * survive, holding the port and the file watches, and the next `npm run dev`
 * starts a second set behind the first.
 *
 * So we write the tree down while it is still standing. One process listing
 * every few seconds buys a shutdown that does not depend on links that Ctrl-C
 * has already cut.
 */
const descendants = new Set();
let treeTimer = null;

function trackTree() {
  if (process.platform !== 'win32' || treeTimer) return;

  const tick = () => {
    if (shuttingDown) return;
    const roots = new Set(children.map(({ child }) => child.pid).filter(Boolean));
    if (roots.size === 0) return;

    const ps = spawn(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId)" }',
      ],
      { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true },
    );

    let out = '';
    ps.stdout.on('data', (chunk) => {
      out += chunk;
    });
    ps.on('error', () => {});
    ps.on('close', () => {
      if (shuttingDown) return;
      const parentOf = new Map();
      for (const line of out.split('\n')) {
        const [pid, ppid] = line.trim().split(/\s+/).map(Number);
        if (pid) parentOf.set(pid, ppid);
      }
      for (const pid of parentOf.keys()) {
        // Walk up from every process on the machine; anything that reaches one
        // of ours is ours. The hop cap is only there so a cycle in a stale
        // listing cannot spin.
        let cursor = pid;
        for (let hop = 0; cursor && hop < 40; hop += 1) {
          if (roots.has(cursor)) {
            descendants.add(pid);
            break;
          }
          cursor = parentOf.get(cursor);
        }
      }
    });
  };

  tick();
  treeTimer = setInterval(tick, 3000);
  treeTimer.unref();
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (treeTimer) clearInterval(treeTimer);

  if (process.platform === 'win32') {
    // The tree first, for whatever of it is still linked...
    for (const { child } of children) {
      if (child.pid) {
        spawnSync('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' });
      }
    }
    // ...then everything we wrote down, for the parts the walk could not reach.
    const strays = [...descendants].filter((pid) => pid !== process.pid);
    if (strays.length) {
      const pidArgs = strays.flatMap((pid) => ['/pid', String(pid)]);
      spawnSync('taskkill', [...pidArgs, '/f'], { stdio: 'ignore' });
    }
    // spawnSync rather than spawn: the old code fired taskkill asynchronously
    // and then exited on a 600ms timer, which is a race it can lose — and when
    // it lost, the orphans it was trying to kill outlived the terminal.
  } else {
    for (const { child } of children) {
      if (child.exitCode === null) child.kill('SIGTERM');
    }
  }

  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// ─── Stopping strays from a cold start ──────────────────────────────────────

/**
 * `npm run dev:stop` — kill this repo's dev processes without starting any.
 *
 * For the ones that got away before this file knew how to hold on to them, and
 * for the times a terminal is closed rather than interrupted, which sends no
 * signal at all.
 *
 * The match is deliberately narrow. Searching command lines for the repo path
 * alone also finds the editor and the shells that happen to have it open, so a
 * process has to either name one of our three workspaces or sit under this
 * repo *and* be one of the runners we actually start. Nothing else is ours.
 */
function stopStrays() {
  if (process.platform !== 'win32') {
    console.log(paint('dim', '[dev] --stop is implemented for Windows only.'));
    return;
  }

  const root = ROOT.replace(/'/g, "''");
  const script = [
    `$root = '${root}'`,
    `$mine = Get-CimInstance Win32_Process | Where-Object {`,
    `  $c = $_.CommandLine`,
    // $PID is this query's own shell. Its command line *is* the script below,
    // which contains the very strings the script searches for, so without this
    // the sweep matches and kills itself. Nothing we start is a PowerShell, so
    // the whole name is excluded rather than just this one process.
    `  $_.ProcessId -ne ${process.pid} -and $_.ProcessId -ne $PID -and`,
    `  $_.Name -notlike 'powershell*' -and $_.Name -notlike 'pwsh*' -and $c -and (`,
    `    $c -like '*@m-ensemble/*' -or (`,
    `      $c -like "*$root*" -and (`,
    `        $c -like '*tsx*' -or $c -like '*vite*' -or`,
    `        $c -like '*expo*' -or $c -like '*metro*' -or $c -like '*esbuild*'`,
    `      )`,
    `    )`,
    `  )`,
    `}`,
    `foreach ($p in $mine) {`,
    `  "$($p.ProcessId) $($p.Name)"`,
    `  Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue`,
    `}`,
  ].join('\n');

  const result = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
  });

  const killed = (result.stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (killed.length === 0) {
    console.log(paint('dim', '[dev] nothing of this repo was running.'));
    return;
  }
  for (const line of killed) console.log(paint('dim', `[dev] stopped ${line}`));
  console.log(paint('dim', `[dev] ${killed.length} process(es) stopped.`));
}

if (stopOnly) {
  stopStrays();
  process.exit(0);
}

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
trackTree();

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

// The banner goes up *before* Expo starts. Expo owns the terminal from the
// moment it boots and ends on its QR code, so anything printed after this
// point is either scrolled away by Metro or lands underneath the thing the
// banner is telling you to scan.
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

// Expo goes last and gets the terminal itself, so its QR code is the last
// thing on screen and `r` / `j` still reach it.
if (withMobile && !shuttingDown) {
  start(
    'mobile',
    'npm',
    ['run', 'start', '--workspace', '@m-ensemble/mobile', '--', ...(tunnel ? ['--tunnel'] : [])],
    // The app ships on mocks by default; running it from here means running it
    // against the API that just started, which is the whole point of one
    // command. An explicit value in apps/mobile/.env still wins — this only
    // fills in a default for the processes started here.
    { EXPO_PUBLIC_USE_MOCKS: process.env.EXPO_PUBLIC_USE_MOCKS ?? 'false' },
    true,
  );
}
