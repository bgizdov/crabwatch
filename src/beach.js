// Beach view: every agent on one shared strip of sand, wandering under drifting clouds.
import {
  agentArt, bubble, statusLine, idleLine, agentLabel, pad, cut, fg, bg, BUBBLE_ROWS, WHITE,
} from './render.js';
import { motionView, motionKey } from './motion.js';

const RESET = '\x1b[0m';
const MIN_SLOT = 22;
const ART_MIN = 18; // sprite (14) + side effects (4)
const SAND = [222, 196, 140];
const SAND_TEXT = [70, 50, 25];
const SEA = [30, 90, 160];
const FOAM = [170, 210, 255];
const CLOUD = ['  .--.  ', '.(    ).'];

function placeClouds(width, tick, row) {
  const cells = Array(width).fill(' ');
  const span = width + CLOUD[0].length;
  for (const shift of [0, Math.floor(span / 2)]) {
    const x0 = ((Math.floor(tick / 3) + shift) % span) - CLOUD[0].length;
    [...CLOUD[row]].forEach((ch, i) => {
      const x = x0 + i;
      if (x >= 0 && x < width && ch !== ' ') cells[x] = ch;
    });
  }
  return `${fg(WHITE)}${cells.join('')}${RESET}`;
}

function center(text, width) {
  const t = cut(text, width - 2);
  const left = Math.floor((width - t.length) / 2);
  return ' '.repeat(left) + t + ' '.repeat(width - left - t.length);
}

function waves(width, tick, row) {
  const pattern = row ? ' ~   ~~ ' : '~~ ~  ~ ';
  const dir = row ? -1 : 1;
  let line = '';
  for (let x = 0; x < width; x += 1) {
    const i = (((x - dir * tick) % pattern.length) + pattern.length) % pattern.length;
    line += pattern[i];
  }
  return `${bg(SEA)}${fg(FOAM)}${line}${RESET}`;
}

function strip(agents, motions, tick, width, slot) {
  const used = slot * agents.length;
  const rest = ' '.repeat(Math.max(0, width - used));
  const row = (cell) => agents.map((a) => pad(cell(a), slot)).join('') + rest;
  const anim = (a) => tick + a.pid;
  const lines = [];
  for (let y = 0; y < BUBBLE_ROWS; y += 1) {
    lines.push(row((a) => bubble(a.question, anim(a), slot - 4)[y]));
  }
  const arts = agents.map((a) => agentArt(a, anim(a), motionView(motions.get(motionKey(a)), tick), slot - ART_MIN));
  for (let y = 0; y < arts[0].length; y += 1) lines.push(arts.map((art) => art[y]).join('') + rest);
  const names = agents.map((a) => center(a.name || agentLabel(a), slot)).join('') + rest;
  lines.push(`${bg(SAND)}${fg(SAND_TEXT)}${names}${RESET}`);
  lines.push(row((a) => ` ${statusLine(a, anim(a))}`));
  lines.push(row((a) => ` ${idleLine(a)} ${fg([90, 90, 100])}${agentLabel(a)}${RESET}`));
  return lines;
}

export function renderBeach(agents, motions, tick, width) {
  if (agents.length === 0) return [];
  const perRow = Math.max(1, Math.min(agents.length, Math.floor(width / MIN_SLOT)));
  const slot = Math.max(ART_MIN, Math.floor(width / perRow));
  const lines = [placeClouds(width, tick, 0), placeClouds(width, tick, 1)];
  for (let i = 0; i < agents.length; i += perRow) {
    lines.push(...strip(agents.slice(i, i + perRow), motions, tick, width, slot));
  }
  lines.push(waves(width, tick, 0), waves(width, tick, 1));
  return lines;
}
