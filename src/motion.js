// Per-agent motion state: where each crab has walked to, and short one-off scenes
// (wake-up, yawn, celebration) played when its mood changes.

export const TRANSITION_TICKS = 8; // 2s at 250ms per frame

const HOUR = 3600;

export function moodOf(agent) {
  return agent.question ? 'asking' : agent.state;
}

export function transitionFor(from, to) {
  if (!from || from === to) return null;
  if (to === 'asking') return 'done';
  if (to === 'working') return 'wake';
  if (to === 'sleeping' && from === 'working') return 'yawn';
  return null;
}

// Character steps per frame: busier agents scuttle faster.
export function walkSpeed(cpu) {
  if (cpu >= 60) return 1;
  if (cpu >= 25) return 0.5;
  return 0.25;
}

export function pingPong(step, range) {
  if (range <= 0) return 0;
  const period = 2 * range;
  const p = ((step % period) + period) % period;
  return p <= range ? p : period - p;
}

// 0 clean, 1 seaweed (1h), 2 cobweb + spider (6h), 3 half buried in sand (24h).
export function decayLevel(idleSec, mood) {
  if (mood === 'working' || idleSec == null) return 0;
  if (idleSec >= 24 * HOUR) return 3;
  if (idleSec >= 6 * HOUR) return 2;
  if (idleSec >= HOUR) return 1;
  return 0;
}

export const motionKey = (agent) => `${agent.kind}:${agent.pid}`;

export function stepMotion(prev, agents, tick) {
  const next = new Map();
  for (const agent of agents) {
    const key = motionKey(agent);
    const old = prev.get(key);
    const mood = moodOf(agent);
    const walked = mood === 'working' ? walkSpeed(agent.cpu ?? 0) : 0;
    if (!old) {
      next.set(key, { mood, since: tick, transition: null, pos: (agent.pid % 12) + walked });
      continue;
    }
    const changed = old.mood !== mood;
    next.set(key, {
      mood,
      since: changed ? tick : old.since,
      transition: changed ? transitionFor(old.mood, mood) : old.transition,
      pos: old.pos + walked,
    });
  }
  return next;
}

// Agents that changed into asking since the previous sample. Agents seen for the first
// time (including everything on the first sample) are skipped: they were not seen changing.
export function newlyAsking(prevAgents, agents) {
  if (!prevAgents) return [];
  const before = new Map(prevAgents.map((a) => [motionKey(a), moodOf(a)]));
  return agents.filter((a) => {
    const was = before.get(motionKey(a));
    return was !== undefined && was !== 'asking' && moodOf(a) === 'asking';
  });
}

export const BELL = '\x07';

// The terminal bell to write after a sample: one per sample, however many agents started asking.
export function bellFor(enabled, prevAgents, agents) {
  return enabled && newlyAsking(prevAgents, agents).length > 0 ? BELL : '';
}

export function motionView(m, tick) {
  if (!m) return { transition: null, age: 0, pos: 0 };
  const age = tick - m.since;
  return {
    transition: m.transition && age < TRANSITION_TICKS ? m.transition : null,
    age,
    pos: Math.floor(m.pos),
  };
}
