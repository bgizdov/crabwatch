import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { snapshot } from '../src/snapshot.js';
import { parseArgs } from '../src/args.js';

const DASHBOARD = fileURLToPath(new URL('../src/dashboard.js', import.meta.url));

const agent = (o) => ({
  kind: 'claude', pid: 1, name: 'p', title: null, model: null, state: 'sleeping', cpu: 0, question: null,
  sessionSec: 60, idleSec: 0, busy: false, pids: [1, 2], args: 'claude', etimes: 60, lastActivityMs: 123,
  ...o,
});

test('snapshot orders agents by attention and counts moods', () => {
  const s = snapshot([
    agent({ pid: 3 }),
    agent({ pid: 2, state: 'working', cpu: 40 }),
    agent({ pid: 1, question: 'Allow Bash?' }),
  ], 24 * 3600);
  assert.deepEqual(s.agents.map((a) => [a.pid, a.mood]), [[1, 'asking'], [2, 'working'], [3, 'sleeping']]);
  assert.deepEqual(s.counts, { asking: 1, working: 1, sleeping: 1, hidden: 0 });
});

test('snapshot hides long-idle agents like --max-idle, but never askers', () => {
  const s = snapshot([
    agent({ pid: 1, idleSec: 30 * 3600 }),
    agent({ pid: 2, idleSec: 30 * 3600, question: 'Still there?' }),
    agent({ pid: 3, idleSec: 10 }),
  ], 24 * 3600);
  assert.deepEqual(s.agents.map((a) => a.pid), [2, 3]);
  assert.equal(s.counts.hidden, 1);
  assert.equal(snapshot([agent({ idleSec: 1e9 })], 0).counts.hidden, 0, 'limit 0 shows all');
});

test('snapshot fields: documented keys only, nulls for unknowns, rounded numbers', () => {
  const [a] = snapshot([agent({
    pid: 7, name: 'api', title: 'Fix login', model: 'claude-opus-5-5', state: 'working', cpu: 12.3456,
    sessionSec: 99.6, idleSec: null,
  })], 24 * 3600).agents;
  assert.deepEqual(a, {
    kind: 'claude', pid: 7, name: 'api', title: 'Fix login', model: 'claude-opus-5-5', mood: 'working',
    state: 'working', question: null, cpu: 12.3, sessionSec: 100, idleSec: null,
  });
  const [b] = snapshot([{ kind: 'opencode', pid: 8, state: 'sleeping' }], 0).agents;
  assert.deepEqual(b, {
    kind: 'opencode', pid: 8, name: null, title: null, model: null, mood: 'sleeping',
    state: 'sleeping', question: null, cpu: null, sessionSec: null, idleSec: null,
  });
});

test('parseArgs accepts --json', () => {
  assert.equal(parseArgs([]).json, false);
  assert.equal(parseArgs(['--json']).json, true);
});

test('dashboard --demo --json prints one JSON snapshot and exits 0', () => {
  const r = spawnSync(process.execPath, [DASHBOARD, '--demo', '--json'], { encoding: 'utf8', timeout: 10000 });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!r.stdout.includes('\x1b'), 'no escape sequences');
  const s = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(s.counts), ['asking', 'working', 'sleeping', 'hidden']);
  assert.ok(s.agents.length > 0);
  assert.equal(s.counts.asking + s.counts.working + s.counts.sleeping, s.agents.length);
  for (const a of s.agents) {
    assert.deepEqual(Object.keys(a), ['kind', 'pid', 'name', 'title', 'model', 'mood', 'state', 'question', 'cpu', 'sessionSec', 'idleSec']);
  }
});
