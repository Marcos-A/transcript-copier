// Single access point for the WebExtensions API. Firefox exposes `browser`, Chromium `chrome`.
(function (root) {
  const TC = (root.TranscriptCopier = root.TranscriptCopier || {});
  TC.ext = root.browser || root.chrome;

  /** Localised UI string; `$1` style substitutions are positional. */
  TC.msg = (key, ...substitutions) => TC.ext.i18n.getMessage(key, substitutions.map(String)) || key;
})(globalThis);
