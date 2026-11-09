const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/panel-modern.json');
const { TC } = require('./helpers.cjs');

const DEFAULTS = { format: 'clean', removeTimestamps: true, metadata: false };
const code = (expected) => (error) => error.code === expected;

test('parses timestamps, rejects non-timestamps', () => {
  assert.equal(TC.parseTimestamp('0:01'), 1000);
  assert.equal(TC.parseTimestamp('12:34'), 754000);
  assert.equal(TC.parseTimestamp('1:02:03'), 3723000);
  for (const bad of ['', '1 second', '1:99', 'abc', null]) assert.equal(TC.parseTimestamp(bad), null);
});

test('decodes entities and keeps Unicode intact', () => {
  const segments = TC.rowsToSegments(fixture.rows);
  assert.equal(segments[2].text, "It's a café & bar");
  assert.equal(segments[5].text, '最後の字幕 🎉 نهاية');
  assert.equal(segments[1].text, '♪ first line of the song ♪ ♪ second line of the song ♪');
  assert.equal(TC.decodeEntities('&#x1F389; &bogus; &#0;'), '🎉 &bogus; &#0;');
});

test('default output is transcript text only, keeping speaker labels and repeats', () => {
  const text = TC.formatTranscript(TC.rowsToSegments(fixture.rows), DEFAULTS, { title: 'NOT INCLUDED' });
  assert.ok(text.startsWith('[♪♪♪] ♪ first line'));
  assert.ok(text.includes('>> SPEAKER: never gonna, never gonna never gonna, never gonna'));
  assert.ok(!text.includes('NOT INCLUDED'));
  assert.ok(!/\d:\d\d/.test(text));
});

test('rejects empty, malformed and unexpected rows', () => {
  assert.throws(() => TC.rowsToSegments(null), code('PARSE_ERROR'));
  assert.throws(() => TC.rowsToSegments([]), code('PARSE_ERROR'));
  assert.throws(() => TC.rowsToSegments([{ time: '0:01', text: '   ' }]), code('PARSE_ERROR'));
  assert.throws(() => TC.rowsToSegments([{ time: 'soon', text: 'hello' }]), code('PARSE_ERROR'));
  assert.equal(TC.rowsToSegments([{ time: '0:01', text: 'a', extra: 1 }, { time: '0:02', text: '' }]).length, 1);
});

test('orders rows by time, keeping panel order within the same second', () => {
  const segments = TC.rowsToSegments([
    { time: '0:05', text: 'c' },
    { time: '0:01', text: 'a' },
    { time: '0:01', text: 'b' },
  ]);
  assert.deepEqual(segments.map((segment) => segment.text), ['a', 'b', 'c']);
});

test('suppresses sliding captions only with timing evidence of overlap', () => {
  const sliding = [
    { startMs: 0, durationMs: 3000, text: 'the quick brown' },
    { startMs: 1500, durationMs: 3000, text: 'quick brown fox jumps' },
    { startMs: 2000, durationMs: 500, text: 'fox jumps' },
  ];
  assert.deepEqual(TC.removeDuplicates(sliding).map((segment) => segment.text), ['the quick brown', 'fox jumps']);

  const genuine = [
    { startMs: 0, durationMs: 1000, text: 'again and again' },
    { startMs: 5000, durationMs: 1000, text: 'again and again' },
  ];
  assert.equal(TC.removeDuplicates(genuine).length, 2);

  const noDurations = [{ startMs: 0, text: 'go go' }, { startMs: 1000, text: 'go go' }];
  assert.equal(TC.removeDuplicates(noDurations).length, 2);

  const renderDuplicate = [{ startMs: 0, text: 'once' }, { startMs: 0, text: 'once' }];
  assert.equal(TC.removeDuplicates(renderDuplicate).length, 1);
});

test('collapses only consecutive repeats of non-speech tags in clean text', () => {
  const segments = ['[Music]', '[Music]', 'hello', '[Music]'].map((text, index) => ({ startMs: index * 1000, text }));
  assert.equal(TC.formatTranscript(segments, DEFAULTS), '[Music] hello [Music]');
  assert.equal(TC.formatTranscript(segments, { ...DEFAULTS, format: 'segments' }).split('\n').length, 4);
});

test('formats timestamps consistently across an hour boundary', () => {
  const short = [{ startMs: 65000, text: 'a' }];
  assert.equal(TC.formatTranscript(short, { ...DEFAULTS, removeTimestamps: false }), '[01:05] a');
  const long = [{ startMs: 65000, text: 'a' }, { startMs: 3723000, text: 'b' }];
  assert.equal(TC.formatTranscript(long, { ...DEFAULTS, removeTimestamps: false }), '[00:01:05] a\n[01:02:03] b');
});

test('the remove-timestamps toggle controls markers in both formats', () => {
  const segments = [{ startMs: 1000, text: 'a' }, { startMs: 2000, text: 'b' }];
  assert.equal(TC.formatTranscript(segments, DEFAULTS), 'a b');
  assert.equal(TC.formatTranscript(segments, { ...DEFAULTS, format: 'segments' }), 'a\nb');
  assert.equal(TC.formatTranscript(segments, { ...DEFAULTS, removeTimestamps: false }), '[00:01] a\n[00:02] b');
  assert.equal(TC.formatTranscript(segments, { format: 'segments', removeTimestamps: false }), '[00:01] a\n[00:02] b');
});

test('metadata header is optional and single-line per field', () => {
  const metadata = { title: 'A\ntitle', channel: ' Chan ', url: 'https://www.youtube.com/watch?v=abcdefghijk' };
  const text = TC.formatTranscript([{ startMs: 0, text: 'x' }], { ...DEFAULTS, metadata: true }, metadata);
  assert.equal(text, 'A title\nChan\nhttps://www.youtube.com/watch?v=abcdefghijk\n\nx');
});

test('large transcripts keep every segment in order', () => {
  const rows = Array.from({ length: 20000 }, (_, index) => ({
    time: `${Math.floor(index / 3600)}:${String(Math.floor(index / 60) % 60).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}`,
    text: `word${index}`,
  }));
  const words = TC.formatTranscript(TC.rowsToSegments(rows), DEFAULTS).split(' ');
  assert.equal(words.length, 20000);
  assert.equal(words[0], 'word0');
  assert.equal(words[19999], 'word19999');
});

test('flags only obviously truncated transcripts', () => {
  const segments = [{ startMs: 100000, text: 'x' }];
  assert.throws(() => TC.assertComplete(segments, 600000), code('INCOMPLETE_TRANSCRIPT'));
  assert.doesNotThrow(() => TC.assertComplete(segments, 150000));
  assert.doesNotThrow(() => TC.assertComplete(segments, 60000));
  assert.doesNotThrow(() => TC.assertComplete(segments, Number.NaN));
});

test('recognises watch URLs only', () => {
  const at = (pathname, search) => TC.videoIdFromLocation({ pathname, search });
  assert.equal(at('/watch', '?v=dQw4w9WgXcQ&t=3'), 'dQw4w9WgXcQ');
  assert.equal(at('/watch', ''), null);
  assert.equal(at('/watch', '?v=short'), null);
  assert.equal(at('/shorts/dQw4w9WgXcQ', ''), null);
  assert.equal(at('/', '?v=dQw4w9WgXcQ'), null);
});
