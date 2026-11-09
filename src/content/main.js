// Entry point: connects navigation, the button, extraction and clipboard delivery.
(function (root) {
  const TC = root.TranscriptCopier;
  const S = TC.SELECTORS;

  const currentVideoId = () => TC.videoIdFromLocation(location);
  const panelSource = TC.createPanelSource();
  let staleSignature = null;
  let active = false;

  /** Player duration, or NaN while an ad plays, since the video element then reports the ad. */
  function getDurationMs() {
    if (document.querySelector(`${S.player}.ad-showing`)) return Number.NaN;
    const video = document.querySelector(S.video);
    return video ? video.duration * 1000 : Number.NaN;
  }

  function getMetadata(videoId) {
    const text = (selector) => document.querySelector(selector)?.textContent ?? '';
    return { title: text(S.title), channel: text(S.channel), url: `https://www.youtube.com/watch?v=${videoId}` };
  }

  const service = TC.createTranscriptService({
    panelSource,
    currentVideoId,
    getDurationMs,
    getMetadata,
    staleSignature: () => staleSignature,
  });

  const mount = TC.createButtonMount({
    onClick: () => copy('clipboard'),
    isWatchPage: () => currentVideoId() !== null,
  });

  /**
   * Runs one copy. `deliver` is 'clipboard' to write here, or 'return' to hand the text to the
   * caller (the popup holds focus, so it must do its own write).
   */
  async function copy(deliver) {
    if (active) return { ok: false, busy: true, message: TC.msg('statusBusy') };
    active = true;
    mount.setState('busy', TC.msg('buttonCopying'));
    try {
      const settings = await TC.loadSettings();
      const result = await service.extract(settings);
      if (currentVideoId() !== result.videoId) throw new TC.TranscriptError('STALE_VIDEO');
      if (deliver === 'clipboard') await TC.writeClipboard(result.text);
      const message = TC.msg('statusCopied', result.segments.length);
      mount.setState('copied', TC.msg('buttonCopied'));
      if (deliver === 'clipboard') TC.showToast(message, 'success');
      return { ok: true, message, text: deliver === 'return' ? result.text : undefined };
    } catch (error) {
      const code = error instanceof TC.TranscriptError ? error.code : 'PARSE_ERROR';
      if (!(error instanceof TC.TranscriptError)) console.warn('[transcript-copier]', error && error.name);
      const message = TC.msg(`error_${code}`);
      mount.setState('error', message);
      if (deliver === 'clipboard') TC.showToast(message, 'error');
      return { ok: false, code, message };
    } finally {
      active = false;
    }
  }

  TC.watchNavigation({
    onStart: () => {
      staleSignature = panelSource.currentSignature();
    },
    onFinish: () => mount.refresh(),
  });
  mount.refresh();

  TC.ext.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'transcript-copier:copy') return undefined;
    copy(message.deliver === 'return' ? 'return' : 'clipboard').then(sendResponse);
    return true;
  });
})(globalThis);
