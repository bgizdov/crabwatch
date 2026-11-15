// Pixel sprites. '.' is transparent, other chars map to palette colors.

const CRAB_PALETTE = { o: [217, 119, 87], k: [20, 20, 20] };
const BOT_PALETTE = {
  g: [170, 178, 190], d: [40, 46, 60], c: [80, 230, 255], x: [90, 100, 120],
  a: [255, 210, 70], r: [255, 90, 90],
};

const WEB_PALETTE = {
  g: [150, 120, 220], b: [30, 30, 70], w: [80, 230, 255], c: [120, 220, 160],
  a: [255, 210, 70], x: [90, 100, 120],
};

export const SPRITES = {
  claude: {
    width: 14,
    height: 10,
    palette: CRAB_PALETTE,
    frames: {
      working: [
        ['..............', '..oooooooooo..', '..ookooookoo..', 'o.ookooookoo.o', 'oooooooooooooo',
          '..oooooooooo..', '..oooooooooo..', '..o.o....o.o..', '..o.o....o.o..', '..............'],
        ['..............', '..oooooooooo..', '..ookooookoo..', '..ookooookoo..', 'oooooooooooooo',
          'o.oooooooooo.o', '..oooooooooo..', '...o.o..o.o...', '...o.o..o.o...', '..............'],
      ],
      sleeping: [
        ['..............', '..............', '..oooooooooo..', '..oooooooooo..', '..okkooookko..',
          'oooooooooooooo', 'o.oooooooooo.o', '..oooooooooo..', '..o.o....o.o..', '..o.o....o.o..'],
        ['..............', '..oooooooooo..', '..oooooooooo..', '..okkooookko..', 'oooooooooooooo',
          'o.oooooooooo.o', '..oooooooooo..', '..oooooooooo..', '..o.o....o.o..', '..o.o....o.o..'],
      ],
      // both claws up / both claws out: waving for attention or celebrating
      wave: [
        ['o............o', 'o.oooooooooo.o', 'ooookooookoooo', '..ookooookoo..', '..oooooooooo..',
          '..oooooooooo..', '..oooooooooo..', '..o.o....o.o..', '..o.o....o.o..', '..............'],
        ['..............', '..oooooooooo..', '..ookooookoo..', 'o.ookooookoo.o', 'oooooooooooooo',
          '..oooooooooo..', '..oooooooooo..', '..o.o....o.o..', '..o.o....o.o..', '..............'],
      ],
      yawn: [
        ['..............', '..oooooooooo..', '..okkooookko..', '..ooookkoooo..', 'oooooooooooooo',
          'o.oooooooooo.o', '..oooooooooo..', '..oooooooooo..', '..o.o....o.o..', '..o.o....o.o..'],
      ],
      // asleep, but one eye peeks open
      peek: [
        ['..............', '..oooooooooo..', '..oooooookoo..', '..okkooookoo..', 'oooooooooooooo',
          'o.oooooooooo.o', '..oooooooooo..', '..oooooooooo..', '..o.o....o.o..', '..o.o....o.o..'],
      ],
    },
  },
  opencode: {
    width: 14,
    height: 10,
    palette: BOT_PALETTE,
    frames: {
      working: [
        ['......a.......', '......g.......', '..gggggggggg..', '..gddddddddg..', '..gdcdddcddg..', '..gddddddddg..', 'g.gggggggggg..', '.g.gggggggg.g.', '...gg....gg...', '...gg....gg...'],
        ['......r.......', '......g.......', '..gggggggggg..', '..gddddddddg..', '..gddcdddcdg..', '..gddddddddg..', '..gggggggggg.g', '.g.gggggggg.g.', '...gg....gg...', '...gg....gg...'],
      ],
      sleeping: [
        ['..............', '......x.......', '..gggggggggg..', '..gddddddddg..', '..gddddddddg..', '..gdxxddxxdg..', '..gggggggggg..', '.g.gggggggg.g.', '...gg....gg...', '...gg....gg...'],
      ],
      wave: [
        ['......a.......', 'g.....g......g', 'g.gggggggggg.g', '.ggddddddddgg.', '..gdcdddcddg..', '..gddddddddg..', '..gggggggggg..', '...gggggggg...', '...gg....gg...', '...gg....gg...'],
        ['......r.......', '......g.......', '..gggggggggg..', '..gddddddddg..', '..gdcdddcddg..', '..gddddddddg..', 'g.gggggggggg.g', '.g.gggggggg.g.', '...gg....gg...', '...gg....gg...'],
      ],
      yawn: [
        ['..............', '......x.......', '..gggggggggg..', '..gddddddddg..', '..gdxxddxxdg..', '..gddddcdddg..', '..gggggggggg..', '.g.gggggggg.g.', '...gg....gg...', '...gg....gg...'],
      ],
      peek: [
        ['..............', '......x.......', '..gggggggggg..', '..gddddddddg..', '..gddddddcdg..', '..gdxxdddddg..', '..gggggggggg..', '.g.gggggggg.g.', '...gg....gg...', '...gg....gg...'],
      ],
    },
  },
  // `opencode serve`: a purple screen-faced bot broadcasting to the web UI.
  'opencode-web': {
    width: 14,
    height: 10,
    palette: WEB_PALETTE,
    frames: {
      working: [
        ['.c....aa....c.', 'c.....gg.....c', '..gggggggggg..', '..gbbbbbbbbg..', '..gbwbbbbwbg..', '..gbbwwwwbbg..', '..gggggggggg..', '.g.gggggggg.g.', '...gg....gg...', '...gg....gg...'],
        ['c.....aa.....c', '.c....gg....c.', '..gggggggggg..', '..gbbbbbbbbg..', '..gbwbbbbwbg..', '..gbbwwwwbbg..', 'g.gggggggggg.g', '...gggggggg...', '...gg....gg...', '...gg....gg...'],
      ],
      sleeping: [
        ['..............', '......xx......', '..gggggggggg..', '..gbbbbbbbbg..', '..gbbbbbbbbg..', '..gbxxbbxxbg..', '..gggggggggg..', '.g.gggggggg.g.', '...gg....gg...', '...gg....gg...'],
      ],
      wave: [
        ['......aa......', 'g.....gg.....g', 'g.gggggggggg.g', '.ggbbbbbbbbgg.', '..gbwbbbbwbg..', '..gbbwwwwbbg..', '..gggggggggg..', '...gggggggg...', '...gg....gg...', '...gg....gg...'],
        ['c.....aa.....c', '.c....gg....c.', '..gggggggggg..', '..gbbbbbbbbg..', '..gbwbbbbwbg..', '..gbbwwwwbbg..', 'g.gggggggggg.g', '.g.gggggggg.g.', '...gg....gg...', '...gg....gg...'],
      ],
      yawn: [
        ['..............', '......xx......', '..gggggggggg..', '..gbbbbbbbbg..', '..gbxxbbxxbg..', '..gbbbwwbbbg..', '..gggggggggg..', '.g.gggggggg.g.', '...gg....gg...', '...gg....gg...'],
      ],
      peek: [
        ['..............', '......xx......', '..gggggggggg..', '..gbbbbbbbbg..', '..gbbbbbbwbg..', '..gbxxbbbbbg..', '..gggggggggg..', '.g.gggggggg.g.', '...gg....gg...', '...gg....gg...'],
      ],
    },
  },
};

// Idle-decay layers drawn over a sprite. A web only fills empty pixels; sand buries the agent.
export const OVERLAY_PALETTE = {
  w: [205, 205, 220], p: [190, 120, 230], s: [222, 196, 140], S: [190, 160, 105],
};
const BLANK = '..............';
export const OVERLAYS = {
  web: [
    ['wwww........w.', 'ww.w........w.', 'w...........p.', BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK],
    ['wwww........w.', 'ww.w........w.', 'w...........w.', '............p.', BLANK, BLANK, BLANK, BLANK, BLANK, BLANK],
  ],
  sand: [BLANK, BLANK, BLANK, BLANK, BLANK, '.....sss......', '...ssssSss....', '.ssSsssssssss.', 'ssssssssSsssss', 'sssSssssssssSs'],
};

export function spriteFrame(kind, state, tick) {
  const frames = SPRITES[kind].frames[state];
  return frames[tick % frames.length];
}
