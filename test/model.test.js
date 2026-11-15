import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claudeModel, opencodeModel, shortModel } from '../src/model.js';

const asst = (model, extra = {}) => ({ type: 'assistant', isSidechain: false, message: { role: 'assistant', model, content: [] }, ...extra });

test('claudeModel returns the model of the latest main-thread assistant entry', () => {
  const entries = [asst('claude-sonnet-5-5'), { type: 'user', message: { content: 'hi' } }, asst('claude-opus-5-5')];
  assert.equal(claudeModel(entries), 'claude-opus-5-5');
});

test('claudeModel skips sidechain and synthetic entries', () => {
  const entries = [asst('claude-opus-5-5'), asst('claude-haiku-5-5', { isSidechain: true }), asst('<synthetic>')];
  assert.equal(claudeModel(entries), 'claude-opus-5-5');
});

test('claudeModel returns null when no model is known', () => {
  assert.equal(claudeModel([]), null);
  assert.equal(claudeModel([{ type: 'user', message: { content: 'hi' } }]), null);
});

test('opencodeModel reads both legacy and v2 shapes, as object or JSON string', () => {
  assert.equal(opencodeModel({ modelID: 'gpt-5', providerID: 'openai' }), 'gpt-5');
  assert.equal(opencodeModel({ model: { id: 'big-pickle', providerID: 'opencode' } }), 'big-pickle');
  assert.equal(opencodeModel({ model: { modelID: 'm1', providerID: 'p' } }), 'm1');
  assert.equal(opencodeModel('{"id":"big-pickle","providerID":"opencode"}'), 'big-pickle');
  assert.equal(opencodeModel(null), null);
  assert.equal(opencodeModel('not json'), null);
  assert.equal(opencodeModel({}), null);
});

test('shortModel drops the claude- prefix and provider paths', () => {
  assert.equal(shortModel('claude-opus-5-5'), 'opus-5-5');
  assert.equal(shortModel('claude-sonnet-4-5-20250929'), 'sonnet-4-5-20250929');
  assert.equal(shortModel('nvidia/nemotron-3.5-super-vl:free'), 'nemotron-3.5-super-vl:free');
  assert.equal(shortModel('big-pickle'), 'big-pickle');
  assert.equal(shortModel(null), null);
});
