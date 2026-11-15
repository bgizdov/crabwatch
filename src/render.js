// Turns pixel grids into ANSI half-block text and lays out agent cards.
import { SPRITES, spriteFrame } from './sprites.js';

const ESC = '\x1b[';
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const fg = ([r, g, b]) => `${ESC}38;2;${r};${g};${b}m`;
const bg = ([r, g, b]) => `${ESC}48;2;${r};${g};${b}m`;
const dimColor = (c) => c.map((v) => Math.round(v * 0.5));

export const CARD_WIDTH = 20;

export function visibleWidth(s) {
  return [...s.replace(/\x1b\[[0-9;]*m/g, '')].length;
}

function pad(s, width) {
  return s + ' '.repeat(Math.max(0, width - visibleWidth(s)));
}

function cut(s, width) {
  return s.length > width ? `${s.slice(0, width - 1)}…` : s;
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

function idleLine(agent) {
  if (agent.state === 'working' && !agent.question) return `${fg(GREEN)}active now${RESET}`;
  if (agent.idleSec == null) return `${fg(GRAY)}idle ?${RESET}`;
  return `${fg(GRAY)}idle ${formatDuration(agent.idleSec)}${RESET}`;
}

const GREEN = [110, 220, 120];
const BLUE = [120, 150, 255];
const GRAY = [130, 130, 140];
const YELLOW = [255, 210, 70];
const WHITE = [235, 235, 240];

export function wrapText(text, width, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let i = 0;
  while (i < words.length && lines.length < maxLines) {
    let line = words[i].slice(0, width);
    i += 1;
    while (i < words.length && line.length + 1 + words[i].length <= width) {
      line += ` ${words[i]}`;
      i += 1;
    }
    lines.push(line);
  }
  if (i < words.length) {
    const rest = `${lines.pop()} ${words.slice(i).join(' ')}`;
    lines.push(`${rest.slice(0, width - 1)}…`);
  }
  return lines;
}

const BUBBLE_ROWS = 4;
const BUBBLE_INNER = CARD_WIDTH - 4;

function bubble(question, tick) {
  if (!question) return Array(BUBBLE_ROWS).fill('');
  const border = fg(tick % 4 < 2 ? YELLOW : [200, 160, 50]);
  const lines = wrapText(question, BUBBLE_INNER, 2);
  const body = [lines[0] ?? '', lines[1] ?? ''].map((l) => `${border}│${RESET} ${fg(WHITE)}${pad(l, BUBBLE_INNER)}${RESET}${border}│${RESET}`);
  return [
    `${border}╭${'─'.repeat(BUBBLE_INNER + 1)}╮${RESET}`,
    ...body,
    `${border}╰──┬${'─'.repeat(BUBBLE_INNER - 2)}╯${RESET}`,
  ];
}

function sideFx(agent, tick, row) {
  if (agent.question) {
    return row === 1 && tick % 4 < 2 ? `${fg(YELLOW)}${BOLD} !  ${RESET}` : '    ';
  }
  if (agent.state === 'sleeping') {
    const zs = ['   z', '  Z ', ' z  ', '    ', '    '];
    return `${fg(BLUE)}${zs[(row - (Math.floor(tick / 2) % 4) + 8) % 5]}${RESET}`;
  }
  const sparks = ['*   ', '  + ', ' *  ', '   +'];
  return row < 2 ? `${fg(YELLOW)}${sparks[(tick + row) % 4]}${RESET}` : '    ';
}

function statusLine(agent, tick) {
  if (agent.question) return `${fg(YELLOW)}? ASKS YOU${RESET}`;
  if (agent.state === 'working') return `${fg(GREEN)}▶ WORK ${agent.cpu.toFixed(0).padStart(3)}%${RESET}`;
  return `${fg(BLUE)}☾ SLEEP ${'.'.repeat(1 + (Math.floor(tick / 2) % 3))}${RESET}`;
}

function spriteFor(agent, tick) {
  if (agent.question) return spriteFrame(agent.kind, 'working', 0); // awake, still, waiting
  const sleeping = agent.state === 'sleeping';
  return spriteFrame(agent.kind, agent.state, sleeping ? Math.floor(tick / 4) : tick);
}

export function renderCard(agent, tick) {
  const sprite = SPRITES[agent.kind];
  const dim = agent.state === 'sleeping' && !agent.question;
  const art = toHalfBlocks(spriteFor(agent, tick), sprite.palette, dim);
  const label = agent.kind === 'claude' ? 'clawd' : 'opencode';
  return [
    ...bubble(agent.question, tick).map((l) => pad(l, CARD_WIDTH)),
    ...art.map((line, i) => pad(line + sideFx(agent, tick, i), CARD_WIDTH)),
    pad(`${label} ${fg(GRAY)}#${agent.pid}${RESET}`, CARD_WIDTH),
    pad(cut(agent.name || '-', CARD_WIDTH - 1), CARD_WIDTH),
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
