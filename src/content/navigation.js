// Tracks YouTube's client-side navigation using the events its router dispatches on document.
(function (root) {
  const TC = (root.TranscriptCopier = root.TranscriptCopier || {});

  /** Returns the 11-character video ID for a `/watch` URL, otherwise null. */
  TC.videoIdFromLocation = function videoIdFromLocation(location) {
    if (location.pathname !== '/watch') return null;
    const id = new URLSearchParams(location.search).get('v');
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  };

  TC.watchNavigation = function watchNavigation({ onStart, onFinish }) {
    document.addEventListener('yt-navigate-start', onStart);
    for (const type of ['yt-navigate-finish', 'yt-page-data-updated']) document.addEventListener(type, onFinish);
    window.addEventListener('popstate', onFinish);
  };
})(globalThis);
