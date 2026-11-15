import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEtime, parseCpuTime, parseDarwinPs, parseLsofCwd } from '../src/darwin.js';
import { findAgents } from '../src/procs.js';

test('parseEtime handles mm:ss, hh:mm:ss and dd-hh:mm:ss', () => {
  assert.equal(parseEtime('00:05'), 5);
  assert.equal(parseEtime('12:34'), 754);
  assert.equal(parseEtime('01:02:03'), 3723);
  assert.equal(parseEtime('2-01:02:03'), 2 * 86400 + 3723);
  assert.equal(parseEtime('garbage'), 0);
});

test('parseCpuTime returns centiseconds', () => {
  assert.equal(parseCpuTime('0:00.01'), 1);
  assert.equal(parseCpuTime('1:02.50'), 6250);
  assert.equal(parseCpuTime('125:00.00'), 750000);
  assert.equal(parseCpuTime('1:00:00.00'), 360000);
  assert.equal(parseCpuTime('1-00:00:00'), 8640000);
  assert.equal(parseCpuTime(''), 0);
});

const PS = `
    1     0 10-01:00:00   1:23.45 launchd          /sbin/launchd
  100     1       08:20   0:12.34 claude           claude --dangerously-skip-permissions
  101   100       00:10   0:00.50 bash             bash -c npm test
  200     1    01:00:00   2:00.00 opencode         /opt/homebrew/bin/opencode
  300     1       00:20   0:00.01 2.1.319          /Users/me/.local/share/claude/versions/2.1.319
`;

test('parseDarwinPs returns procs with elapsed seconds and CPU ticks', () => {
  const procs = parseDarwinPs(PS);
  assert.equal(procs.length, 5);
  assert.deepEqual(procs[1], {
    pid: 100, ppid: 1, etimes: 500, ticks: 1234, comm: 'claude',
    args: 'claude --dangerously-skip-permissions',
  });
  assert.equal(procs[0].etimes, 10 * 86400 + 3600);
});

test('parseDarwinPs output works with findAgents', () => {
  const agents = findAgents(parseDarwinPs(PS));
  assert.deepEqual(agents.map((a) => [a.kind, a.pid]), [
    ['claude', 100], ['opencode', 200], ['claude', 300],
  ]);
  assert.deepEqual(agents[0].pids.sort(), [100, 101]);
});

test('parseLsofCwd maps pids to their cwd', () => {
  const out = 'p100\nfcwd\nn/Users/me/projects/app\np200\nfcwd\nn/Users/me/with space\n';
  const map = parseLsofCwd(out);
  assert.equal(map.get(100), '/Users/me/projects/app');
  assert.equal(map.get(200), '/Users/me/with space');
  assert.equal(map.size, 2);
});

test('systemFor picks a backend per platform', async () => {
  const { systemFor } = await import('../src/procs.js');
  assert.equal(systemFor('win32'), null);
  const mac = systemFor('darwin');
  assert.equal(mac.hz, 100);
  const ticksOf = mac.ticksOf(parseDarwinPs(PS));
  assert.equal(ticksOf(100), 1234);
  assert.equal(ticksOf(999), 0);
  assert.equal(mac.procStart(100), null);
});
