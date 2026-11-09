// Keeps exactly one action button in YouTube's video actions row.
(function (root) {
  const TC = (root.TranscriptCopier = root.TranscriptCopier || {});

  const BUTTON_ID = 'transcript-copier-button';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const RETRY_MS = 500;
  const RETRY_LIMIT = 40;
  const RESET_AFTER_MS = 2200;

  function createIcon() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M16 3H6a2 2 0 0 0-2 2v12h2V5h10V3Zm3 4H10a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Zm0 12h-9V9h9v10Z');
    svg.appendChild(path);
    return svg;
  }

  TC.createButtonMount = function createButtonMount({ onClick, isWatchPage }) {
    let button = null;
    let label = null;
    let observer = null;
    let observed = null;
    let retryTimer = null;
    let retries = 0;
    let resetTimer = null;

    function build() {
      button = document.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      button.appendChild(createIcon());
      label = document.createElement('span');
      label.textContent = TC.msg('buttonCopy');
      button.appendChild(label);
      button.addEventListener('click', onClick);
    }

    function setState(state, text) {
      if (!button) return;
      clearTimeout(resetTimer);
      button.dataset.state = state;
      button.setAttribute('aria-busy', String(state === 'busy'));
      label.textContent = text;
      if (state === 'copied' || state === 'error') {
        resetTimer = setTimeout(() => setState('idle', TC.msg('buttonCopy')), RESET_AFTER_MS);
      }
    }

    function stopRetry() {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    function observe(target) {
      if (observed === target) return;
      if (observer) observer.disconnect();
      observer = new MutationObserver(() => {
        if (!button || !button.isConnected) ensure();
      });
      observer.observe(target, { childList: true, subtree: true });
      observed = target;
    }

    function attach() {
      const row = document.querySelector(TC.SELECTORS.actionsRow);
      if (!row) return false;
      if (!button) build();
      if (button.parentElement !== row) row.prepend(button);
      observe(document.querySelector(TC.SELECTORS.watchMetadata));
      return true;
    }

    function remove() {
      stopRetry();
      if (button) button.remove();
    }

    /** Mounts the button on watch pages, retrying for a bounded time while the row renders. */
    function ensure() {
      if (!isWatchPage()) {
        remove();
        return;
      }
      if (attach()) {
        stopRetry();
        return;
      }
      if (retryTimer !== null || retries >= RETRY_LIMIT) return;
      retries += 1;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        ensure();
      }, RETRY_MS);
    }

    return {
      refresh() {
        retries = 0;
        ensure();
      },
      setState,
    };
  };
})(globalThis);
