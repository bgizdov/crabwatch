import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePs, classify, findAgents, cpuPercent, stateFor, isOpencodeServer, opencodeIdentity } from '../src/procs.js';

const PS = `
    1     0  999 init            /sbin/init
  100     1  500 claude          claude --dangerously-skip-permissions
  101   100   10 bash            bash -c npm test
  102   101    5 node            node --test
  200     1  300 opencode        opencode
  201   200  300 opencode.exe    /usr/lib/opencode.exe
  300     1   20 node            node /usr/local/bin/claude -p hi
  400     1   20 vim             vim claude.md
`;

test('parsePs parses pid, ppid, elapsed, comm and args', () => {
  const procs = parsePs(PS);
  assert.equal(procs.length, 8);
  assert.deepEqual(procs[1], {
    pid: 100, ppid: 1, etimes: 500, comm: 'claude',
    args: 'claude --dangerously-skip-permissions',
  });
});

test('classify detects claude and opencode, ignores others', () => {
  const procs = parsePs(PS);
  const byPid = Object.fromEntries(procs.map((p) => [p.pid, classify(p)]));
  assert.equal(byPid[100], 'claude');
  assert.equal(byPid[200], 'opencode');
  assert.equal(byPid[201], 'opencode');
  assert.equal(byPid[300], 'claude');
  assert.equal(byPid[400], null);
  assert.equal(byPid[101], null);
});

test('findAgents returns root agents with all descendants', () => {
  const agents = findAgents(parsePs(PS));
  assert.deepEqual(agents.map((a) => [a.kind, a.pid]), [
    ['claude', 100], ['opencode', 200], ['claude', 300],
  ]);
  assert.deepEqual(agents[0].pids.sort(), [100, 101, 102]);
  assert.deepEqual(agents[1].pids.sort(), [200, 201]);
});

test('cpuPercent converts tick delta to percent', () => {
  assert.equal(cpuPercent(100, 150, 1, 100), 50);
  assert.equal(cpuPercent(undefined, 150, 1, 100), 0);
  assert.equal(cpuPercent(100, 90, 1, 100), 0);
  assert.equal(cpuPercent(100, 150, 0, 100), 0);
});

test('stateFor uses threshold', () => {
  assert.equal(stateFor(10, 5), 'working');
  assert.equal(stateFor(5, 5), 'working');
  assert.equal(stateFor(4.9, 5), 'sleeping');
});

test('stateFor treats busy status as working regardless of CPU', () => {
  assert.equal(stateFor(0, 5, true), 'working');
});

test('classify detects claude launched by version path (e.g. via Happy)', () => {
  const p = { pid: 5, ppid: 4, etimes: 1, comm: '2.1.319', args: '/usr/local/share/claude/versions/2.1.319 --append-system-prompt hi' };
  assert.equal(classify(p), 'claude');
  const launcher = { pid: 4, ppid: 1, etimes: 1, comm: 'node', args: 'node /usr/lib/happy-coder/scripts/claude_local_launcher.cjs' };
  assert.equal(classify(launcher), null);
});

test('stateFor trusts an explicit idle status over CPU spikes', () => {
  assert.equal(stateFor(50, 5, false), 'sleeping');
  assert.equal(stateFor(50, 5, undefined), 'working');
});

test('isOpencodeServer spots `opencode serve` but not the TUI', () => {
  assert.equal(isOpencodeServer('opencode serve --hostname 127.0.0.1 --port 4096'), true);
  assert.equal(isOpencodeServer('/usr/lib/opencode.exe serve'), true);
  assert.equal(isOpencodeServer('opencode'), false);
  assert.equal(isOpencodeServer('opencode /workspaces/serve-app'), false);
});

test('opencodeIdentity names a server bot after its current session, not its launch dir', () => {
  const info = { directory: '/home/u/.local/share/opencode/worktree/406d1b/silent-engine', projectDir: '/workspaces/racing-site' };
  assert.deepEqual(opencodeIdentity('/workspaces/devcontainer-setup', true, info),
    { kind: 'opencode-web', name: 'racing-site' });
  assert.deepEqual(opencodeIdentity('/workspaces/x', true, { ...info, projectName: 'Racing' }),
    { kind: 'opencode-web', name: 'Racing' }, 'a project name set in opencode wins');
  assert.deepEqual(opencodeIdentity('/workspaces/x', true, { directory: '/w/loose-dir' }),
    { kind: 'opencode-web', name: 'loose-dir' }, 'falls back to the session dir');
  assert.deepEqual(opencodeIdentity('/workspaces/devcontainer-setup', true, null),
    { kind: 'opencode-web', name: 'no session' });
  assert.deepEqual(opencodeIdentity('/workspaces/api', false, info),
    { kind: 'opencode', name: 'api' });
});
