// Structured failures. Each code maps to the `error_<CODE>` message in _locales.
(function (root) {
  const TC = (root.TranscriptCopier = root.TranscriptCopier || {});

  TC.ERROR_CODES = Object.freeze([
    'UNSUPPORTED_PAGE',
    'NO_CAPTIONS',
    'TRACK_UNAVAILABLE',
    'PARSE_ERROR',
    'INCOMPLETE_TRANSCRIPT',
    'CLIPBOARD_DENIED',
    'STALE_VIDEO',
    'TIMEOUT',
  ]);

  TC.TranscriptError = class TranscriptError extends Error {
    constructor(code, detail) {
      super(detail ? `${code}: ${detail}` : code);
      this.name = 'TranscriptError';
      this.code = code;
    }
  };
})(globalThis);
