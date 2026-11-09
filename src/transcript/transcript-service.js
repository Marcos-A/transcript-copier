// Orchestrates extraction for one video. Clipboard delivery stays outside, in the caller.
(function (root) {
  const TC = (root.TranscriptCopier = root.TranscriptCopier || {});

  const OVERALL_LIMIT_MS = 90000;

  function withTimeout(promise, limitMs, setTimer, clearTimer) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimer(() => reject(new TC.TranscriptError('TIMEOUT')), limitMs);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimer(timer));
  }

  /**
   * deps: panelSource, currentVideoId(), getDurationMs(), getMetadata(videoId), staleSignature()
   * Resolves to { videoId, source, segments, text }.
   */
  TC.createTranscriptService = function createTranscriptService(deps) {
    const setTimer = deps.setTimer || ((fn, ms) => setTimeout(fn, ms));
    const clearTimer = deps.clearTimer || ((timer) => clearTimeout(timer));

    async function run(videoId, settings, guard) {
      const { rows, source } = await deps.panelSource.extract({ guard, staleSignature: deps.staleSignature() });
      guard();
      const segments = TC.rowsToSegments(rows);
      TC.assertComplete(segments, deps.getDurationMs());
      const metadata = settings.metadata ? deps.getMetadata(videoId) : null;
      return { videoId, source, segments, text: TC.formatTranscript(segments, settings, metadata) };
    }

    return {
      extract(settings) {
        const videoId = deps.currentVideoId();
        if (!videoId) return Promise.reject(new TC.TranscriptError('UNSUPPORTED_PAGE'));
        const guard = () => {
          if (deps.currentVideoId() !== videoId) throw new TC.TranscriptError('STALE_VIDEO');
        };
        return withTimeout(run(videoId, settings, guard), deps.limitMs || OVERALL_LIMIT_MS, setTimer, clearTimer);
      },
    };
  };
})(globalThis);
