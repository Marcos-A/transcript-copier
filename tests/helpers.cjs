// Loads the extension's classic scripts into this process's global namespace.
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

for (const file of [
  'src/transcript/errors.js',
  'src/transcript/selectors.js',
  'src/transcript/parse-captions.js',
  'src/transcript/normalize.js',
  'src/transcript/panel-source.js',
  'src/transcript/transcript-service.js',
  'src/browser/clipboard.js',
  'src/content/navigation.js',
]) {
  require(path.join(ROOT, file));
}

module.exports = { TC: globalThis.TranscriptCopier, ROOT };
