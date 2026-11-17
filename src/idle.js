// Idle time: how long since an agent last did anything.
import { moodOf } from './motion.js';

// Measured from real activity (messages, status changes), so brief CPU spikes from an
// idle TUI don't reset it. CPU-based "working" only counts when activity is unknown.
export function idleSeconds(agent, nowMs) {
  if (agent.busy) return 0;
  if (agent.lastActivityMs != null) return Math.max(0, (nowMs - agent.lastActivityMs) / 1000);
  return agent.state === 'working' ? 0 : null;
}

// Agents with unknown idle time, and agents waiting on you, are always shown.
// maxIdleSec <= 0 disables hiding.
export function visibleAgents(agents, maxIdleSec) {
  if (!(maxIdleSec > 0)) return { shown: agents, hidden: 0 };
  const shown = agents.filter((a) => a.question || a.idleSec == null || a.idleSec <= maxIdleSec);
  return { shown, hidden: agents.length - shown.length };
}

// Latest user/assistant message time in a Claude transcript. Other entry types
// (summaries, snapshots, metadata) are written in the background and don't count.
export function lastMessageMs(entries) {
  const times = entries
    .filter((e) => (e.type === 'user' || e.type === 'assistant') && e.timestamp)
    .map((e) => Date.parse(e.timestamp))
    .filter(Number.isFinite);
  return times.length ? Math.max(...times) : null;
}

const STALE_BUSY_MS = 30 * 60 * 1000;

// opencode session_v2 rows carry time_busy / time_idle. Returns true/false, or undefined
// when unknown (legacy session table) or when a busy flag looks stale (e.g. crashed mid-turn),
// so callers fall back to CPU.
export function opencodeBusy(row, nowMs) {
  if (!('time_busy' in row) && !('time_idle' in row)) return undefined;
  const busy = row.time_busy != null && (row.time_idle == null || row.time_busy > row.time_idle);
  if (busy && nowMs - (row.time_updated ?? 0) > STALE_BUSY_MS) return undefined;
  return busy;
}

const ATTENTION = { asking: 0, working: 1, sleeping: 2 };

// Sort order for cards and the beach: agents waiting on you first, then working, then
// sleeping. Kind and PID keep the order stable inside each group.
export function byAttention(a, b) {
  return (ATTENTION[moodOf(a)] ?? 3) - (ATTENTION[moodOf(b)] ?? 3)
    || a.kind.localeCompare(b.kind)
    || a.pid - b.pid;
}
