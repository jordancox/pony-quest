# Pony Quest: illustrated reboot

## Direction

Retain the escaped-Shetland-pony comedy premise. Rebuild around original, richly illustrated VGA-style environments inspired by the background craft of Monkey Island 2 and Indiana Jones and the Fate of Atlantis. The approved comparison board established warm country-lane colours and atmospheric teal/amber motorway lighting.

The artwork is a production asset, not a flattened interface. Canvas renders a 960 × 640 world with separate pony and Paul walk cycles, collectible rope, placed cone, contact shadow and police-light glints. Semantic HTML handles contextual interaction, the pocket tray, scene hotspots, dialogue and keyboard access. Backgrounds and sprites are local; image generation is never called during play.

## Prologue and first chapter

1. **Prologue — the pony:** inspect the high gate latch, collect the loose rope, and use it to escape. Reaching the motorway ends the prologue.
2. **Handover:** a chapter card announces Paul Anthem. The player explicitly continues as Paul, with a separate inventory and viewpoint. The pony remains visible as an NPC at the motorway.
3. **Paul — secure the scene:** obtain a cone from the maintenance hut, mark the checkpoint, then radio Control to stop the traffic. Placing a cone alone does not close the road.
4. **Paul — recover the pony:** return to the inn, ask the innkeeper for a carrot, and offer it to the pony once the road is closed. Early attempts preserve the carrot and explain the missing step.
5. **Paul — speak to Horse & Hound:** report over the radio and choose a reply. The conversation converges on the real quote. Every route ends with the original Horse & Hound headline and a linked, paraphrased account of the real event.

Paul can travel between both rooms. Observations, dialogue, objectives, chapter labels and inventory labels follow the controlled character. Speech from the pony during Paul's chapter is animal sounds, not translated thoughts.

There are no losing states, timed interactions or consumable dead ends. Hints follow the puzzle state. Player identity, story flags, inventory and pending chapter handover persist in local storage. Earlier pony-only saves preserve the escape and enter at the handover; they do not transfer the pony's old motorway inventory into Paul's pockets.

## Art integration

The production backgrounds were generated separately from the approved concept board, with characters and UI omitted. Both characters have four equally spaced walking poses. Paul uses the original `paul.jpg` face reference with a game-specific roadside outfit. A corrected magenta-background export is chroma-keyed into cached sprite frames once on load, leaving clean game-layer transparency. Frames are bounded separately and anchored to the ground line. Position-dependent scaling gives a small amount of depth. Actors are drawn in ground-height order so Paul and the pony overlap correctly.

Walk coordinates are constrained to each room's ground region. Background doors and scenery use explicit click regions with DOM buttons, so they work with mouse, touch and keyboard. Puzzle state drives which props are visible.

## Scope

This is the first playable chapter of a fresh implementation. More rooms, authored character animation, foreground occlusion layers, music, and a longer puzzle chain can be added to this foundation. Previous experiments are preserved separately.

## Controls

No persistent verb list. A primary click talks, collects, opens or walks according to the target. Right-click, keyboard E, or touch-and-hold examines it. Item selection happens in a small pop-up pocket tray, which closes after selecting an item. The bottom strip previews the action and provides the pockets toggle and item-cancel button. Optional examination is not required to solve any puzzle.

## Horse & Hound ending

The real report is the destination of the game, not an optional alternative headline. Source: [Loose Shetland closes M25](https://www.horseandhound.co.uk/news/loose-shetland-closes-m25-41577), Horse & Hound, 10 October 2003, 16:07. The epilogue uses the real headline, a short quotation attributed to Paul Anthem, a paraphrased summary and the 06:30 / 06:50 / 07:15 / 07:37 timeline. On small screens the article scrolls within the game. Its source link opens in a new tab; playing again starts with the pony.
