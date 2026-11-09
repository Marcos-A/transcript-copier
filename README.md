<p align="center">
  <img src="assets/icon-128.png" alt="Transcript Copier icon" width="88" height="88">
</p>

<h1 align="center">Transcript Copier</h1>

<p align="center">Copy the full transcript of a YouTube video with one click, in Chromium and Firefox.</p>

<p align="center">
  <a href="#installation">Installation</a> &nbsp;·&nbsp;
  <a href="#usage">Usage</a> &nbsp;·&nbsp;
  <a href="#privacy-and-permissions">Privacy</a> &nbsp;·&nbsp;
  <a href="#development">Development</a>
</p>

---

No panel to open, nothing to select, no scrolling. Transcript Copier adds a **Copy transcript** button next to YouTube's video actions and puts the whole transcript on your clipboard.

## Features

- **One click.** Works whether or not YouTube's transcript panel is open, or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>Y</kbd>.
- **Clean by default.** Just the words: no timestamps, branding, or stray interface text.
- **Honest.** “Copied” appears only after the clipboard write succeeds. If a copy fails, your clipboard stays as it was.
- **Keep it private.** No tracking, external requests, or runtime dependencies.

> **Project status:** the name is provisional. Works on live YouTube in Edge and Firefox when logged in. See [test status](#test-status).

## Get the source

```sh
git clone https://github.com/Marcos-A/transcript-copier.git
cd transcript-copier
```

## Installation

### Chromium

Works with Chrome, Edge, Brave, and other Chromium browsers. No build step is required.

1. Open your browser’s extension manager, such as `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `transcript-copier` project folder containing `manifest.json`.
4. Refresh any open YouTube tabs and open a video.

### Firefox

Requires desktop Firefox **142 or newer**. There is no signed package yet, so use a temporary installation, which needs Python 3.9+:

```sh
python3 scripts/build.py firefox
```

Open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, and select `dist/firefox/manifest.json`. Allow YouTube site access if prompted, then refresh YouTube.

Temporary add-ons are removed when Firefox restarts. See Mozilla’s [temporary installation guide](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/).

## Usage

Open a video and click **Copy transcript** beside the like button. The button shows **Copying…**, then **Copied**.

The keyboard shortcut does the same. To change it, open `chrome://extensions/shortcuts` in Chromium, or `about:addons`, then the gear menu and **Manage Extension Shortcuts**, in Firefox.

The toolbar popup also has a copy button, for when the in-page button can’t be shown, and these settings:

| Setting | Default | Effect |
| --- | --- | --- |
| Format | Clean text | **Clean text** joins the transcript into continuous text. **One segment per line** keeps YouTube’s segments. |
| Remove timestamps | On | Turn off to add `[MM:SS]` markers, one segment per line. Videos over an hour use `[HH:MM:SS]`. |
| Include title, channel and link | Off | Adds a short header above the transcript. |

Settings are saved locally. Each browser stores its own.

## Limitations

- Only standard desktop `youtube.com/watch` pages are supported. Shorts, embeds, and YouTube Music are not.
- The extension copies the transcript and language YouTube’s panel shows. **There is no language setting**, because the current panel offers no language menu. Nothing is ever translated.
- A video without a transcript cannot be copied. There is no speech recognition.
- The extension relies on YouTube’s page structure, which can change without notice. Selectors are kept in `src/transcript/selectors.js`.

## Troubleshooting

| Message | What to do |
| --- | --- |
| Open a YouTube video first | Open a `youtube.com/watch` page. Refresh tabs that were open before installing. |
| No transcript available for this video | YouTube offers no transcript for this video, or its page has not finished loading. |
| Couldn’t load captions | The video could not play. Check whether YouTube asks you to sign in. |
| Transcript request timed out | Try again. If it keeps failing, click YouTube’s own **Show transcript**. If no text appears there either, a content blocker may be stopping it: uBlock Origin did this in Firefox when logged out. Turn the blocker off for YouTube and reload. The browser console shows a `[transcript-copier]` line describing what was found, without transcript text. |
| Transcript could not be copied completely | Nothing was copied, because the transcript looked truncated. Try again. |
| Couldn’t access the clipboard | Keep the browser window focused and try again. |
| Video changed; try again | You moved to another video during the copy. |

## Privacy and permissions

The extension runs only on `https://www.youtube.com/`. Transcripts stay in memory while being copied and go only to your clipboard. Nothing is stored, logged, or sent anywhere. It uses `storage` for your settings and `clipboardWrite` so that a transcript can still be copied after the time it takes to load. See [PRIVACY.md](PRIVACY.md).

## How it works

YouTube’s caption URLs now return empty responses to direct requests. So a Manifest V3 content script presses YouTube’s own **Show transcript** button, keeps the panel invisible so the page doesn’t move, reads every row until the list stops growing, then closes the panel. The reasoning and evidence are in [docs/feasibility.md](docs/feasibility.md).

The extension checks that the video has not changed before writing to the clipboard, and rejects transcripts that end before half of a video longer than two minutes.

## Development

Both browser versions share every script. The root `manifest.json` is the common manifest and `browsers/firefox.json` adds Firefox-specific settings. Content scripts are plain classic scripts that share a `TranscriptCopier` namespace, with no bundler.

<details>
<summary>Project structure</summary>

```text
_locales/en/messages.json  All UI text, and the product name
assets/                    Approved icon: SVG master and PNG sizes
browsers/firefox.json      Firefox manifest override
docs/                      Feasibility findings and manual test matrix
manifest.json              Shared manifest; directly loadable in Chromium
scripts/build.py           Browser packaging script
src/background/            Keyboard command routing
src/browser/               Extension API, clipboard, and settings
src/content/               Button, navigation, notifications, styles
src/popup/                 Settings popup
src/transcript/            Panel reading, parsing, and formatting
tests/                     Unit, packaging, and end-to-end checks
```

</details>

### Renaming

The product name is provisional and is defined once, as `extName` in `_locales/en/messages.json`. The manifest, toolbar title, and popup read it from there. Change that value, then update this README and `PRIVACY.md`; a packaging check fails if they no longer mention the name.

### Build packages

Requires Python **3.9 or newer**. No third-party Python packages are needed.

```sh
python3 scripts/build.py           # Both browsers
python3 scripts/build.py chromium  # Chromium only
python3 scripts/build.py firefox   # Firefox only
```

Builds are written to `dist/chromium/` and `dist/firefox/`, with versioned ZIP packages alongside them. Files are copied unchanged. There is no minification, bundling, or transpilation. Generated files are ignored by Git.

### Run checks

Requires Node.js **22 or newer** and Python **3.9 or newer**.

```sh
node --test tests/*.test.cjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

The end-to-end check loads the real extension in Chromium against a local copy of the page structure and never contacts YouTube. It needs Playwright for Python and a display:

```sh
xvfb-run -a python3 tests/e2e/run_chromium.py
```

### Test status

| Check | Chromium family | Firefox |
| --- | --- | --- |
| Unit and packaging checks | Pass | Browser-independent, pass |
| End-to-end on the local page | Pass, Chromium 151 | Not run |
| Live YouTube, logged in | Pass by hand in Edge, including videos over an hour | Pass by hand, including videos over an hour |
| Live YouTube, logged out | Pass by hand in Edge | Pass by hand with uBlock Origin off. With it on, the transcript does not load and the copy times out |

Remaining live scenarios are listed in the [manual test matrix](docs/manual-test-matrix.md).

## Development note

This project was developed under human direction and review, with support from artificial intelligence tools for parts of the code, debugging, and documentation. Decisions about how the system works and responsibility for the final result rest with the project maintainer.

## License

Released under the [MIT License](LICENSE).

## Disclaimer

Transcript Copier is an independent project and is not affiliated with or endorsed by YouTube or Google.
