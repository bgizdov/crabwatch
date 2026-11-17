import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPRITES, spriteFrame } from '../src/sprites.js';
import {
  toHalfBlocks, visibleWidth, renderCard, layout, wrapText, formatDuration, agentArt, CARD_WIDTH, cut, charWidth,
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
  for (const kind of ['claude', 'opencode', 'opencode-web']) {
    for (const m of moods) {
      for (const motion of motions) {
        for (const tick of [0, 1, 2, 3, 23]) {
          const lines = renderCard({ ...base, kind, ...m }, tick, motion);
          assert.deepEqual([...cardWidth(lines)], [CARD_WIDTH], `${kind} ${JSON.stringify(m)} ${motion?.transition}`);
          assert.equal(lines.length, 16);
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

test('renderCard labels the opencode web server bot with its own sprite', () => {
  const agent = { kind: 'opencode-web', pid: 7, name: 'quiet-panda', state: 'working', cpu: 10, sessionSec: 60, idleSec: 0 };
  const text = renderCard(agent, 0).join('');
  assert.ok(text.includes('oc web'));
  assert.ok(text.includes('quiet-panda'));
  assert.notDeepEqual(spriteFrame('opencode-web', 'working', 0), spriteFrame('opencode', 'working', 0));
});

test('renderCard shows the session title, truncated, and keeps a blank line without one', () => {
  const base = { kind: 'claude', pid: 1, name: 'proj', state: 'working', cpu: 9, sessionSec: 60, idleSec: 0 };
  const titled = renderCard({ ...base, title: 'Missing OpenCode sessions in devcontainer-setup' }, 0);
  const plain = titled.map((l) => l.replace(/\x1b\[[0-9;]*m/g, ''));
  assert.ok(plain.some((l) => l.startsWith('Missing OpenCode') && l.includes('…')));
  assert.equal(new Set(titled.map(visibleWidth)).size, 1);
  assert.equal(renderCard(base, 0).length, titled.length, 'same height with or without a title');
});

test('renderCard shows the model when known and keeps the same height', () => {
  const base = { kind: 'claude', pid: 1, name: 'p', state: 'sleeping', cpu: 0, sessionSec: 125 };
  const without = renderCard(base, 0);
  const withModel = renderCard({ ...base, model: 'claude-opus-5-5' }, 0);
  assert.equal(without.length, withModel.length);
  assert.ok(withModel.join('\n').includes('opus-5-5'));
  assert.ok(!withModel.join('\n').includes('claude-opus'));
  assert.equal(new Set(withModel.map(visibleWidth)).size, 1);
  const long = renderCard({ ...base, model: 'x'.repeat(60) }, 0);
  assert.equal(new Set(long.map(visibleWidth)).size, 1);
});

const LONE_SURROGATE = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;

test('charWidth counts wide CJK and emoji as 2 and joiners as 0', () => {
  const w = (s) => charWidth(s.codePointAt(0));
  assert.equal(w('a'), 1);
  assert.equal(w('修'), 2);
  assert.equal(w('の'), 2);
  assert.equal(w('한'), 2);
  assert.equal(w('Ａ'), 2);
  assert.equal(w('🚀'), 2);
  assert.equal(w('‍'), 0);
  assert.equal(w('️'), 0);
  assert.equal(w('́'), 0);
  // narrow symbols the dashboard itself draws stay 1 column
  for (const s of ['▀', '▄', '╭', '─', '▶', '☾', '…', '·']) assert.equal(w(s), 1, s);
});

test('visibleWidth measures terminal columns, ignoring ANSI codes', () => {
  assert.equal(visibleWidth('修复'), 4);
  assert.equal(visibleWidth('🚀'), 2);
  assert.equal(visibleWidth('\x1b[38;2;1;2;3mabc\x1b[0m'), 3);
  assert.equal(visibleWidth('é'), 1);
});

test('cut fits wide text into the width and never splits a surrogate pair', () => {
  assert.equal(cut('short', 10), 'short');
  assert.equal(cut('abcdefghij', 5), 'abcd…');
  const cjk = cut('修复登录页面的错误并添加测试用例', 23);
  assert.ok(visibleWidth(cjk) <= 23, `${cjk} is ${visibleWidth(cjk)}`);
  assert.ok(cjk.endsWith('…'));
  const emoji = cut('Ship it! 🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀', 23);
  assert.ok(!LONE_SURROGATE.test(emoji), JSON.stringify(emoji));
  assert.ok(visibleWidth(emoji) <= 23);
  assert.equal(cut('修复', 4), '修复');
});

test('wrapText keeps CJK and emoji lines within the width', () => {
  const lines = wrapText('要不要我现在打开一个拉取请求并运行所有测试？', 20, 2);
  assert.ok(lines.every((l) => visibleWidth(l) <= 20), JSON.stringify(lines));
  const emoji = wrapText('Deploy 🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀 now?', 10, 2);
  assert.ok(emoji.every((l) => visibleWidth(l) <= 10 && !LONE_SURROGATE.test(l)), JSON.stringify(emoji));
});

test('renderCard keeps every line CARD_WIDTH columns for CJK and emoji text', () => {
  const agent = {
    kind: 'claude', pid: 1, name: '项目-仓库-名字-很长-很长', state: 'sleeping', cpu: 0, sessionSec: 60, idleSec: 0,
    title: '修复登录页面的错误并添加测试用例', question: '要不要我现在打开一个拉取请求？ 🚀🚀',
  };
  const lines = renderCard(agent, 0);
  assert.deepEqual([...new Set(lines.map(visibleWidth))], [CARD_WIDTH]);
  assert.ok(lines.every((l) => !LONE_SURROGATE.test(l)));
});
