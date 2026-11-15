// Process discovery and CPU-based work/sleep detection.
import { execFileSync } from 'node:child_process';
import { readFileSync, readlinkSync, existsSync } from 'node:fs';
import { basename } from 'node:path';
import { claudeAgentInfo, createOpencodeReader } from './sessions.js';
import { idleSeconds } from './idle.js';

const KINDS = [
  { kind: 'claude', re: /^claude$/ },
  { kind: 'opencode', re: /^opencode(\.exe)?$/ },
];

export function parsePs(text) {
  return text
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/))
    .filter(Boolean)
    .map(([, pid, ppid, etimes, comm, args]) => ({
      pid: Number(pid), ppid: Number(ppid), etimes: Number(etimes), comm, args,
    }));
}

const CLAUDE_VERSIONED_BINARY = /\/claude\/versions\/[^/\s]+$/;

export function classify(proc) {
  const raw = proc.args.split(/\s+/).slice(0, 2);
  if (CLAUDE_VERSIONED_BINARY.test(raw[0] ?? '')) return 'claude';
  const argv = raw.map((a) => basename(a));
  const names = [proc.comm, ...argv];
  const hit = KINDS.find(({ re }) => names.some((n) => re.test(n)));
  return hit ? hit.kind : null;
}

function descendants(rootPid, childrenOf) {
  const out = [rootPid];
  for (let i = 0; i < out.length; i += 1) {
    out.push(...(childrenOf.get(out[i]) ?? []));
  }
  return out;
}

// Agents are processes of a known kind whose parent is not the same kind.
export function findAgents(procs) {
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const childrenOf = new Map();
  for (const p of procs) {
    childrenOf.set(p.ppid, [...(childrenOf.get(p.ppid) ?? []), p.pid]);
  }
  return procs
    .map((p) => ({ proc: p, kind: classify(p) }))
    .filter(({ proc, kind }) => kind && classify(byPid.get(proc.ppid) ?? { comm: '', args: '' }) !== kind)
    .map(({ proc, kind }) => ({
      kind, pid: proc.pid, etimes: proc.etimes, args: proc.args,
      pids: descendants(proc.pid, childrenOf),
    }));
}

export function cpuPercent(prevTicks, curTicks, dtSec, hz) {
  if (prevTicks === undefined || dtSec <= 0 || curTicks < prevTicks) return 0;
  return ((curTicks - prevTicks) / hz / dtSec) * 100;
}

// busy: the agent's own status when known (true/false); undefined falls back to CPU.
export function stateFor(cpu, threshold, busy) {
  if (typeof busy === 'boolean') return busy ? 'working' : 'sleeping';
  return cpu >= threshold ? 'working' : 'sleeping';
}

// ---- system access (Linux /proc) ----

export function listProcs() {
  const out = execFileSync('ps', ['-eo', 'pid=,ppid=,etimes=,comm=,args='], { encoding: 'utf8' });
  return parsePs(out);
}

function clockTicks() {
  try {
    return Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' })) || 100;
  } catch {
    return 100;
  }
}

function procTicks(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return Number(fields[11]) + Number(fields[12]); // utime + stime
  } catch {
    return 0;
  }
}

function procStartTicks(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]; // field 22: starttime
  } catch {
    return null;
  }
}

function procCwd(pid) {
  try {
    return readlinkSync(`/proc/${pid}/cwd`);
  } catch {
    return '';
  }
}

// Returns a sampler: call it repeatedly; it tracks CPU between calls.
export async function createSampler({ threshold = 5 } = {}) {
  if (!existsSync('/proc/self/stat')) {
    throw new Error('Live mode needs Linux /proc. Try --demo.');
  }
  const hz = clockTicks();
  const opencodeInfo = await createOpencodeReader();
  let prev = { time: 0, ticks: new Map() };
  const smooth = new Map();

  const enrich = (a, cpu, nowMs) => {
    const cwd = procCwd(a.pid);
    const base = { ...a, name: basename(cwd), cpu, sessionSec: a.etimes };
    const withIdle = (agent) => ({ ...agent, idleSec: idleSeconds(agent, nowMs) });
    if (a.kind === 'claude') {
      const info = claudeAgentInfo(a.pid, procStartTicks(a.pid));
      return withIdle({
        ...base,
        state: stateFor(cpu, threshold, info?.busy),
        busy: info?.busy ?? false,
        sessionSec: info?.startedAt ? Math.max(0, (nowMs - info.startedAt) / 1000) : a.etimes,
        question: info?.question ?? null,
        lastActivityMs: info?.lastActivityMs ?? null,
      });
    }
    const isServer = /\sserve(\s|$)/.test(a.args);
    const info = opencodeInfo(cwd, stateFor(cpu, threshold) === 'sleeping', isServer);
    return withIdle({
      ...base,
      state: stateFor(cpu, threshold, info?.busy),
      busy: info?.busy === true,
      question: info?.question ?? null,
      lastActivityMs: info?.lastActivityMs ?? null,
    });
  };

  return function sample() {
    const nowMs = Date.now();
    const agents = findAgents(listProcs());
    const ticks = new Map(agents.map((a) => [a.pid, a.pids.reduce((s, p) => s + procTicks(p), 0)]));
    const dt = nowMs / 1000 - prev.time;
    const result = agents.map((a) => {
      const raw = cpuPercent(prev.ticks.get(a.pid), ticks.get(a.pid), dt, hz);
      const cpu = 0.5 * (smooth.get(a.pid) ?? raw) + 0.5 * raw;
      smooth.set(a.pid, cpu);
      return enrich(a, cpu, nowMs);
    });
    prev = { time: nowMs / 1000, ticks };
    return result;
  };
}
