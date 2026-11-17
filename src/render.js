// Turns pixel grids into ANSI half-block text and lays out agent cards.
import { SPRITES, spriteFrame, OVERLAYS, OVERLAY_PALETTE } from './sprites.js';
import { moodOf, decayLevel, pingPong } from './motion.js';
import { shortModel } from './model.js';

const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
export const fg = ([r, g, b]) => `${ESC}38;2;${r};${g};${b}m`;
export const bg = ([r, g, b]) => `${ESC}48;2;${r};${g};${b}m`;
const dimColor = (c) => c.map((v) => Math.round(v * 0.5));

export const CARD_WIDTH = 24;
const FX_WIDTH = 4;

const ZERO_WIDTH = /^[\p{M}​-‏︀-️]$/u;
const WIDE_EMOJI = /^\p{Emoji_Presentation}$/u;
// East Asian Wide/Fullwidth blocks: Hangul Jamo, CJK + kana, Hangul syllables,
// CJK compatibility, fullwidth forms, and the supplementary ideograph planes.
const WIDE_RANGES = [
  [0x1100, 0x115f], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff],
  [0xa000, 0xa4cf], [0xa960, 0xa97f], [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe4f],
  [0xff00, 0xff60], [0xffe0, 0xffe6], [0x20000, 0x3fffd],
];

// Terminal columns taken by one code point. Emoji count as wide only when they default
// to emoji presentation, so text symbols like ▶ and ☾ stay one column.
export function charWidth(cp) {
  const ch = String.fromCodePoint(cp);
  if (ZERO_WIDTH.test(ch)) return 0;
  if (WIDE_EMOJI.test(ch) || WIDE_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi)) return 2;
  return 1;
}

const stringWidth = (s) => [...s].reduce((w, ch) => w + charWidth(ch.codePointAt(0)), 0);

export function visibleWidth(s) {
  return stringWidth(s.replace(/\x1b\[[0-9;]*m/g, ''));
}

export function pad(s, width) {
  return s + ' '.repeat(Math.max(0, width - visibleWidth(s)));
}

// Longest prefix of whole characters that fits in `width` columns.
function take(s, width) {
  let out = '';
  let used = 0;
  for (const ch of s) {
    const w = charWidth(ch.codePointAt(0));
    if (used + w > width) break;
    out += ch;
    used += w;
  }
  return out;
}

export function cut(s, width) {
  return stringWidth(s) > width ? `${take(s, width - 1)}…` : s;
}

export function toHalfBlocks(grid, palette, dim = false) {
  const color = (ch) => {
    if (ch === '.' || !palette[ch]) return null;
    return dim ? dimColor(palette[ch]) : palette[ch];
  };
  const lines = [];
  for (let y = 0; y < grid.length; y += 2) {
    const top = grid[y];
    const bottom = grid[y + 1] ?? '.'.repeat(top.length);
    let line = '';
    for (let x = 0; x < top.length; x += 1) {
      const t = color(top[x]);
      const b = color(bottom[x]);
      if (t && b) line += `${fg(t)}${bg(b)}▀${RESET}`;
      else if (t) line += `${fg(t)}▀${RESET}`;
      else if (b) line += `${fg(b)}▄${RESET}`;
      else line += ' ';
    }
    lines.push(line);
  }
  return lines;
}

export function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h >= 48) return `${Math.floor(h / 24)}d${String(h % 24).padStart(2, '0')}h`;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function idleLine(agent) {
  if (agent.state === 'working' && !agent.question) return `${fg(GREEN)}active now${RESET}`;
  if (agent.idleSec == null) return `${fg(GRAY)}idle ?${RESET}`;
  return `${fg(GRAY)}idle ${formatDuration(agent.idleSec)}${RESET}`;
}

export const GREEN = [110, 220, 120];
export const BLUE = [120, 150, 255];
export const GRAY = [130, 130, 140];
export const YELLOW = [255, 210, 70];
export const WHITE = [235, 235, 240];
const SEAWEED = [60, 170, 110];
const CONFETTI = [[255, 90, 90], [255, 210, 70], [110, 220, 120], [80, 230, 255], [220, 120, 255]];

