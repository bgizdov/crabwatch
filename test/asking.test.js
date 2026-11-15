import { test } from 'node:test';
import assert from 'node:assert/strict';
import { questionFromText, claudeQuestion, opencodeQuestion, normalizeV2Content } from '../src/asking.js';

const asst = (content, extra = {}) => ({ type: 'assistant', isSidechain: false, message: { role: 'assistant', content }, ...extra });
const user = (content) => ({ type: 'user', isSidechain: false, message: { role: 'user', content } });

test('questionFromText returns the last question in the final paragraph', () => {
  assert.equal(questionFromText('Done.\n\nTests pass. Want me to open a PR?'), 'Want me to open a PR?');
  assert.equal(questionFromText('Is it A? Or **B**?'), 'Or B?');
  assert.equal(questionFromText('Why? Anyway.\n\nAll done.'), null);
  assert.equal(questionFromText(''), null);
});

test('claudeQuestion: AskUserQuestion tool wins even while busy', () => {
  const entries = [user('hi'), asst([{ type: 'tool_use', name: 'AskUserQuestion', input: { questions: [{ question: 'Which DB?' }] } }])];
  assert.equal(claudeQuestion(entries, 'busy'), 'Which DB?');
});

test('claudeQuestion: trailing text question only when idle', () => {
  const entries = [user('hi'), asst([{ type: 'text', text: 'Shall I deploy?' }])];
  assert.equal(claudeQuestion(entries, 'idle'), 'Shall I deploy?');
  assert.equal(claudeQuestion(entries, 'busy'), null);
});

test('claudeQuestion: dangling tool_use while idle means a permission prompt', () => {
  const entries = [user('hi'), asst([{ type: 'tool_use', name: 'Bash', input: {} }])];
  assert.equal(claudeQuestion(entries, 'idle'), 'Allow Bash?');
});

test('claudeQuestion: ignores answered questions, sidechains and non-message entries', () => {
  const entries = [
    asst([{ type: 'text', text: 'Proceed?' }]),
    user('yes'),
    asst([{ type: 'text', text: 'Sub agent asks?' }], { isSidechain: true }),
    { type: 'file-history-snapshot' },
  ];
  assert.equal(claudeQuestion(entries, 'idle'), null);
});

test('opencodeQuestion: pending question tool, JSON-string input supported', () => {
  const parts = [{ type: 'tool', tool: 'question', state: { status: 'running', input: { questions: '[{"question":"Exempt ping?"}]' } } }];
  assert.equal(opencodeQuestion('assistant', parts, true), 'Exempt ping?');
  const done = [{ type: 'tool', tool: 'question', state: { status: 'completed', input: { questions: [{ question: 'x?' }] } } }];
  assert.equal(opencodeQuestion('assistant', done, true), null);
});

test('opencodeQuestion: text question only when idle and last message is assistant', () => {
  const parts = [{ type: 'text', text: 'Done. Merge it?' }];
  assert.equal(opencodeQuestion('assistant', parts, true), 'Merge it?');
  assert.equal(opencodeQuestion('assistant', parts, false), null);
  assert.equal(opencodeQuestion('user', parts, true), null);
});

test('normalizeV2Content maps new opencode content to the part shape', () => {
  const content = [
    { type: 'reasoning', text: 'hmm' },
    { type: 'text', text: 'Pick one?' },
    { type: 'tool', name: 'question', state: { status: 'running', input: { questions: [{ question: 'Which DB?' }] } } },
  ];
  const parts = normalizeV2Content(content);
  assert.deepEqual(parts.map((p) => p.type), ['reasoning', 'text', 'tool']);
  assert.equal(parts[2].tool, 'question');
  assert.equal(opencodeQuestion('assistant', parts, true), 'Which DB?');
  assert.deepEqual(normalizeV2Content(undefined), []);
});
