// Toolbar popup: output settings, plus a copy button for when the in-page control is unavailable.
(function () {
  const TC = globalThis.TranscriptCopier;
  const byId = (id) => document.getElementById(id);
  const copyButton = byId('copy');
  const status = byId('status');

  document.title = TC.msg('extName');
  byId('name').textContent = TC.msg('extName');
  copyButton.textContent = TC.msg('buttonCopy');
  document.querySelectorAll('[data-message]').forEach((element) => {
    element.textContent = TC.msg(element.dataset.message);
  });

  async function copy() {
    copyButton.disabled = true;
    copyButton.textContent = TC.msg('buttonCopying');
    try {
      const [tab] = await TC.ext.tabs.query({ active: true, currentWindow: true });
      let reply;
      try {
        reply = await TC.ext.tabs.sendMessage(tab.id, { type: 'transcript-copier:copy', deliver: 'return' });
      } catch {
        reply = { ok: false, message: TC.msg('error_UNSUPPORTED_PAGE') };
      }
      if (reply && reply.ok) await TC.writeClipboard(reply.text);
      status.textContent = reply ? reply.message : TC.msg('error_UNSUPPORTED_PAGE');
    } catch {
      status.textContent = TC.msg('error_CLIPBOARD_DENIED');
    } finally {
      copyButton.disabled = false;
      copyButton.textContent = TC.msg('buttonCopy');
    }
  }

  async function init() {
    const settings = await TC.loadSettings();
    byId('format').value = settings.format;
    byId('removeTimestamps').checked = settings.removeTimestamps;
    byId('metadata').checked = settings.metadata;
    byId('settings').addEventListener('change', () => {
      TC.saveSettings({
        format: byId('format').value,
        removeTimestamps: byId('removeTimestamps').checked,
        metadata: byId('metadata').checked,
      });
    });
    copyButton.addEventListener('click', copy);
  }

  init();
})();
