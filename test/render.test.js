import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPRITES, spriteFrame } from '../src/sprites.js';
import {
  toHalfBlocks, visibleWidth, renderCard, layout, wrapText, formatDuration, agentArt, CARD_WIDTH,
} from '../src/render.js';

test('every sprite frame is a rectangle of the same size with known colors', () => {
  for (const [kind, sprite] of Object.entries(SPRITES)) {
    for (const [state, frames] of Object.entries(sprite.frames)) {
      for (const frame of frames) {
        assert.equal(frame.length, sprite.height, `${kind}/${state} height`);
        for (const row of frame) {
          assert.equal(row.length, sprite.width, `${kind}/${state} row "${row}"`);
          for (const ch of row) {
            if (ch !== '.') assert.ok(sprite.palette[ch], `${kind} color ${ch}`);
          }
        }
      }
    }
  }
});

test('spriteFrame cycles through frames by tick', () => {
  const a = spriteFrame('claude', 'working', 0);
  const b = spriteFrame('claude', 'working', 1);
  assert.notDeepEqual(a, b);
  assert.deepEqual(spriteFrame('claude', 'working', 2), a);
});

test('toHalfBlocks packs two pixel rows per text line', () => {
  const lines = toHalfBlocks(['ab', '.a'], { a: [255, 0, 0], b: [0, 0, 255] });
  assert.equal(lines.length, 1);
  assert.equal(visibleWidth(lines[0]), 2);
  assert.ok(lines[0].includes('▀'));
});

test('renderCard produces fixed-width lines', () => {
  const agent = { kind: 'claude', pid: 42, name: 'my-project', state: 'sleeping', cpu: 0, sessionSec: 3661 };
  const lines = renderCard(agent, 0);
  const widths = new Set(lines.map(visibleWidth));
  assert.equal(widths.size, 1);
  assert.ok(lines.join('').includes('SLEEP'));
});

test('layout wraps cards into rows that fit the terminal width', () => {
  const card = ['x'.repeat(10), 'y'.repeat(10)];
  const out = layout([card, card, card], 25, 2);
  assert.equal(out.length, 5); // 2 cards (2 lines), blank separator, 1 card (2 lines)
  assert.ok(out.every((l) => visibleWidth(l) <= 25));
});

test('renderCard shows a speech bubble and ASK status when agent asks', () => {
  const base = { kind: 'claude', pid: 1, name: 'p', state: 'sleeping', cpu: 0, sessionSec: 125 };
  const plain = renderCard(base, 0);
  const asking = renderCard({ ...base, question: 'Want me to open a pull request now?' }, 0);
  assert.equal(plain.length, asking.length, 'cards keep the same height');
  const text = asking.join('\n');
  assert.ok(text.includes('╭') && text.includes('╯'));
  assert.ok(text.includes('Want me to'));
  assert.ok(text.includes('ASK'));
  assert.ok(plain.join('').includes('2m'), 'shows session time');
  assert.equal(new Set(asking.map(visibleWidth)).size, 1);
});

test('wrapText splits into lines no wider than width, ellipsis on overflow', () => {
  assert.deepEqual(wrapText('one two three four', 9, 2), ['one two', 'three fo…']);
  assert.deepEqual(wrapText('short', 9, 2), ['short']);
});

test('renderCard shows idle time, or "active now" when working', () => {
  const base = { kind: 'opencode', pid: 1, name: 'p', cpu: 50, sessionSec: 60 };
  assert.ok(renderCard({ ...base, state: 'sleeping', idleSec: 3 * 3600 + 600 }, 0).join('').includes('idle 3h10m'));
  assert.ok(renderCard({ ...base, state: 'working', idleSec: 0 }, 0).join('').includes('active now'));
});

test('formatDuration switches to days past 48h', () => {
  assert.equal(formatDuration(125), '2m');
  assert.equal(formatDuration(3 * 3600 + 300), '3h05m');
  assert.equal(formatDuration(150 * 3600), '6d06h');
});

const SAND = '38;2;222;196;140';
const cardWidth = (lines) => new Set(lines.map(visibleWidth));

test('renderCard keeps a fixed size for every mood, transition and decay level', () => {
  const base = { kind: 'claude', pid: 3, name: 'p', cpu: 70, sessionSec: 60 };
  const moods = [
    { state: 'working' }, { state: 'sleeping', idleSec: 2 * 3600 }, { state: 'sleeping', idleSec: 7 * 3600 },
    { state: 'sleeping', idleSec: 30 * 3600 }, { state: 'sleeping', question: 'Allow Bash?' },
  ];
  const motions = [undefined, ...['wake', 'yawn', 'done'].map((t) => ({ transition: t, age: 1, pos: 4 }))];
  for (const kind of ['claude', 'opencode']) {
    for (const m of moods) {
      for (const motion of motions) {
        for (const tick of [0, 1, 2, 3, 23]) {
          const lines = renderCard({ ...base, kind, ...m }, tick, motion);
          assert.deepEqual([...cardWidth(lines)], [CARD_WIDTH], `${kind} ${JSON.stringify(m)} ${motion?.transition}`);
          assert.equal(lines.length, 14);
        }
      }
    }
  }
});

test('working agents scuttle sideways as their walk position changes', () => {
  const agent = { kind: 'claude', pid: 1, name: 'p', state: 'working', cpu: 70, sessionSec: 60 };
  const lead = (motion) => renderCard(agent, 0, motion)[5].match(/^ */)[0].length;
  assert.equal(lead({ transition: null, age: 0, pos: 0 }), 0);
  assert.equal(lead({ transition: null, age: 0, pos: 3 }), 3);
});

test('agents idle a full day get buried in sand, short naps do not', () => {
  const base = { kind: 'claude', pid: 1, name: 'p', state: 'sleeping', cpu: 0, sessionSec: 60 };
  assert.ok(renderCard({ ...base, idleSec: 30 * 3600 }, 0).join('').includes(SAND));
  assert.ok(!renderCard({ ...base, idleSec: 60 }, 0).join('').includes(SAND));
});

test('agentArt widens with the walking range', () => {
  const agent = { kind: 'opencode', pid: 1, name: 'p', state: 'working', cpu: 70 };
  const lines = agentArt(agent, 0, undefined, 10);
  assert.equal(lines.length, 5);
  assert.deepEqual([...cardWidth(lines)], [28]);
});
