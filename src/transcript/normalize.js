// Duplicate removal and text output. Never adds, rewrites or translates words.
//
// Duplicate algorithm, applied to adjacent segments:
//   1. Same start time and same text: a render duplicate, so drop it.
//   2. The segment starts while the previous one is still on screen (needs a known duration) and
//      opens with the previous segment's closing words: a sliding caption, so drop those words.
// Anything else is kept. Without timing evidence of overlap, repeated words are genuine speech
// ("never gonna, never gonna"), and panel rows carry no durations, so rule 2 stays dormant there.
(function (root) {
  const TC = (root.TranscriptCopier = root.TranscriptCopier || {});

  const NON_SPEECH = /^(?:\[[^\]]*\]|\([^)]*\)|[♪♫\s]+)$/;

  function overlapWords(previous, current) {
    const limit = Math.min(previous.length, current.length);
    for (let size = limit; size > 0; size -= 1) {
      const tail = previous.slice(previous.length - size);
      if (tail.every((word, index) => word === current[index])) return size;
    }
    return 0;
  }

  function removeDuplicates(segments) {
    const result = [];
    for (const segment of segments) {
      const previous = result[result.length - 1];
      if (previous && previous.startMs === segment.startMs && previous.text === segment.text) continue;
      const overlapsInTime =
        previous &&
        Number.isFinite(previous.durationMs) &&
        segment.startMs < previous.startMs + previous.durationMs;
      if (overlapsInTime) {
        const words = segment.text.split(' ');
        const shared = overlapWords(previous.text.split(' '), words);
        if (shared === words.length) continue;
        if (shared > 0) {
          result.push({ ...segment, text: words.slice(shared).join(' ') });
          continue;
        }
      }
      result.push(segment);
    }
    return result;
  }

  /** `[MM:SS]`, or `[HH:MM:SS]` for every line once any segment passes one hour. */
  function formatTimestamp(startMs, useHours) {
    const total = Math.floor(startMs / 1000);
    const pad = (value) => String(value).padStart(2, '0');
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor(total / 60) % 60;
    const seconds = total % 60;
    return useHours ? `[${pad(hours)}:${pad(minutes)}:${pad(seconds)}]` : `[${pad(Math.floor(total / 60))}:${pad(seconds)}]`;
  }

  function dropRepeatedNonSpeech(segments) {
    return segments.filter((segment, index) => {
      if (!NON_SPEECH.test(segment.text)) return true;
      return index === 0 || segments[index - 1].text !== segment.text;
    });
  }

  function metadataHeader(metadata) {
    if (!metadata) return '';
    const oneLine = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
    const lines = [oneLine(metadata.title), oneLine(metadata.channel), oneLine(metadata.url)].filter(Boolean);
    return lines.length ? `${lines.join('\n')}\n\n` : '';
  }

  /** Builds the clipboard text from segments and the user's settings. */
  function formatTranscript(rawSegments, settings, metadata) {
    const segments = removeDuplicates(rawSegments);
    const header = settings.metadata ? metadataHeader(metadata) : '';
    if (settings.format === 'segments' || !settings.removeTimestamps) {
      const useHours = segments.some((segment) => segment.startMs >= 3600000);
      const source = settings.format === 'segments' ? segments : dropRepeatedNonSpeech(segments);
      const lines = source.map((segment) =>
        settings.removeTimestamps ? segment.text : `${formatTimestamp(segment.startMs, useHours)} ${segment.text}`
      );
      return header + lines.join('\n');
    }
    return header + dropRepeatedNonSpeech(segments).map((segment) => segment.text).join(' ');
  }

  Object.assign(TC, { removeDuplicates, formatTimestamp, formatTranscript });
})(globalThis);
