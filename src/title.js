// Terminal window title (OSC 2) with the asking/working counts, so a background tab,
// tmux window list or window switcher shows when an agent needs you.

// xterm title stack: save the user's title on start and restore it on exit.
export const TITLE_PUSH = '\x1b[22;0t';
export const TITLE_POP = '\x1b[23;0t';

// Same definitions as the dashboard header.
export function countsOf(agents) {
  const asking = agents.filter((a) => a.question).length;
  const working = agents.filter((a) => !a.question && a.state === 'working').length;
  return { asking, working, sleeping: agents.length - asking - working };
}

export function terminalTitle({ asking, working }, demo = false) {
  const parts = [];
  if (asking > 0) parts.push(`${asking} asking`, `${working} working`);
  else if (working > 0) parts.push(`${working} working`);
  parts.push(demo ? 'crabwatch (demo)' : 'crabwatch');
  return `🦀 ${parts.join(' · ')}`;
}

// Control characters would end or corrupt the escape sequence.
export function titleSequence(title) {
  return `\x1b]2;${title.replace(/[\x00-\x1f\x7f]/g, '')}\x07`;
}

// Returns set(title): writes the OSC sequence only when the title differs from the last one.
export function createTitleSetter(write) {
  let last = null;
  return (title) => {
    if (title === last) return;
    last = title;
    write(titleSequence(title));
  };
}
