import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderBeach } from '../src/beach.js';
import { visibleWidth } from '../src/render.js';

const agents = [
  { kind: 'claude', pid: 1, name: 'api-server', state: 'working', cpu: 50, sessionSec: 60, idleSec: 0 },
  { kind: 'opencode', pid: 2, name: 'web-app', state: 'sleeping', cpu: 0, sessionSec: 60, idleSec: 7200 },
  { kind: 'claude', pid: 3, name: 'infra', state: 'sleeping', cpu: 0, sessionSec: 60, question: 'Allow Bash?' },
];

test('renderBeach fits the terminal width and shows every agent', () => {
  for (const width of [40, 80, 160]) {
    const lines = renderBeach(agents, new Map(), 3, width);
    assert.ok(lines.length > 0);
    for (const l of lines) assert.ok(visibleWidth(l) <= width, `width ${width}: "${l}" is ${visibleWidth(l)}`);
    const text = lines.join('\n');
    for (const name of ['api-server', 'web-app', 'infra']) assert.ok(text.includes(name), `${width}: ${name}`);
    assert.ok(text.includes('Allow Bash?'), 'speech bubble');
  }
});

test('renderBeach puts several agents on one strip when wide enough', () => {
  const wide = renderBeach(agents, new Map(), 0, 160);
  const narrow = renderBeach(agents, new Map(), 0, 40);
  assert.ok(wide.length < narrow.length);
});

test('renderBeach animates waves', () => {
  const a = renderBeach(agents, new Map(), 0, 80);
  const b = renderBeach(agents, new Map(), 1, 80);
  assert.notEqual(a.at(-1), b.at(-1));
});

test('renderBeach with no agents is empty', () => {
  assert.deepEqual(renderBeach([], new Map(), 0, 80), []);
});
