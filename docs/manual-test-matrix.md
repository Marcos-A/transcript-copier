# Manual test matrix

Run in current stable Chromium and Firefox before calling a release complete. Results below are from 2026-11-09. "Simulated" means the local page in `tests/e2e`, not live YouTube. "By hand" means reported by the maintainer from a normal browser session.

| Scenario | Expected | Chromium 151 | Firefox |
| --- | --- | --- | --- |
| Manual English subtitles | Complete one-click copy | Pass, live, 1 video | Pass, by hand |
| Auto-generated subtitles | Complete one-click copy | To do | To do |
| More than one language track | Same panel language each time | To do | To do |
| Long video (1 hour or more) | Complete copy, no UI freeze | Pass, by hand in Edge; simulated 1500 and 3000 rows | Pass, by hand |
| Video with no captions | Clear error, clipboard unchanged | Simulated | To do |
| Direct visit to watch URL | Button mounts exactly once | Pass, live | To do |
| Click another suggested video | Button works for the new video | Simulated | To do |
| Navigate during extraction | No stale result copied | Simulated | To do |
| Transcript panel initially closed | Copy still works | Pass, live | To do |
| Transcript panel already open | Copy works, panel stays open | Simulated | To do |
| Dark and light mode | Button is legible | Pass, live | To do |
| Copy via keyboard command | Same content, truthful status | Pass, live (event dispatched, not a real key press) | To do |
| Clipboard permission denied | Clear error, no false success | Unit test only | To do |
| Ad playing during copy | Copy works | To do | To do |
| Ad blocker or privacy extension | Graceful behaviour | To do | uBlock Origin, logged out, by hand: transcript does not load, copy reports a timeout |
| Logged in | Note any differences | Pass, by hand in Edge | Pass, by hand |
| Logged out | Note any differences | Pass, by hand in Edge | Pass, by hand, with uBlock Origin off |
| Toolbar icon at 16 and 32 px, light and dark | Play mark and bars legible | To do | To do |
| 48 and 128 px on the extensions page | Correct icon | To do | To do |
| Popup: remove-timestamps toggle changes output | Timestamps appear when off | Simulated | To do |
| Popup: copy button | Same content as the page button | To do | To do |

## Test videos

Developer notes only; never used in production code.

| Class | Video |
| --- | --- |
| Manual captions, several languages | `dQw4w9WgXcQ` |
| Long, auto-generated captions | `kCc8FmEb1nY` (blocked by a bot check in the automated environment) |
| Long lecture | `jGwO_UgTS7I` (not yet tested) |
| No captions | Pick a recent upload whose description has no Transcript section |
