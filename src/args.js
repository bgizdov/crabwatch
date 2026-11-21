// Command-line options. Strict: unknown flags, missing values and stray arguments are errors.
import { parseArgs as parse } from 'node:util';

export const USAGE = 'Usage: crabwatch [--demo] [--beach] [--bell] [--no-title] [--json] [--threshold <cpu%>] [--max-idle <hours>]';

export const HELP = `${USAGE}

Options:
  --demo              show fake agents that change state at random (default off)
  --beach             start in the beach view instead of cards (default off)
  --bell              ring the terminal bell when an agent starts asking (default off)
  --no-title          don't show asking/working counts in the terminal title (default on)
  --json              print one JSON snapshot of the agents and exit (default off)
  --threshold <cpu%>  CPU % at which an agent counts as working (default 5)
  --max-idle <hours>  hide agents idle for longer than this, 0 shows all (default 24)
  -h, --help          show this help

Values can also be given as --threshold=10.

Keys:
  b         switch between cards and the beach
  h         show or hide agents idle longer than --max-idle
  q         quit (or Ctrl-C)`;

const OPTIONS = {
  demo: { type: 'boolean', default: false },
  beach: { type: 'boolean', default: false },
  bell: { type: 'boolean', default: false },
  json: { type: 'boolean', default: false },
  'no-title': { type: 'boolean', default: false },
  threshold: { type: 'string', default: '5' },
  'max-idle': { type: 'string', default: '24' },
  help: { type: 'boolean', short: 'h', default: false },
};

function nonNegative(text, message) {
  const n = text.trim() === '' ? NaN : Number(text);
  if (!Number.isFinite(n) || n < 0) throw new Error(message);
  return n;
}

export function parseArgs(argv) {
  const { values } = parse({ args: argv, options: OPTIONS, strict: true, allowPositionals: false });
  return {
    demo: values.demo,
    beach: values.beach,
    bell: values.bell,
    json: values.json,
    title: !values['no-title'],
    threshold: nonNegative(values.threshold, '--threshold must be a non-negative number (CPU %)'),
    maxIdle: nonNegative(values['max-idle'], '--max-idle must be a non-negative number of hours (0 shows all)'),
    help: values.help,
  };
}

// Live mode redraws full-screen frames forever, so it needs a terminal on stdout.
// Returns the error message to print, or null when it's fine to continue.
export function liveModeError({ isTTY, json, help }) {
  if (isTTY || json || help) return null;
  return 'stdout is not a terminal; use --json for a one-shot snapshot';
}
