// Detects whether an agent is waiting on the user (a question or a permission prompt).

const stripMarkdown = (s) => s.replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();

// Last question sentence of the final paragraph, or null.
export function questionFromText(text) {
  const paragraphs = (text ?? '').trim().split(/\n\s*\n/);
  const last = stripMarkdown(paragraphs[paragraphs.length - 1] ?? '');
  if (!last.includes('?')) return null;
  const sentences = last.match(/[^.!?]*\?/g) ?? [];
  const q = sentences[sentences.length - 1]?.trim();
  return q || null;
}

function firstQuestion(questions) {
  let list = questions;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      return null;
    }
  }
  return Array.isArray(list) ? list[0]?.question ?? null : null;
}

const isMessage = (e) => (e.type === 'user' || e.type === 'assistant') && !e.isSidechain;

// entries: parsed Claude Code transcript lines (oldest first). status: 'idle' | 'busy'.
export function claudeQuestion(entries, status) {
  const msgs = entries.filter(isMessage);
  if (msgs.length === 0 || msgs[msgs.length - 1].type !== 'assistant') return null;

  // Claude Code writes one entry per content block; gather the trailing assistant turn.
  const firstUser = msgs.map((m) => m.type).lastIndexOf('user');
  const blocks = msgs.slice(firstUser + 1).flatMap((m) => {
    const c = m.message?.content;
    return typeof c === 'string' ? [{ type: 'text', text: c }] : c ?? [];
  });

  const ask = blocks.find((b) => b.type === 'tool_use' && b.name === 'AskUserQuestion');
  if (ask) return firstQuestion(ask.input?.questions) ?? 'Has a question for you';
  if (status !== 'idle') return null;

  const last = blocks[blocks.length - 1];
  if (last?.type === 'tool_use') return `Allow ${last.name}?`;
  const text = [...blocks].reverse().find((b) => b.type === 'text');
  return text ? questionFromText(text.text) : null;
}

// role: role of the latest opencode message; parts: its parts (oldest first).
export function opencodeQuestion(role, parts, idle) {
  if (role !== 'assistant') return null;
  const pending = parts.find((p) => p.type === 'tool' && p.tool === 'question'
    && (p.state?.status === 'running' || p.state?.status === 'pending'));
  if (pending) return firstQuestion(pending.state.input?.questions) ?? 'Has a question for you';
  if (!idle) return null;
  const text = [...parts].reverse().find((p) => p.type === 'text');
  return text ? questionFromText(text.text) : null;
}

// opencode's newer session_message rows keep parts inline as {type:'tool', name, state}.
export function normalizeV2Content(content) {
  return (content ?? []).map((c) => (c.type === 'tool' ? { ...c, tool: c.name } : c));
}
