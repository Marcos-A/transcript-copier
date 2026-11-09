# Privacy

Transcript Copier has no accounts, analytics, telemetry, crash reporting, remote logging, or backend.

## Data flow

1. When you ask for a copy, the extension presses the **Show transcript** button on the YouTube page you are viewing. YouTube loads the transcript exactly as it would if you had pressed the button yourself.
2. The extension reads the transcript from the page into memory and formats it.
3. The text is written to your system clipboard, and the extension's copy is discarded.

The extension makes no network requests of its own. No transcript or video information is sent to the developer or to any third party. What you later do with the copied text is up to you.

## Storage

Only your output settings (format, remove timestamps, and metadata header) are stored, locally, through the browser's extension storage. Transcripts, video titles, and viewing history are never stored. Transcript text is never written to the console.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| Access to `https://www.youtube.com/*` (content script) | To show the button and read the transcript panel. |
| `storage` | To remember your output settings. |
| `clipboardWrite` | To copy after the transcript has loaded. Testing showed that without it, Chromium's clipboard write can hang once a long transcript has taken several seconds to load. |
| Keyboard command | Declares the shortcut. It grants no data access. |

The extension does not request clipboard read access, cookies, history, downloads, or access to other websites.

## Site terms

The extension uses YouTube's own transcript panel in your browser session. It does not bypass sign-in, age checks, bot checks, or any other access control. YouTube provides no official API for this, and the extension makes no claim to be endorsed by YouTube.
