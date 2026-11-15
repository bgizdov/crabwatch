// Reads agent session state from disk: Claude Code session files + transcripts, opencode's SQLite DB.
import { readFileSync, statSync, openSync, readSync, closeSync, readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { claudeQuestion, opencodeQuestion, normalizeV2Content } from './asking.js';
import { lastMessageMs, opencodeBusy } from './idle.js';

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
const TAIL_BYTES = 256 * 1024;

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

// procStart guards against a stale session file left behind by an earlier process with the same PID.
export function readClaudeSession(pid, procStart) {
  const info = readJson(join(CLAUDE_DIR, 'sessions', `${pid}.json`));
  if (!info || info.pid !== pid) return null;
  if (procStart && info.procStart && String(info.procStart) !== String(procStart)) return null;
  return info;
}

const projectSlug = (cwd) => cwd.replace(/[^a-zA-Z0-9]/g, '-');

function findTranscript(cwd, sessionId) {
  const direct = join(CLAUDE_DIR, 'projects', projectSlug(cwd), `${sessionId}.jsonl`);
  if (existsSync(direct)) return direct;
  try {
    const dirs = readdirSync(join(CLAUDE_DIR, 'projects'));
    const hit = dirs.map((d) => join(CLAUDE_DIR, 'projects', d, `${sessionId}.jsonl`)).find(existsSync);
    return hit ?? null;
  } catch {
    return null;
  }
}

function tailLines(path) {
  const { size } = statSync(path);
  const start = Math.max(0, size - TAIL_BYTES);
  const buf = Buffer.alloc(size - start);
  const fd = openSync(path, 'r');
  try {
    readSync(fd, buf, 0, buf.length, start);
  } finally {
    closeSync(fd);
  }
  const lines = buf.toString('utf8').split('\n');
  if (start > 0) lines.shift(); // first line is probably partial
  return lines.flatMap((l) => {
    try {
      return l ? [JSON.parse(l)] : [];
    } catch {
      return [];
    }
  });
}

// Cached per transcript: re-parse only when the file or session status changes.
const claudeCache = new Map();

export function claudeAgentInfo(pid, procStart) {
  const info = readClaudeSession(pid, procStart);
  if (!info) return null;
  let question = null;
  let messageMs = null;
  const path = findTranscript(info.cwd, info.sessionId);
  if (path) {
    try {
      const { size, mtimeMs } = statSync(path);
      const key = `${size}:${mtimeMs}:${info.status}`;
      let cached = claudeCache.get(path);
      if (cached?.key !== key) {
        const entries = tailLines(path);
        cached = { key, question: claudeQuestion(entries, info.status), messageMs: lastMessageMs(entries) };
        claudeCache.set(path, cached);
      }
      ({ question, messageMs } = cached);
    } catch {
      question = null;
    }
  }
  const lastActivityMs = Math.max(info.statusUpdatedAt ?? 0, messageMs ?? 0) || null;
  return {
    busy: info.status === 'busy',
    startedAt: info.startedAt,
    lastActivityMs,
    question,
  };
}

// ---- opencode ----

async function openOpencodeDb() {
  const dataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
  const path = join(dataHome, 'opencode', 'opencode.db');
  if (!existsSync(path)) return null;
  try {
    // node:sqlite prints an ExperimentalWarning on some Node versions; keep the screen clean.
    const listeners = process.listeners('warning');
    process.removeAllListeners('warning');
    const { DatabaseSync } = await import('node:sqlite');
    listeners.forEach((l) => process.on('warning', l));
    return new DatabaseSync(path, { readOnly: true });
  } catch {
    return null;
  }
}

function tryPrepare(db, sql) {
  try {
    return db.prepare(sql);
  } catch {
    return null; // table missing in this opencode version
  }
}

// Sessions live in `session` (older opencode) and `session_v2` (newer), often in worktrees
// under ~/.local/share/opencode/worktree, so they are matched to a bot through its project.
export async function createOpencodeReader() {
  const db = await openOpencodeDb();
  if (!db) return () => null;
  const projectsQ = tryPrepare(db, `select id from project where worktree = ?
    union select project_id from project_directory where directory = ?`);
  const latest = (table, cols) => ({
    byProject: tryPrepare(db, `select ${cols} from ${table}
      where project_id = ? and parent_id is null and time_archived is null order by time_updated desc limit 1`),
    any: tryPrepare(db, `select ${cols} from ${table}
      where parent_id is null and time_archived is null order by time_updated desc limit 1`),
  });
  const v1 = latest('session', 'id, time_updated');
  const v2 = latest('session_v2', 'id, time_updated, time_busy, time_idle');
  const v1MessageQ = tryPrepare(db, 'select id, data, time_updated from message where session_id = ? order by time_created desc limit 1');
  const v1PartsQ = tryPrepare(db, 'select data from part where message_id = ? order by time_created');
  const v2MessageQ = tryPrepare(db, `select type, data, time_updated from session_message
    where session_id = ? and type in ('user', 'assistant') order by seq desc limit 1`);

  const newest = (rows) => rows.filter(Boolean).sort((a, b) => b.row.time_updated - a.row.time_updated)[0] ?? null;

  function findSession(cwd, isServer) {
    const candidates = [];
    if (isServer) {
      // `opencode serve` hosts sessions for every project, so take the latest overall.
      for (const [v, q] of [['v1', v1.any], ['v2', v2.any]]) {
        const row = q?.get();
        if (row) candidates.push({ v, row });
      }
    } else {
      const projects = projectsQ?.all(cwd, cwd) ?? [];
      for (const { id } of projects) {
        for (const [v, q] of [['v1', v1.byProject], ['v2', v2.byProject]]) {
          const row = q?.get(id);
          if (row) candidates.push({ v, row });
        }
      }
    }
    return newest(candidates);
  }

  function lastMessage(session) {
    if (session.v === 'v2') {
      const msg = v2MessageQ?.get(session.row.id);
      if (!msg) return null;
      return { role: msg.type, parts: normalizeV2Content(JSON.parse(msg.data).content), time: msg.time_updated };
    }
    const msg = v1MessageQ?.get(session.row.id);
    if (!msg) return null;
    const parts = (v1PartsQ?.all(msg.id) ?? []).map((p) => JSON.parse(p.data));
    return { role: JSON.parse(msg.data).role, parts, time: msg.time_updated };
  }

  // cpuIdle is only used when the session has no busy flag (older opencode).
  return function opencodeAgentInfo(cwd, cpuIdle, isServer = false) {
    try {
      const session = findSession(cwd, isServer);
      if (!session) return null;
      const busy = opencodeBusy({ ...session.row }, Date.now());
      const idle = typeof busy === 'boolean' ? !busy : cpuIdle;
      const msg = lastMessage(session);
      const lastActivityMs = Math.max(session.row.time_updated ?? 0, msg?.time ?? 0) || null;
      return { busy, question: msg ? opencodeQuestion(msg.role, msg.parts, idle) : null, lastActivityMs };
    } catch {
      return null;
    }
  };
}
