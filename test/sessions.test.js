import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createOpencodeReader, claudeTitle } from '../src/sessions.js';

function makeDb() {
  const home = mkdtempSync(join(tmpdir(), 'crabwatch-'));
  mkdirSync(join(home, 'opencode'));
  const db = new DatabaseSync(join(home, 'opencode', 'opencode.db'));
  db.exec(`create table project (id text, worktree text, name text);
    create table project_directory (project_id text, directory text);
    create table session_v2 (id text, project_id text, parent_id text, time_archived int, title text,
      directory text, time_updated int, time_busy int, time_idle int);
    create table session_message (session_id text, type text, data text, time_updated int, seq int);
    insert into project values ('p1', '/work/api', null), ('p2', '/work/web', null);
    insert into session_v2 values ('s1', 'p1', null, null, 'Old api work', '/work/api', 1000, null, 1000),
      ('s2', 'p2', null, null, 'Fresh web chat', '/data/opencode/worktree/ab12/silent-engine', 2000, 2000, null);`);
  db.close();
  return home;
}

test('opencode reader reports the session directory and title; serve picks the newest overall', async () => {
  const home = makeDb();
  const prev = process.env.XDG_DATA_HOME;
  process.env.XDG_DATA_HOME = home;
  try {
    const read = await createOpencodeReader();
    const server = read('/work/devcontainer-setup', false, true);
    assert.equal(server.directory, '/data/opencode/worktree/ab12/silent-engine');
    assert.equal(server.projectDir, '/work/web', 'opencode worktree resolves to its repo');
    assert.equal(server.title, 'Fresh web chat');
    const tui = read('/work/api', true, false);
    assert.equal(tui.directory, '/work/api');
    assert.equal(tui.projectDir, '/work/api');
    assert.equal(tui.title, 'Old api work');
  } finally {
    if (prev === undefined) delete process.env.XDG_DATA_HOME; else process.env.XDG_DATA_HOME = prev;
    rmSync(home, { recursive: true, force: true });
  }
});

test('claudeTitle prefers a custom title over the latest AI title', () => {
  const ai = (t) => ({ type: 'ai-title', aiTitle: t });
  assert.equal(claudeTitle([ai('Old'), { type: 'user' }, ai('Pixel crab dashboard')]), 'Pixel crab dashboard');
  assert.equal(claudeTitle([{ type: 'custom-title', customTitle: 'my-rename' }, ai('Later AI')]), 'my-rename');
  assert.equal(claudeTitle([{ type: 'user' }]), null);
});
