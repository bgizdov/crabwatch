// A plain-data snapshot of the agents for --json: same order and hiding as the dashboard.
import { visibleAgents, byAttention } from './idle.js';
import { moodOf } from './motion.js';

const orNull = (v) => (v === undefined ? null : v);
const roundTo = (v, digits) => (typeof v === 'number' ? Number(v.toFixed(digits)) : null);

function agentView(a) {
  return {
    kind: a.kind,
    pid: a.pid,
    name: orNull(a.name),
    title: orNull(a.title),
    model: orNull(a.model),
    mood: moodOf(a),
    state: orNull(a.state),
    question: orNull(a.question),
    cpu: roundTo(a.cpu, 1),
    sessionSec: roundTo(a.sessionSec, 0),
    idleSec: roundTo(a.idleSec, 0),
  };
}

export function snapshot(agents, maxIdleSec) {
  const { shown, hidden } = visibleAgents(agents, maxIdleSec);
  const list = [...shown].sort(byAttention).map(agentView);
  const count = (mood) => list.filter((a) => a.mood === mood).length;
  return {
    counts: { asking: count('asking'), working: count('working'), sleeping: count('sleeping'), hidden },
    agents: list,
  };
}
