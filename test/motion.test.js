import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  moodOf, transitionFor, walkSpeed, pingPong, decayLevel, stepMotion, motionView, TRANSITION_TICKS,
  newlyAsking, bellFor, BELL,
} from '../src/motion.js';

test('moodOf: asking wins over state', () => {
  assert.equal(moodOf({ state: 'sleeping', question: 'Allow Bash?' }), 'asking');
  assert.equal(moodOf({ state: 'working', question: null }), 'working');
  assert.equal(moodOf({ state: 'sleeping' }), 'sleeping');
});

test('transitionFor maps mood changes to one-off scenes', () => {
  const cases = [
    [undefined, 'working', null],
    ['working', 'working', null],
    ['sleeping', 'working', 'wake'],
    ['asking', 'working', 'wake'],
    ['working', 'sleeping', 'yawn'],
    ['asking', 'sleeping', null],
    ['working', 'asking', 'done'],
    ['sleeping', 'asking', 'done'],
  ];
  for (const [from, to, want] of cases) assert.equal(transitionFor(from, to), want, `${from} -> ${to}`);
});

test('walkSpeed grows with CPU', () => {
  assert.ok(walkSpeed(5) < walkSpeed(40));
  assert.ok(walkSpeed(40) < walkSpeed(90));
});

test('pingPong bounces between 0 and range', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((s) => pingPong(s, 3)), [0, 1, 2, 3, 2, 1, 0]);
  assert.equal(pingPong(7, 0), 0);
  assert.equal(pingPong(-1, 3), 1);
});

test('decayLevel: nothing while working, more stuff the longer it idles', () => {
  assert.equal(decayLevel(10 * 3600, 'working'), 0);
  assert.equal(decayLevel(null, 'sleeping'), 0);
  assert.equal(decayLevel(30 * 60, 'sleeping'), 0);
  assert.equal(decayLevel(2 * 3600, 'sleeping'), 1);
  assert.equal(decayLevel(7 * 3600, 'asking'), 2);
  assert.equal(decayLevel(25 * 3600, 'sleeping'), 3);
});

test('stepMotion tracks transitions and walking without mutating the previous state', () => {
  const a = { kind: 'claude', pid: 7, state: 'sleeping', cpu: 0, question: null };
  const m0 = stepMotion(new Map(), [a], 0);
  const s0 = m0.get('claude:7');
  assert.equal(s0.mood, 'sleeping');
  assert.equal(s0.transition, null);

  const m1 = stepMotion(m0, [{ ...a, state: 'working', cpu: 80 }], 5);
  const s1 = m1.get('claude:7');
  assert.equal(s1.transition, 'wake');
  assert.equal(s1.since, 5);
  assert.ok(s1.pos > s0.pos, 'walks while working');
  assert.equal(m0.get('claude:7'), s0, 'previous map untouched');

  const m2 = stepMotion(m1, [{ ...a, state: 'working', cpu: 80 }], 6);
  assert.equal(m2.get('claude:7').since, 5, 'since only moves on mood change');

  const m3 = stepMotion(m2, [{ ...a, state: 'sleeping' }], 7);
  assert.equal(m3.get('claude:7').pos, m2.get('claude:7').pos, 'stops walking when asleep');
  assert.equal(stepMotion(m3, [], 8).size, 0, 'gone agents are dropped');
});

test('motionView only reports a transition for a short while', () => {
  const m = { mood: 'working', since: 10, transition: 'wake', pos: 3.5 };
  assert.equal(motionView(m, 10).transition, 'wake');
  assert.equal(motionView(m, 10 + TRANSITION_TICKS).transition, null);
  assert.equal(motionView(m, 12).age, 2);
  assert.equal(motionView(m, 12).pos, 3);
  assert.deepEqual(motionView(undefined, 4), { transition: null, age: 0, pos: 0 });
});

const ag = (pid, mood) => ({
  kind: 'claude', pid, state: mood === 'working' ? 'working' : 'sleeping', question: mood === 'asking' ? 'Allow Bash?' : null,
});

test('newlyAsking: agents that changed into asking since the previous sample', () => {
  const keys = (prev, next) => newlyAsking(prev, next).map((a) => a.pid);
  assert.deepEqual(keys([ag(1, 'working')], [ag(1, 'asking')]), [1], 'working -> asking');
  assert.deepEqual(keys([ag(1, 'sleeping')], [ag(1, 'asking')]), [1], 'sleeping -> asking');
  assert.deepEqual(keys(null, [ag(1, 'asking')]), [], 'already asking at startup');
  assert.deepEqual(keys([ag(1, 'working')], [ag(1, 'working'), ag(2, 'asking')]), [], 'new agent appears already asking');
  assert.deepEqual(keys([ag(1, 'asking')], [ag(1, 'asking')]), [], 'stays asking');
  assert.deepEqual(keys([ag(1, 'working'), ag(2, 'sleeping')], [ag(1, 'asking'), ag(2, 'asking')]), [1, 2]);
  const hidden = { ...ag(3, 'sleeping'), idleSec: 99 * 3600 };
  assert.deepEqual(keys([hidden], [{ ...hidden, question: 'Still there?' }]), [3], 'idle-hidden agents still count');
  assert.deepEqual(keys([ag(1, 'working')], [{ ...ag(1, 'asking'), kind: 'opencode' }]), [], 'keyed by kind and pid');
});

test('bellFor: one bell per sample with a new asker, none when disabled', () => {
  const prev = [ag(1, 'working'), ag(2, 'sleeping')];
  const next = [ag(1, 'asking'), ag(2, 'asking')];
  assert.equal(BELL, '\x07');
  assert.equal(bellFor(true, prev, next), BELL);
  assert.equal(bellFor(false, prev, next), '');
  assert.equal(bellFor(true, next, next), '');
  assert.equal(bellFor(true, null, next), '');
});
