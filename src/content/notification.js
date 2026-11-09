// One unobtrusive toast shared by every entry point, announced to assistive technology.
(function (root) {
  const TC = (root.TranscriptCopier = root.TranscriptCopier || {});

  const HIDE_AFTER_MS = 4000;
  let toast = null;
  let timer = null;

  TC.showToast = function showToast(message, kind) {
    if (!toast || !toast.isConnected) {
      toast = document.createElement('div');
      toast.id = 'transcript-copier-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.dataset.kind = kind;
    toast.dataset.visible = 'true';
    clearTimeout(timer);
    timer = setTimeout(() => {
      toast.dataset.visible = 'false';
    }, HIDE_AFTER_MS);
  };
})(globalThis);