export function wrapText(text, width, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let i = 0;
  while (i < words.length && lines.length < maxLines) {
    let line = take(words[i], width);
    i += 1;
    while (i < words.length && stringWidth(line) + 1 + stringWidth(words[i]) <= width) {
      line += ` ${words[i]}`;
      i += 1;
    }
    lines.push(line);
  }
  if (i < words.length) {
    const rest = `${lines.pop()} ${words.slice(i).join(' ')}`;
    lines.push(`${take(rest, width - 1)}…`);
  }
  return lines;
}

export const BUBBLE_ROWS = 4;

export function bubble(question, tick, inner = CARD_WIDTH - 4) {
  if (!question) return Array(BUBBLE_ROWS).fill('');
  const border = fg(tick % 4 < 2 ? YELLOW : [200, 160, 50]);
  const lines = wrapText(question, inner, 2);
  const body = [lines[0] ?? '', lines[1] ?? ''].map((l) => `${border}│${RESET} ${fg(WHITE)}${pad(l, inner)}${RESET}${border}│${RESET}`);
  return [
    `${border}╭${'─'.repeat(inner + 1)}╮${RESET}`,
    ...body,
    `${border}╰──┬${'─'.repeat(inner - 2)}╯${RESET}`,
  ];
}

const NO_MOTION = { transition: null, age: 0, pos: 0 };

function shiftDown(grid, dy) {
  if (dy <= 0) return grid;
  const blank = '.'.repeat(grid[0].length);
  return [...Array(dy).fill(blank), ...grid.slice(0, grid.length - dy)];
}

// Paints overlay pixels on top of a grid. Unless forced, only empty pixels are painted.
function overlay(grid, layer, force = false) {
  return grid.map((row, y) => [...row].map((ch, x) => {
    const o = layer[y][x];
    return o !== '.' && (force || ch === '.') ? o : ch;
  }).join(''));
}

function pose(agent, mood, motion, tick) {
  const frames = SPRITES[agent.kind].frames;
  const wave = (i, dy) => ({ grid: frames.wave[i], dy });
  switch (motion.transition) {
    case 'wake': return wave(0, tick % 2);
    case 'done': return tick % 2 ? wave(0, 0) : wave(1, 1);
    case 'yawn': if (motion.age < 5) return { grid: frames.yawn[0], dy: 0 }; break;
    default: break;
  }
  if (mood === 'asking') return tick % 4 < 2 ? wave(0, 0) : wave(1, 1);
  if (mood === 'working') return { grid: spriteFrame(agent.kind, 'working', tick), dy: 0 };
  if (tick % 24 >= 22) return { grid: frames.peek[0], dy: 0 };
  return { grid: spriteFrame(agent.kind, 'sleeping', Math.floor(tick / 4)), dy: 0 };
}

function confetti(tick, row) {
  let out = '';
  for (let c = 0; c < FX_WIDTH; c += 1) {
    const h = (tick * 7 + row * 13 + c * 5) % 11;
    out += h < 3 ? `${fg(CONFETTI[(h + row + c + tick) % CONFETTI.length])}${'*+·'[h]}${RESET}` : ' ';
  }
  return out;
}

function baseFx(mood, motion, tick, row) {
  if (motion.transition === 'wake') return row === 0 && tick % 2 === 0 ? `${fg(YELLOW)}${BOLD}  ! ${RESET}` : '    ';
  if (motion.transition === 'done') return confetti(tick, row);
  if (motion.transition === 'yawn' && motion.age < 5) {
    return row === 1 ? `${fg(BLUE)}  ${motion.age < 2 ? 'o' : 'O'} ${RESET}` : '    ';
  }
  if (mood === 'asking') return row === 1 && tick % 4 < 2 ? `${fg(YELLOW)}${BOLD} !  ${RESET}` : '    ';
  if (mood === 'sleeping') {
    const zs = ['   z', '  Z ', ' z  ', '    ', '    '];
    return `${fg(BLUE)}${zs[(row - (Math.floor(tick / 2) % 4) + 8) % 5]}${RESET}`;
  }
  const sparks = ['*   ', '  + ', ' *  ', '   +'];
  return row < 2 ? `${fg(YELLOW)}${sparks[(tick + row) % 4]}${RESET}` : '    ';
}

