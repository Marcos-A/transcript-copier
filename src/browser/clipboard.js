// Clipboard write used by both the content script and the popup.
//
// The async Clipboard API is tried first, with a bounded wait because it can reject or never
// settle once the click's activation has expired. The legacy copy command is the fallback.
// `clipboardWrite` is what permits both without a recent gesture; see docs/feasibility.md.
(function (root) {
  const TC = (root.TranscriptCopier = root.TranscriptCopier || {});

  const WRITE_LIMIT_MS = 3000;

  function legacyCopy(text, doc) {
    const active = doc.activeElement;
    const area = doc.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.setAttribute('aria-hidden', 'true');
    area.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;';
    doc.documentElement.appendChild(area);
    try {
      area.select();
      return doc.execCommand('copy') === true;
    } finally {
      area.remove();
      if (active && typeof active.focus === 'function') active.focus({ preventScroll: true });
    }
  }

  /** Resolves only after the text is on the clipboard; otherwise throws CLIPBOARD_DENIED. */
  TC.writeClipboard = async function writeClipboard(text, env = {}) {
    const nav = env.navigator || root.navigator;
    const doc = env.document || root.document;
    let timer;
    const limit = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('clipboard timeout')), env.limitMs || WRITE_LIMIT_MS);
    });
    try {
      await Promise.race([nav.clipboard.writeText(text), limit]);
      return;
    } catch {
      // Fall through to the legacy path.
    } finally {
      clearTimeout(timer);
    }
    let copied = false;
    try {
      copied = legacyCopy(text, doc);
    } catch {
      copied = false;
    }
    if (!copied) throw new TC.TranscriptError('CLIPBOARD_DENIED');
  };
})(globalThis);
