// Which model an agent is running, read from its transcript or session data.

const isMainAssistant = (e) => e.type === 'assistant' && !e.isSidechain;

// entries: parsed Claude Code transcript lines (oldest first). Subagent (sidechain) and
// synthetic entries are skipped so the card shows the session's own model.
export function claudeModel(entries) {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const model = isMainAssistant(entries[i]) ? entries[i].message?.model : null;
    if (model && model !== '<synthetic>') return model;
  }
  return null;
}

// opencode keeps the model as {modelID} on legacy messages, {model: {id}} on v2 messages,
// and {id} (as JSON text) in session_v2.model.
export function opencodeModel(value) {
  let data = value;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;
  const model = data.model && typeof data.model === 'object' ? data.model : data;
  return model.modelID ?? model.id ?? null;
}

// Compact name for a narrow card: "claude-opus-5-5" -> "opus-5-5", "nvidia/foo" -> "foo".
export function shortModel(id) {
  if (!id) return null;
  return id.split('/').pop().replace(/^claude-/, '');
}
