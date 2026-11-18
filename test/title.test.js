import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countsOf, terminalTitle, titleSequence, createTitleSetter, TITLE_PUSH, TITLE_POP,
} from '../src/title.js';
import { parseArgs, HELP } from '../src/args.js';

test('countsOf matches the header: asking first, then working, then sleeping', () => {
  const agents = [
    { state: 'working', question: 'Allow Bash?' },
    { state: 'working' },
    { state: 'sleeping' },
    { state: 'sleeping', question: 'Which DB?' },
  ];
  assert.deepEqual(countsOf(agents), { asking: 2, working: 1, sleeping: 1 });
});

test('terminalTitle: three formats and the demo suffix', () => {
  assert.equal(terminalTitle({ asking: 2, working: 1, sleeping: 3 }), '🦀 2 asking · 1 working · crabwatch');
  assert.equal(terminalTitle({ asking: 2, working: 0, sleeping: 0 }), '🦀 2 asking · 0 working · crabwatch');
  assert.equal(terminalTitle({ asking: 0, working: 1, sleeping: 3 }), '🦀 1 working · crabwatch');
  assert.equal(terminalTitle({ asking: 0, working: 0, sleeping: 3 }), '🦀 crabwatch');
  assert.equal(terminalTitle({ asking: 0, working: 0, sleeping: 0 }, true), '🦀 crabwatch (demo)');
  assert.equal(terminalTitle({ asking: 1, working: 0, sleeping: 0 }, true), '🦀 1 asking · 0 working · crabwatch (demo)');
});

test('titleSequence wraps the title in OSC 2 and strips control characters', () => {
  assert.equal(titleSequence('🦀 crabwatch'), '\x1b]2;🦀 crabwatch\x07');
  assert.equal(titleSequence('a\x07b\x1bc'), '\x1b]2;abc\x07');
  assert.equal(TITLE_PUSH, '\x1b[22;0t');
  assert.equal(TITLE_POP, '\x1b[23;0t');
});

test('createTitleSetter writes only when the title changes', () => {
  const written = [];
  const set = createTitleSetter((s) => written.push(s));
  set('🦀 crabwatch');
  set('🦀 crabwatch');
  set('🦀 1 working · crabwatch');
  set('🦀 1 working · crabwatch');
  set('🦀 crabwatch');
  assert.deepEqual(written, [
    titleSequence('🦀 crabwatch'), titleSequence('🦀 1 working · crabwatch'), titleSequence('🦀 crabwatch'),
  ]);
});

test('--no-title turns the title off; it is on by default and in --help', () => {
  assert.equal(parseArgs([]).title, true);
  assert.equal(parseArgs(['--no-title']).title, false);
  assert.ok(HELP.includes('--no-title'));
});
