const test = require('node:test');
const assert = require('node:assert/strict');
const { TC } = require('./helpers.cjs');

const SETTINGS = { format: 'clean', removeTimestamps: true, metadata: false };
const ROWS = [{ time: '0:01', text: 'hello' }, { time: '0:02', text: 'world' }];
const code = (expected) => (error) => error.code === expected;

function service(overrides = {}) {
  return TC.createTranscriptService({
    panelSource: { extract: async () => ({ rows: ROWS, source: 'panel-modern' }) },
    currentVideoId: () => 'aaaaaaaaaaa',
    getDurationMs: () => Number.NaN,
    getMetadata: () => ({}),
    staleSignature: () => null,
    ...overrides,
  });
}

test('produces text for the current video', async () => {
  const result = await service().extract(SETTINGS);
  assert.equal(result.text, 'hello world');
  assert.equal(result.videoId, 'aaaaaaaaaaa');
});

test('refuses unsupported pages', async () => {
  await assert.rejects(service({ currentVideoId: () => null }).extract(SETTINGS), code('UNSUPPORTED_PAGE'));
});

test('a navigation during extraction fails as stale and yields no text', async () => {
  let id = 'aaaaaaaaaaa';
  const panelSource = {
    extract: async () => {
      id = 'bbbbbbbbbbb';
      return { rows: ROWS, source: 'panel-modern' };
    },
  };
  await assert.rejects(service({ panelSource, currentVideoId: () => id }).extract(SETTINGS), code('STALE_VIDEO'));
});

test('a hung source times out', async () => {
  const panelSource = { extract: () => new Promise(() => {}) };
  await assert.rejects(service({ panelSource, limitMs: 10 }).extract(SETTINGS), code('TIMEOUT'));
});

test('clipboard: reports success only after the write resolves', async () => {
  const calls = [];
  const navigator = { clipboard: { writeText: async (text) => calls.push(text) } };
  await TC.writeClipboard('text', { navigator, document: {} });
  assert.deepEqual(calls, ['text']);
});

test('clipboard: falls back, then reports denial when nothing works', async () => {
  const navigator = { clipboard: { writeText: async () => { throw new Error('denied'); } } };
  const area = { style: {}, setAttribute() {}, select() {}, remove() {} };
  const document = (result) => ({
    activeElement: null,
    createElement: () => area,
    documentElement: { appendChild() {} },
    execCommand: () => result,
  });
  await TC.writeClipboard('text', { navigator, document: document(true) });
  await assert.rejects(TC.writeClipboard('text', { navigator, document: document(false) }), code('CLIPBOARD_DENIED'));
});

test('clipboard: a write that never settles does not hang', async () => {
  const navigator = { clipboard: { writeText: () => new Promise(() => {}) } };
  const area = { style: {}, setAttribute() {}, select() {}, remove() {} };
  const document = { activeElement: null, createElement: () => area, documentElement: { appendChild() {} }, execCommand: () => false };
  await assert.rejects(TC.writeClipboard('text', { navigator, document, limitMs: 10 }), code('CLIPBOARD_DENIED'));
});

test('every error code has a user-facing message', () => {
  const messages = require('../_locales/en/messages.json');
  for (const errorCode of TC.ERROR_CODES) assert.ok(messages[`error_${errorCode}`], errorCode);
});
