// Routes the keyboard command to the active tab. Stores nothing and makes no requests.
const ext = globalThis.browser || globalThis.chrome;
const BADGE_MS = 4000;

function flagUnsupported(tabId) {
  const options = tabId === undefined ? {} : { tabId };
  ext.action.setBadgeBackgroundColor({ ...options, color: '#FF0033' });
  ext.action.setBadgeText({ ...options, text: '!' });
  ext.action.setTitle({ ...options, title: ext.i18n.getMessage('error_UNSUPPORTED_PAGE') });
  setTimeout(() => {
    ext.action.setBadgeText({ ...options, text: '' });
    ext.action.setTitle({ ...options, title: ext.i18n.getMessage('extName') });
  }, BADGE_MS);
}

ext.commands.onCommand.addListener(async (command) => {
  if (command !== 'copy-transcript') return;
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  try {
    await ext.tabs.sendMessage(tab.id, { type: 'transcript-copier:copy', deliver: 'clipboard' });
  } catch {
    // No content script answered, so this tab is not a YouTube page.
    flagUnsupported(tab.id);
  }
});
