import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idleSeconds, visibleAgents, lastMessageMs, opencodeBusy } from '../src/idle.js';

const NOW = 1_000_000_000;

test('idleSeconds: busy agents are never idle', () => {
  assert.equal(idleSeconds({ busy: true, state: 'working', lastActivityMs: NOW - 99_000 }, NOW), 0);
});

test('idleSeconds: a CPU blip does not reset idle time when activity is known', () => {
  assert.equal(idleSeconds({ state: 'working', lastActivityMs: NOW - 99_000 }, NOW), 99);
});

test('idleSeconds: working with unknown activity counts as active', () => {
  assert.equal(idleSeconds({ state: 'working', lastActivityMs: null }, NOW), 0);
});

test('idleSeconds: time since last activity, null when unknown', () => {
  assert.equal(idleSeconds({ state: 'sleeping', lastActivityMs: NOW - 90_000 }, NOW), 90);
  assert.equal(idleSeconds({ state: 'sleeping', lastActivityMs: NOW + 5_000 }, NOW), 0);
  assert.equal(idleSeconds({ state: 'sleeping', lastActivityMs: null }, NOW), null);
});

test('visibleAgents hides agents idle longer than the limit and counts them', () => {
  const agents = [
    { pid: 1, idleSec: 0 },
    { pid: 2, idleSec: 25 * 3600 },
    { pid: 3, idleSec: null },
    { pid: 4, idleSec: 24 * 3600 },
  ];
  const { shown, hidden } = visibleAgents(agents, 24 * 3600);
  assert.deepEqual(shown.map((a) => a.pid), [1, 3, 4]);
  assert.equal(hidden, 1);
});

test('visibleAgents with limit 0 shows everything', () => {
  const { shown, hidden } = visibleAgents([{ pid: 1, idleSec: 1e9 }], 0);
  assert.equal(shown.length, 1);
  assert.equal(hidden, 0);
});

test('lastMessageMs uses message timestamps, not other transcript writes', () => {
  const entries = [
    { type: 'user', timestamp: '2026-11-09T12:00:00.000Z' },
    { type: 'assistant', timestamp: '2026-11-09T12:33:03.209Z' },
    { type: 'system', subtype: 'away_summary', timestamp: '2026-11-15T17:00:00.000Z' },
    { type: 'atis-latch' },
  ];
  assert.equal(lastMessageMs(entries), Date.parse('2026-11-09T12:33:03.209Z'));
  assert.equal(lastMessageMs([{ type: 'system' }]), null);
});

test('opencodeBusy reads the session busy/idle timestamps', () => {
  const now = 10_000_000;
  assert.equal(opencodeBusy({ time_busy: now - 5000, time_idle: now - 9000, time_updated: now - 1000 }, now), true);
  assert.equal(opencodeBusy({ time_busy: now - 5000, time_idle: null, time_updated: now - 1000 }, now), true);
  assert.equal(opencodeBusy({ time_busy: now - 9000, time_idle: now - 5000, time_updated: now - 5000 }, now), false);
  assert.equal(opencodeBusy({ time_busy: null, time_idle: null, time_updated: now }, now), false);
});

test('opencodeBusy: unknown for old-style sessions and stale busy flags', () => {
  const now = 10_000_000_000;
  assert.equal(opencodeBusy({ time_updated: now }, now), undefined); // legacy table, no columns
  const crashed = { time_busy: now - 3 * 3600e3, time_idle: null, time_updated: now - 3 * 3600e3 };
  assert.equal(opencodeBusy(crashed, now), undefined);
});
