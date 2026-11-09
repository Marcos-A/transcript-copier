// Output preferences. Only these settings are ever persisted; transcripts never are.
(function (root) {
  const TC = (root.TranscriptCopier = root.TranscriptCopier || {});

  const DEFAULT_SETTINGS = Object.freeze({ format: 'clean', removeTimestamps: true, metadata: false });

  TC.DEFAULT_SETTINGS = DEFAULT_SETTINGS;

  TC.loadSettings = async function loadSettings() {
    try {
      const stored = await TC.ext.storage.local.get('settings');
      return { ...DEFAULT_SETTINGS, ...(stored && stored.settings) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  };

  TC.saveSettings = (settings) => TC.ext.storage.local.set({ settings });
})(globalThis);
