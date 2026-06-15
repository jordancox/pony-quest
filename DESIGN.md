# Pony Quest 3D — "Excited, Not Distressed"

A three.js comedy game based on the real M25 Shetland pony incident of
**Friday 10 October 2003**, in which Thames Valley Police spokesperson
**Paul Anthem** told the press the loose pony "seemed excited rather than
distressed." You play the pony. Paul's job is to make it sound under control.

Source: https://www.horseandhound.co.uk/news/loose-shetland-closes-m25-41577

## The comedic premise

The screen shows two truths at once:

- **What Paul tells the press** (calm PR narration, top of screen).
- **What is actually happening** (you, a small horse, going the wrong way up
  Britain's busiest motorway while four officers eat tarmac).

The funnier the gap between the two, the better. As you cause more chaos,
Paul's narration drifts further from reality until it's pure damage control.

## Verified facts to anchor the jokes

| Fact | Use in game |
|------|-------------|
| 06:30 first call, road shut 06:50, caught 07:15, reopened 07:37 (47 min) | On-screen clock / closure timer = your score |
| M25 between J15 and J16, near the M4 interchange | Level geometry, motorway signage |
| Pony went **north on the southbound carriageway** (wrong way) | Core movement gag — bonus for facing oncoming traffic |
| **Four officers + members of the public** caught it | The pursuers you evade |
| Paul: "wandering... seemed excited rather than distressed" | Title + recurring narration callback |
| Escaped from a nearby field of other Shetlands | Intro scene / "freedom" framing |

## Game loop (play-as-pony, chaos sandbox)

1. **Intro:** dawn, a field of bored Shetlands. A gap in the fence. You trot out.
2. **The motorway:** open carriageway, sparse early-morning traffic that builds.
   - Drive the pony freely (arrow keys / WASD).
   - Going *against* traffic flow scores more ("excited" meter).
   - Cars brake, swerve, honk, pile into comedy tailbacks behind you.
3. **The cops:** up to four officers spawn and try to corral you. Slapstick
   physics — they slip, collide, lose hats. You juke them.
4. **Pressure:** as chaos rises, the closure timer climbs and Paul's narration
   escalates from "minor incident" to outright fiction.
5. **Capture / ending:** eventually you let yourself be caught (or run the clock
   to 47:00). End on the *Horse & Hound* front page with a headline shaped by
   how much chaos you caused.

## Scoring / meters

- **Excitement** (not Distress): rises with wrong-way driving, near-misses,
  cop pratfalls. Drives Paul's spin level.
- **Tailback length:** visible queue of stopped cars; the game's "high score."
- **Closure clock:** counts toward the real 47 minutes.

## Paul narration ladder (escalating spin)

0. "We have a minor traffic management situation on the M25."
1. "A small animal is being safely escorted from the carriageway."
2. "The pony seems excited rather than distressed."  ← the real quote
3. "Officers are in complete control of the situation."
4. "The, ah — the pony is assisting officers with their enquiries."
5. "I want to stress that at no point was anyone in any danger. Especially me."
6. "Define 'closed'. The motorway is... resting."

(Lines unlock by chaos thresholds; tune later.)

## Tech

- **three.js** via CDN importmap (keeps the repo's self-contained,
  single-file-playable style — no build step).
- Low-poly, flat-shaded, stylised. No realistic assets needed; boxes + simple
  meshes read fine and suit the tone.
- Pony, cops, cars all primitive geometry. Procedural motorway plane with
  painted lane markings (texture or thin boxes).
- Overlay UI (narration, meters, clock) in plain HTML/CSS on top of the canvas.

## Asset list (all primitive / procedural to start)

- Pony: body + head + 4 legs + mane (boxes/cones), bobbing trot animation.
- Cop: capsule body + box hat, ragdoll-ish lurch toward pony.
- Car: box + window strip + wheels; pool of ~20, spawned on lanes.
- Motorway: long plane, dashed centre lines, hard shoulder, gantry sign
  ("M25 — J15 ▸ J16"), barriers.
- Field intro: green plane, fence, 2–3 idle Shetlands.

## Milestones

- **M0 (this scaffold):** scene + drivable pony + chase camera + moving cars +
  one cop + Paul narration overlay. Runnable today. ← `pony-quest-3d.html`
- **M1:** wrong-way scoring + tailback queue logic + excitement meter.
- **M2:** four cops with herding/pratfall behaviour.
- **M3:** intro field scene + closure clock + Horse & Hound ending.
- **M4:** polish — sound, hats flying off, narration timing, mobile/touch.
