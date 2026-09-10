# Pony Quest — The Secret of the M25

A fresh illustrated browser adventure: two connected rooms, separate eight-frame walking sprites for the pony and Paul, contextual point-and-click controls, inventory puzzles, branching conversation, and a complete opening-chapter ending.

Open `index.html`, or serve this directory:

```sh
python3 -m http.server 8090
```

Visit `http://localhost:8090`. There is no build step, CDN, API call, or runtime dependency. All artwork is local. `pony-quest-lucasarts.html` also redirects to this version. The previous front page is preserved as `pony-quest-previous.html`; older experiments are independent files.

## Playing

Play the prologue as the pony: escape the gate and reach the motorway. The chapter card then hands control to Paul Anthem. As Paul, mark the checkpoint, radio Control to hold the traffic, ask the innkeeper for a carrot, recover the pony and give a press statement. Your replies shape the conversation, but the game always ends with the real Horse & Hound report, “Loose Shetland closes M25.”

Click or tap the ground to walk. Click an object to perform its natural action. Object names appear only on hover or keyboard focus. Right-click to examine, or press and hold on touchscreens. Open the inventory icon, select an item, then click its target. Selecting an item closes the tray. Clicking the ground puts the item away and walks.

`H` reveals hotspots, `I` toggles inventory, `E` examines the focused object, and `Escape` puts an item away and closes the tray. Speech advances automatically above the speaking character. Space skips a line. Walking continues during dialogue. Radio messages appear separately at the right with an emitter cue from the car and an optional radio squawk. All objects are keyboard-focusable. The options icon contains sound, fullscreen, hotspots, help and hints. There are no permanent scene captions, inventory labels or instruction strips.

Progress, player identity and the chapter handover save locally, where browser storage is available. Saves from the earlier pony-only game keep their completed escape and resume at the handover to Paul. No data leaves the browser. Sound is off initially. Reduced-motion preferences disable the walk-frame cycling and flashing police lights.

## Files

- `game.js`: room objects, puzzle state, dialogue, sprite rendering, audio and saves.
- `game.css`: minimal scene controls, anchored speech, inventory and narrative screens.
- `assets/fonts/`: locally bundled VT323 monospace font and its SIL Open Font License.
- `assets/art/`: local generated background plates and walking sprite sheets.
- `ART-DIRECTION.md`: generation method and production prompts.
- `scripts/check.mjs`: browser playthrough with desktop and touch screenshots.
- `scripts/check-motion.mjs`: checks all eight walking frames and head registration during actual browser movement.

## Verification

With the local server running, Puppeteer Core installed, and Chrome available:

```sh
CHROME_PATH=/path/to/chrome node scripts/check.mjs
```

`GAME_URL` can override the default `http://localhost:8090`. The test covers the pony-to-Paul handover, the complete recovery puzzle chain, dialogue, the fixed Horse & Hound epilogue and source link, inventory consumption, save/resume, old-save migration, replay, help, hints, sound and mobile layouts. Screenshots are written to `output/`.

This is a playable opening chapter. The room illustrations are static; characters and collectible props are separate browser-rendered layers. Gate traversal cuts to the next room, and the innkeeper and Control speak offscreen through the inn door and radio. Paul is the playable on-screen character after the prologue, and the pony becomes an NPC. It does not yet include a larger campaign, voiced dialogue or bespoke gate-opening animation.

## The real ending

The final screen is an epilogue based on [Horse & Hound’s original report](https://www.horseandhound.co.uk/news/loose-shetland-closes-m25-41577), published 10 October 2003 at 16:07. It preserves the headline, Paul’s short quote, the incident timeline, and a direct link to the full report. The article summary is paraphrased. The source opens only when the player chooses the link; the ending itself works offline.

Run `node scripts/check-motion.mjs` with the same server and Chrome setup to check the animation. Sprite frames use stable head and ground anchors, a common scale, distance-based gait timing and eased acceleration/deceleration. The canvas renders at twice the logical world resolution to reduce position quantization.
