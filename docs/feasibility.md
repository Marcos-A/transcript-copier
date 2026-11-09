# Feasibility findings

**Tested:** 2026-11-09 on Google Chrome for Testing 151.0.7922.34, Linux, logged out, YouTube web client 2.20261105.05.01.
**Not tested:** Firefox. Its browser and driver could not be installed in the test environment.

These are observations of undocumented behaviour and may change at any time.

## Caption sources

| Route | Result |
| --- | --- |
| Fetch `captionTracks[].baseUrl` (default, `json3`, `srv3`, `vtt`) from the page | HTTP 200, **empty body**. URLs carry `exp=xpe`. |
| Same URLs with the `pot` value the player used | HTTP 200, empty body, on all 6 tracks. |
| Player's own `timedtext` request (includes `pot`) | HTTP 200, empty body, in this test environment. |
| `POST /youtubei/v1/get_transcript` built from page data | HTTP 400 `FAILED_PRECONDITION`. |
| **Official panel via the Show transcript button** | **Works.** YouTube calls `get_panel`, and all 24 rows of the test video render. |

## Decision

The spec's preferred route, fetching caption payloads, returned no data. The proof-of-origin token behind it is an anti-abuse control, so generating or forging one was not attempted.

The **official panel** is the primary and only source. This also removes the need for a page-world bridge, since rendered rows are readable from the isolated world. If the panel fails, the extension reports a specific error.

### Panel details

- The Show transcript button is in the DOM and clickable while the description is collapsed.
- Modern panel: `target-id="PAmodern_transcript_view"`, rows are `transcript-segment-view-model`.
- Legacy panel `engagement-panel-searchable-transcript` is still present in the page, with `ytd-transcript-segment-renderer` rows. The adapter for it follows known markup but was not exercised live, because the test session always opened the modern panel.
- Each row also holds a visually hidden label such as “1 second”, so text is read from the specific text element only.
- The modern panel has no language menu, so no language setting was built.
- Rows have a start time but no duration.

### Completeness

The panel can be rendered in full, virtualised, or extended lazily. The reader jumps to the bottom and, if new rows appear, walks the whole list and merges rows by time and text. It stops only when the list is stable and no loading indicator remains, and a time limit produces `INCOMPLETE_TRANSCRIPT`.

The panel must stay inside the viewport while it is read, so it is made transparent rather than moved off-screen. Lazy loading of this kind fires only when the next batch is visible; an off-screen panel reproduced the failure users saw on videos over an hour, a long wait and then no copy, in the local simulation of a paginated list.

**Caveat:** only one 3-minute video could be read live here. How the panel behaves on long videos is inferred from that reproduction, and the paginated and virtualised paths are tested only against a local simulation.

## Navigation

The extension uses YouTube's `yt-navigate-start`, `yt-navigate-finish` and `yt-page-data-updated` events on `document`, and compares the video ID from the URL during and after extraction. Rows left over from the previous video are recognised by a fingerprint taken when navigation starts.

## Clipboard

Measured in Chromium 151:

| Case | Without `clipboardWrite` | With `clipboardWrite` |
| --- | --- | --- |
| Short transcript, click | Works | Works |
| Keyboard command on a short transcript | Works | Works |
| Long extraction (about 15 s, 1500 simulated rows) | **Copy never finished** | Works |

So `clipboardWrite` is required. Because a write might never settle, `writeText` is bounded at 3 seconds before falling back to the legacy copy command.

Firefox: MDN documents that writing without recent user activation needs `clipboardWrite`, so the same design should apply, but this has not been run.

## Bot checks

After a small number of page loads, YouTube showed the automated test browser “Sign in to confirm you're not a bot” on most videos. Testing stopped at that boundary, with no attempt to get around it. This is why live coverage is limited to one video. If a user sees this wall, the extension reports a failure instead of copying.

## Signed-in state

Maintainer testing in Edge and Firefox found that YouTube does not show transcripts to logged-out viewers, and that copying works fully when logged in, including on videos over an hour. One automated logged-out session did receive a transcript for one video, so the behaviour may vary by session or video. The extension does not try to work around this.

## Keyboard shortcut

`Alt+Shift+Y` was chosen because it is not in Chrome's or Firefox's published default shortcut lists. Chrome's `Alt+Shift+T`, `B`, `A`, `N` and `I`, and Firefox's `Ctrl+Shift+Y` were avoided. Real key handling was not exercised: the test dispatches the command event directly.
