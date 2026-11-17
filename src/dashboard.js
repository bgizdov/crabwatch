#!/usr/bin/env node
// Pixel-art terminal dashboard: Claude crabs and opencode bots, sleeping or working.
import { createSampler } from './procs.js';
import { renderCard, layout } from './render.js';
import { visibleAgents, byAttention } from './idle.js';
import { renderBeach } from './beach.js';
import { stepMotion, motionView, motionKey, bellFor } from './motion.js';

const FRAME_MS = 250;
const SAMPLE_MS = 1000;

function parseArgs(argv) {
  const get = (flag, fallback) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : fallback;
  };
  const threshold = get('--threshold', 5);
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error('--threshold must be a non-negative number (CPU %)');
  }
  const maxIdle = get('--max-idle', 24);
  if (!Number.isFinite(maxIdle) || maxIdle < 0) {
    throw new Error('--max-idle must be a non-negative number of hours (0 shows all)');
  }
  return {
    demo: argv.includes('--demo'),
    beach: argv.includes('--beach'),
    bell: argv.includes('--bell'),
    threshold,
    maxIdle,
    help: argv.includes('--help'),
  };
}

function demoSampler() {
  const names = ['api-server', 'web-app', 'infra', 'docs-site', 'mobile', 'data-etl'];
  const titles = ['Rate limiter for public API', 'Dark mode toggle', 'Terraform state cleanup',
    'Fix broken doc links', 'Push notification opt-in', 'Nightly import retries'];
  let agents = names.map((name, i) => ({
    kind: ['claude', 'claude', 'opencode', 'claude', 'claude', 'opencode-web'][i],
    pid: 1000 + i * 137,
    name,
    title: titles[i],
    sessionSec: 300 + i * 1900,
    idleSec: [2 * 3600, 0, 7 * 3600, 0, 20 * 60, 30 * 3600][i],
    state: i % 2 ? 'working' : 'sleeping',
    cpu: 0,
    question: null,
    model: ['claude-opus-5-5', 'claude-sonnet-5-5', 'big-pickle', 'claude-fable-5-2', 'claude-haiku-5-5', 'gpt-5'][i],
  }));
  const questions = ['Want me to open a pull request?', 'Allow Bash?', 'Use Postgres or SQLite for the cache?', 'Shall I run the migrations?'];
  return () => {
    agents = agents.map((a) => {
      const state = Math.random() < 0.12 ? (a.state === 'working' ? 'sleeping' : 'working') : a.state;
      const cpu = state === 'working' ? 15 + Math.random() * 70 : Math.random() * 2;
      const flip = Math.random() < 0.08;
      const question = flip ? (a.question ? null : questions[Math.floor(Math.random() * questions.length)]) : a.question;
      const finalState = question ? 'sleeping' : state;
      const idleSec = finalState === 'working' ? 0 : a.idleSec + 1;
      return { ...a, state: finalState, cpu, question, idleSec, sessionSec: a.sessionSec + 1 };
    });
    return agents;
  };
}

const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const GRAY = '\x1b[38;2;130;130;140m';

function frame(allAgents, tick, opts, showHidden, motions, view) {
  const { demo, maxIdle } = opts;
  const filtered = visibleAgents(allAgents, maxIdle * 3600);
  const idleCount = allAgents.length - filtered.shown.length;
  const agents = showHidden ? allAgents : filtered.shown;
  const hidden = showHidden ? 0 : idleCount;
  const width = process.stdout.columns || 80;
  const asking = agents.filter((a) => a.question).length;
  const working = agents.filter((a) => !a.question && a.state === 'working').length;
  const header = `${BOLD} 🦀 CRABWATCH${RESET}${demo ? ' (demo)' : ''}   `
    + `\x1b[38;2;255;210;70m${asking} asking${RESET} · `
    + `\x1b[38;2;110;220;120m${working} working${RESET} · `
    + `\x1b[38;2;120;150;255m${agents.length - working - asking} sleeping${RESET}`
    + (hidden ? `${GRAY} · ${hidden} hidden (idle >${maxIdle}h)${RESET}` : '')
    + (showHidden && idleCount ? `${GRAY} · showing ${idleCount} idle >${maxIdle}h${RESET}` : '');
  const sorted = [...agents].sort(byAttention);
  const cards = () => layout(
    sorted.map((a) => renderCard(a, tick + a.pid, motionView(motions.get(motionKey(a)), tick))),
    width - 2,
  ).map((l) => ` ${l}`);
  const body = sorted.length
    ? (view === 'beach' ? renderBeach(sorted, motions, tick, width) : cards())
    : ['', hidden ? '   Everyone has been idle a long time. zZz' : '   No claude or opencode processes found. zZz',
      hidden ? '   (press h to show them)' : '   (run with --demo to see the crew)'];
  const toggle = idleCount ? ` · h ${showHidden ? 'hide' : 'show'} ${idleCount} idle` : '';
  const footer = `${GRAY} q quit · b ${view === 'beach' ? 'cards' : 'beach'}${toggle}${RESET}`;
  return ['', header, '', ...body, '', footer].join('\x1b[K\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write('Usage: crabwatch [--demo] [--beach] [--bell] [--threshold <cpu%>] [--max-idle <hours, 0 = show all>]\n');
    return;
  }
  const sample = opts.demo ? demoSampler() : await createSampler({ threshold: opts.threshold });

  let agents = sample();
  let tick = 0;
  let showHidden = opts.maxIdle === 0;
  let view = opts.beach ? 'beach' : 'cards';
  let motions = stepMotion(new Map(), agents, tick);
  const out = process.stdout;
  out.write('\x1b[?1049h\x1b[?25l'); // alt screen, hide cursor

  const cleanup = () => {
    out.write('\x1b[?25h\x1b[?1049l');
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (k) => {
      const key = String(k).toLowerCase();
      if (k[0] === 3 || key === 'q') cleanup();
      if (key === 'h') {
        showHidden = !showHidden;
        draw();
      }
      if (key === 'b') {
        view = view === 'beach' ? 'cards' : 'beach';
        out.write('\x1b[2J');
        draw();
      }
    });
  }

  function draw() {
    out.write(`\x1b[H${frame(agents, tick, opts, showHidden, motions, view)}\x1b[J`);
  }
  setInterval(() => {
    tick += 1;
    motions = stepMotion(motions, agents, tick);
    draw();
  }, FRAME_MS);
  setInterval(() => {
    try {
      const prevAgents = agents;
      agents = sample();
      const bell = bellFor(opts.bell, prevAgents, agents);
      if (bell) out.write(bell);
    } catch (err) {
      out.write(`\x1b[?25h\x1b[?1049l`);
      process.stderr.write(`crabwatch: failed to sample processes: ${err.message}\n`);
      process.exit(1);
    }
  }, SAMPLE_MS);
  out.on('resize', () => out.write('\x1b[2J'));
  draw();
}

main().catch((err) => {
  process.stderr.write(`crabwatch: ${err.message}\n`);
  process.exit(1);
});
