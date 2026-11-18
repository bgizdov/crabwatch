import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, USAGE, HELP } from '../src/args.js';

const DASHBOARD = fileURLToPath(new URL('../src/dashboard.js', import.meta.url));

test('parseArgs: defaults', () => {
  assert.deepEqual(parseArgs([]), {
    demo: false, beach: false, bell: false, json: false, title: true, threshold: 5, maxIdle: 24, help: false,
  });
});

test('parseArgs: values as separate arguments or with =', () => {
  assert.equal(parseArgs(['--threshold', '10']).threshold, 10);
  assert.equal(parseArgs(['--threshold=10']).threshold, 10);
  assert.equal(parseArgs(['--threshold=2.5']).threshold, 2.5);
  assert.equal(parseArgs(['--max-idle=0']).maxIdle, 0);
  assert.equal(parseArgs(['--max-idle', '48']).maxIdle, 48);
});

test('parseArgs: booleans and -h', () => {
  const o = parseArgs(['--demo', '--beach', '--bell']);
  assert.deepEqual([o.demo, o.beach, o.bell], [true, true, true]);
  assert.equal(parseArgs(['--help']).help, true);
  assert.equal(parseArgs(['-h']).help, true);
});

test('parseArgs: rejects unknown flags, missing values, positionals and bad numbers', () => {
  const bad = [
    [['--bogus'], /--bogus/],
    [['--threshhold', '10'], /--threshhold/],
    [['--threshold'], /--threshold/],
    [['--max-idle'], /--max-idle/],
    [['--threshold', '--demo'], /--threshold/],
    [['demo'], /demo/],
    [['--threshold=abc'], /--threshold must be a non-negative number/],
    [['--threshold='], /--threshold must be a non-negative number/],
    [['--threshold=-5'], /--threshold must be a non-negative number/],
    [['--max-idle=-1'], /--max-idle must be a non-negative number/],
    [['--max-idle=NaN'], /--max-idle must be a non-negative number/],
  ];
  for (const [argv, msg] of bad) assert.throws(() => parseArgs(argv), msg, argv.join(' '));
});

test('HELP lists every flag with its default, and the keys', () => {
  for (const s of ['--demo', '--beach', '--bell', '--json', '--threshold', '--max-idle', '--help', '-h', 'default 5', 'default 24']) {
    assert.ok(HELP.includes(s), s);
  }
  for (const s of ['b ', 'h ', 'q ', 'Ctrl-C']) assert.ok(HELP.includes(s), `key ${s}`);
  assert.ok(HELP.startsWith(USAGE));
});

test('dashboard exits 2 on a bad flag with error and usage on stderr, without the alternate screen', () => {
  const r = spawnSync(process.execPath, [DASHBOARD, '--bogus'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /^crabwatch: .*--bogus/);
  assert.ok(r.stderr.includes(USAGE));
  assert.equal(r.stdout, '');
});

test('dashboard --help prints the help on stdout and exits 0', () => {
  const r = spawnSync(process.execPath, [DASHBOARD, '-h'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, `${HELP}\n`);
});
