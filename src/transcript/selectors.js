// Every YouTube-specific selector lives here, so a page redesign means editing one file.
(function (root) {
  const TC = (root.TranscriptCopier = root.TranscriptCopier || {});

  TC.SELECTORS = Object.freeze({
    actionsRow: 'ytd-watch-metadata #top-level-buttons-computed',
    watchMetadata: 'ytd-watch-metadata',
    watchFlexy: 'ytd-watch-flexy',
    title: 'ytd-watch-metadata h1',
    channel: 'ytd-watch-metadata ytd-channel-name a',
    player: '#movie_player',
    playerError: '#movie_player .ytp-error',
    video: '#movie_player video',
    showTranscriptButton: 'ytd-video-description-transcript-section-renderer button',
    panel: 'ytd-engagement-panel-section-list-renderer',
    panelCloseButton: '#visibility-button button',
    panelLoading: 'ytd-continuation-item-renderer, tp-yt-paper-spinner, ytd-continuation-spinner-renderer',
  });

  TC.PANEL_EXPANDED = 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED';

  // YouTube serves two transcript panels; which one appears depends on the session.
  TC.ROW_ADAPTERS = Object.freeze([
    Object.freeze({
      source: 'panel-modern',
      row: 'transcript-segment-view-model',
      time: '.ytwTranscriptSegmentViewModelTimestamp',
      text: 'span.ytAttributedStringHost, [role="text"]',
    }),
    Object.freeze({
      source: 'panel-legacy',
      row: 'ytd-transcript-segment-renderer',
      time: '.segment-timestamp',
      text: '.segment-text',
    }),
  ]);
})(globalThis);
