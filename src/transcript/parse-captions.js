// Turns raw panel rows into validated segments. Works on plain data, with no DOM access.
//
// Row: { time: string, text: string }
// Segment: { startMs: number, durationMs?: number, text: string }
(function (root) {
  const TC = (root.TranscriptCopier = root.TranscriptCopier || {});

  const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  const ENTITY = /&(?:#(\d+)|#x([0-9a-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi;

  function decodeEntities(text) {
    return text.replace(ENTITY, (match, dec, hex, named) => {
      if (named) return NAMED_ENTITIES[named.toLowerCase()];
      const code = dec ? Number.parseInt(dec, 10) : Number.parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    });
  }

  function cleanText(text) {
    return decodeEntities(String(text ?? ''))
      .replace(/[\s ]+/g, ' ')
      .trim();
  }

  /** "M:SS" or "H:MM:SS" to milliseconds, or null when the text is not a timestamp. */
  function parseTimestamp(text) {
    const match = /^(?:(\d+):)?(\d{1,3}):(\d{2})$/.exec(String(text ?? '').trim());
    if (!match) return null;
    const [hours, minutes, seconds] = [match[1] || 0, match[2], match[3]].map(Number);
    if (seconds >= 60) return null;
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  /** Validates rows and returns segments in time order. Throws PARSE_ERROR on bad input. */
  function rowsToSegments(rows) {
    if (!Array.isArray(rows)) throw new TC.TranscriptError('PARSE_ERROR', 'rows not an array');
    const segments = [];
    for (const row of rows) {
      const text = cleanText(row && row.text);
      if (!text) continue;
      const startMs = parseTimestamp(row.time);
      if (startMs === null) throw new TC.TranscriptError('PARSE_ERROR', 'unreadable timestamp');
      segments.push({ startMs, text });
    }
    if (segments.length === 0) throw new TC.TranscriptError('PARSE_ERROR', 'no text in rows');
    // Array.prototype.sort is stable, so rows sharing a second keep their panel order.
    return segments.sort((a, b) => a.startMs - b.startMs);
  }

  /**
   * Rejects an obviously truncated transcript. Speech rarely runs to the final second, so only a
   * transcript ending before half of a video longer than two minutes counts as truncated.
   */
  function assertComplete(segments, durationMs) {
    if (!Number.isFinite(durationMs) || durationMs < 120000) return;
    const last = segments[segments.length - 1];
    if (last.startMs < durationMs * 0.5) {
      throw new TC.TranscriptError('INCOMPLETE_TRANSCRIPT', 'ends before half of the video');
    }
  }

  Object.assign(TC, { decodeEntities, cleanText, parseTimestamp, rowsToSegments, assertComplete });
})(globalThis);
