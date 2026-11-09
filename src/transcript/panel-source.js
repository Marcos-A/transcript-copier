// Reads the transcript from YouTube's own transcript panel, the only source that returned data
// in the feasibility spike (docs/feasibility.md). The panel is opened invisibly, read until the
// list stops growing, and restored. No page-world code or undocumented request is involved.
(function (root) {
  const TC = (root.TranscriptCopier = root.TranscriptCopier || {});

  const TIMING = Object.freeze({
    buttonWaitMs: 8000,
    rowsWaitMs: 30000,
    collectLimitMs: 150000,
    stallLimitMs: 20000,
    pollMs: 100,
    scrollSettleMs: 120,
    walkStepMs: 60,
    stableTicks: 3,
    shortTicks: 25,
    closeWaitMs: 1000,
  });

  const EXTRACTING_ATTR = 'data-transcript-copier-extracting';
  const KEEP_ATTR = 'data-transcript-copier-keep';

  function createPanelSource(env = {}) {
    const doc = env.document || root.document;
    const win = env.window || root.window;
    const timing = { ...TIMING, ...env.timing };
    const sleep = env.sleep || ((ms) => new Promise((resolve) => win.setTimeout(resolve, ms)));
    const now = env.now || (() => Date.now());
    const S = TC.SELECTORS;

    const allPanels = () => Array.from(doc.querySelectorAll(S.panel));
    const isExpanded = (panel) => panel.getAttribute('visibility') === TC.PANEL_EXPANDED;

    function readPanel(panel) {
      for (const adapter of TC.ROW_ADAPTERS) {
        const elements = Array.from(panel.querySelectorAll(adapter.row));
        if (elements.length === 0) continue;
        const rows = elements.map((element) => ({
          time: textOf(element.querySelector(adapter.time)),
          text: textOf(element.querySelector(adapter.text)),
        }));
        return { rows, source: adapter.source };
      }
      return null;
    }

    const textOf = (element) => (element ? element.textContent : '');

    function signatureOf(rows) {
      const head = rows.slice(0, 3).map((row) => `${row.time}|${row.text}`).join('\n');
      return `${rows.length}:${head}`;
    }

    /** Fingerprint of any rendered rows, captured when navigation starts to spot leftovers. */
    function currentSignature() {
      for (const panel of allPanels()) {
        const read = readPanel(panel);
        if (read) return signatureOf(read.rows);
      }
      return null;
    }

    function findExpandedTranscript(staleSignature) {
      for (const panel of allPanels()) {
        if (!isExpanded(panel)) continue;
        const read = readPanel(panel);
        if (read && signatureOf(read.rows) !== staleSignature) return panel;
      }
      return null;
    }

    function findScroller(panel, firstRow) {
      let node = firstRow;
      while (node && node !== panel) {
        const overflow = win.getComputedStyle(node).overflowY;
        if (node.scrollHeight > node.clientHeight + 1 && overflow !== 'visible') return node;
        node = node.parentElement;
      }
      return null;
    }

    async function waitFor(check, limitMs, guard) {
      const deadline = now() + limitMs;
      for (;;) {
        guard();
        const value = check();
        if (value) return value;
        if (now() >= deadline) return null;
        await sleep(timing.pollMs);
      }
    }

    async function openPanel(staleSignature, guard) {
      const button = await waitFor(() => doc.querySelector(S.showTranscriptButton), timing.buttonWaitMs, guard);
      if (!button) {
        if (doc.querySelector(S.playerError)) throw new TC.TranscriptError('TRACK_UNAVAILABLE', 'player error');
        throw new TC.TranscriptError('NO_CAPTIONS');
      }
      button.click();
      const panel = await waitFor(() => findExpandedTranscript(staleSignature), timing.rowsWaitMs, guard);
      if (!panel) {
        throw new TC.TranscriptError(doc.querySelector(S.playerError) ? 'TRACK_UNAVAILABLE' : 'TIMEOUT', 'no rows');
      }
      return panel;
    }

    /**
     * Gathers every row, merging across scroll positions so a virtualised or lazily extended list
     * is still read in full. A jump to the bottom settles the common fully rendered case quickly.
     * While the rows end well before the video does, the list gets longer to prove it has stopped.
     */
    async function collectAllRows(panel, guard, durationMs) {
      const merged = new Map();
      let source = null;
      let renderedCount = 0;
      let lastRowMs = 0;
      const collect = () => {
        const read = readPanel(panel);
        if (!read) return 0;
        source = read.source;
        renderedCount = read.rows.length;
        const before = merged.size;
        for (const row of read.rows) {
          merged.set(`${row.time}\u0000${row.text}`, row);
          lastRowMs = Math.max(lastRowMs, TC.parseTimestamp(row.time) ?? 0);
        }
        return merged.size - before;
      };
      const isLoading = () => Boolean(panel.querySelector(S.panelLoading));
      const endsEarly = () => Number.isFinite(durationMs) && lastRowMs < durationMs * 0.9;

      collect();
      const firstRow = panel.querySelector(TC.ROW_ADAPTERS.map((adapter) => adapter.row).join(','));
      const scroller = firstRow && findScroller(panel, firstRow);
      const deadline = now() + timing.collectLimitMs;

      async function settle(requireBottom) {
        let stable = 0;
        let lastProgress = now();
        while (stable < (endsEarly() ? timing.shortTicks : timing.stableTicks)) {
          guard();
          if (now() >= deadline) throw new TC.TranscriptError('INCOMPLETE_TRANSCRIPT', 'collection limit');
          await sleep(timing.scrollSettleMs);
          const added = collect();
          if (added > 0) lastProgress = now();
          if (now() - lastProgress >= timing.stallLimitMs && isLoading()) {
            throw new TC.TranscriptError('INCOMPLETE_TRANSCRIPT', 'loading stalled');
          }
          stable = added > 0 || isLoading() ? 0 : stable + 1;
          if (requireBottom && scroller) scroller.scrollTop = scroller.scrollHeight;
        }
      }

      const savedTop = scroller ? scroller.scrollTop : 0;
      try {
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
        await settle(true);
        if (scroller && merged.size > renderedCount) {
          // Rows seen earlier have left the DOM, so the list recycles them: walk it to catch all.
          scroller.scrollTop = 0;
          for (;;) {
            guard();
            if (now() >= deadline) throw new TC.TranscriptError('INCOMPLETE_TRANSCRIPT', 'collection limit');
            await sleep(timing.walkStepMs);
            collect();
            const bottom = scroller.scrollHeight - scroller.clientHeight;
            if (scroller.scrollTop >= bottom - 1) break;
            scroller.scrollTop = Math.min(bottom, scroller.scrollTop + Math.max(200, scroller.clientHeight * 0.8));
          }
          await settle(true);
        }
      } finally {
        if (scroller) scroller.scrollTop = savedTop;
      }
      if (isLoading()) throw new TC.TranscriptError('INCOMPLETE_TRANSCRIPT', 'still loading');
      return { rows: Array.from(merged.values()), source };
    }

    async function restore(panel) {
      if (panel) {
        const close = panel.querySelector(S.panelCloseButton);
        if (close) {
          close.click();
          const deadline = now() + timing.closeWaitMs;
          while (isExpanded(panel) && now() < deadline) await sleep(timing.pollMs);
        }
      }
      doc.documentElement.removeAttribute(EXTRACTING_ATTR);
      allPanels().forEach((item) => item.removeAttribute(KEEP_ATTR));
    }

    /** Returns { rows, source } for the current video; `guard` throws once the video changes. */
    async function extract({ guard, staleSignature = null, durationMs = Number.NaN }) {
      const alreadyOpen = findExpandedTranscript(staleSignature);
      if (alreadyOpen) return collectAllRows(alreadyOpen, guard, durationMs);

      const scrollY = win.scrollY;
      allPanels().filter(isExpanded).forEach((panel) => panel.setAttribute(KEEP_ATTR, ''));
      doc.documentElement.setAttribute(EXTRACTING_ATTR, '');
      let panel = null;
      try {
        panel = await openPanel(staleSignature, guard);
        return await collectAllRows(panel, guard, durationMs);
      } finally {
        await restore(panel || allPanels().find((item) => isExpanded(item) && !item.hasAttribute(KEEP_ATTR)));
        win.scrollTo(win.scrollX, scrollY);
      }
    }

    return { extract, currentSignature };
  }

  TC.createPanelSource = createPanelSource;
})(globalThis);