function sideFx(mood, motion, tick, row, decay) {
  if (decay >= 1 && !motion.transition && row >= 3) {
    const sway = (Math.floor(tick / 4) + row) % 2;
    return `${fg(SEAWEED)}${sway ? ' ) (' : ' ( )'}${RESET}`;
  }
  return baseFx(mood, motion, tick, row);
}

// The agent's 5 text rows: sprite at its walk offset plus side effects, (18 + range) wide.
export function agentArt(agent, tick, motion = NO_MOTION, range = CARD_WIDTH - 14 - FX_WIDTH) {
  const sprite = SPRITES[agent.kind];
  const mood = moodOf(agent);
  const decay = decayLevel(agent.idleSec, mood);
  const { grid, dy } = pose(agent, mood, motion, tick);
  let pixels = shiftDown(grid, dy);
  if (decay >= 2) pixels = overlay(pixels, OVERLAYS.web[Math.floor(tick / 4) % 2]);
  if (decay >= 3) pixels = overlay(pixels, OVERLAYS.sand, true);
  const dim = mood === 'sleeping' && !motion.transition;
  const spriteColors = Object.fromEntries(Object.entries(sprite.palette).map(([k, c]) => [k, dim ? dimColor(c) : c]));
  const art = toHalfBlocks(pixels, { ...OVERLAY_PALETTE, ...spriteColors });
  const offset = pingPong(motion.pos, range);
  return art.map((line, row) => ' '.repeat(offset) + line + sideFx(mood, motion, tick, row, decay) + ' '.repeat(range - offset));
}

export function statusLine(agent, tick) {
  if (agent.question) return `${fg(YELLOW)}? ASKS YOU${RESET}`;
  if (agent.state === 'working') return `${fg(GREEN)}▶ WORK ${agent.cpu.toFixed(0).padStart(3)}%${RESET}`;
  return `${fg(BLUE)}☾ SLEEP ${'.'.repeat(1 + (Math.floor(tick / 2) % 3))}${RESET}`;
}

const LABELS = { claude: 'clawd', opencode: 'opencode', 'opencode-web': 'oc web' };
export const agentLabel = (agent) => LABELS[agent.kind] ?? agent.kind;

export function renderCard(agent, tick, motion = NO_MOTION) {
  return [
    ...bubble(agent.question, tick).map((l) => pad(l, CARD_WIDTH)),
    ...agentArt(agent, tick, motion).map((l) => pad(l, CARD_WIDTH)),
    pad(`${agentLabel(agent)} ${fg(GRAY)}#${agent.pid}${RESET}`, CARD_WIDTH),
    pad(cut(agent.name || '-', CARD_WIDTH - 1), CARD_WIDTH),
    pad(agent.title ? `${fg(GRAY)}${cut(agent.title, CARD_WIDTH - 1)}${RESET}` : '', CARD_WIDTH),
    pad(`${fg(GRAY)}${cut(shortModel(agent.model) ?? '', CARD_WIDTH - 1)}${RESET}`, CARD_WIDTH),
    pad(statusLine(agent, tick), CARD_WIDTH),
    pad(`${fg(GRAY)}session ${formatDuration(agent.sessionSec ?? 0)}${RESET}`, CARD_WIDTH),
    pad(idleLine(agent), CARD_WIDTH),
  ];
}

export function layout(cards, termWidth, gap = 2) {
  if (cards.length === 0) return [];
  const cardWidth = visibleWidth(cards[0][0]);
  const perRow = Math.max(1, Math.floor((termWidth + gap) / (cardWidth + gap)));
  const lines = [];
  for (let i = 0; i < cards.length; i += perRow) {
    const row = cards.slice(i, i + perRow);
    const height = Math.max(...row.map((c) => c.length));
    for (let y = 0; y < height; y += 1) {
      lines.push(row.map((c) => c[y] ?? ' '.repeat(cardWidth)).join(' '.repeat(gap)));
    }
    if (i + perRow < cards.length) lines.push('');
  }
  return lines.filter((l, idx, arr) => !(l === '' && idx === arr.length - 1));
}
