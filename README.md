# crabwatch

A pixel-art terminal dashboard that shows your coding agents. Claude Code sessions are orange crabs (Clawd) and opencode sessions are robots. Each one is animated as **working** or **sleeping**.

![crabwatch demo](docs/demo.png)

## How it works
- Finds `claude` and `opencode` processes using `ps`.
- Adds up CPU use from `/proc` for each agent and all of its child processes, so running tools count as work.
- An agent is **working** when its CPU is at or above the threshold (default 5%). Otherwise it is **sleeping**.
- Each card shows the agent's project folder, PID, CPU %, **session time** and **idle time**. Idle time is measured from the last transcript write or status change for Claude, and from the last session or message update for opencode.
- A Claude session counts as working only while Claude Code marks it `busy`. An opencode bot counts as working while its latest session is busy (`time_busy` / `time_idle` in `session_v2`); a busy flag not updated for 30 minutes is treated as stale. CPU is used only when neither is available. Idle time comes from real activity (messages, status changes), so CPU spikes from an idle app don't count.
- Agents idle for more than 24 hours are hidden (press `h` to toggle), and the header shows how many were hidden. Change the limit with `--max-idle <hours>`; `--max-idle 0` shows everything.
- **Speech bubble**: appears when an agent is waiting on you. For Claude, that's an `AskUserQuestion` call, a permission prompt, or a final message ending in a question (read from the session transcript in `~/.claude/projects`). For opencode, it's a pending `question` tool call or a final question, read only from the `session`, `message` and `part` tables of `~/.local/share/opencode/opencode.db`.

## Requirements
- Node.js 20 or newer. No npm packages needed.
- Linux, for live mode (it reads `/proc`). Demo mode works anywhere.
- A terminal with truecolor support.

## Run
```bash
npm start                         # live dashboard
npm run demo                      # fake agents, randomly changing state
node src/dashboard.js --threshold 10   # use a different CPU % for "working"
node src/dashboard.js --max-idle 0    # also show agents idle for more than 24h
npm test
```
Keys: `h` shows or hides the agents idle for more than 24h; `q` or `Ctrl-C` quits.
