# Chore Raid

> Your home is a dungeon. Each chore is a boss made of the actual mess.
> You damage it by doing the real work, one item at a time.

**Play it:** https://choreraid.netlify.app (made for phones; works on desktop with Space/Enter)

Built for the Hackyard build week (theme: **Gamification**), Oct 5–9, 2026.

<p>
  <img src="docs/screenshots/hub.jpg" width="19%" alt="Hub" />
  <img src="docs/screenshots/raid.jpg" width="19%" alt="Raid" />
  <img src="docs/screenshots/windup.jpg" width="19%" alt="Boss wind-up" />
  <img src="docs/screenshots/loot.jpg" width="19%" alt="Loot" />
  <img src="docs/screenshots/win-card.jpg" width="19%" alt="Win card" />
</p>

## The idea

Most chore apps gamify the *list*: you tick a box and get a sticker. Chore Raid gamifies the *work itself*, while you are doing it.

1. Pick a boss: **The Laundry Leviathan**, **The Sink Hydra**, **The Clutter Golem**, or summon your own for any chore.
2. Count the pile. That number is the boss's HP. Snap a before photo.
3. Do the chore. Tap the phone once (anywhere on the screen) for every item you finish: a folded shirt, a washed plate, a thing put away.
4. The boss dies exactly when the chore is done. Open the loot chest, snap the after photo, and get a win card as proof.

## The one rule: HP is sacred

**1 hit = 1 real item.** Nothing in the game can kill the boss before the chore is actually finished. Combos, crits and boss heals all exist, but they change your **score** and your **loot**, never the HP. That is what keeps the game honest: you can't win without doing the chore.

## Game mechanics

- **Combos:** keep hitting within 20 seconds to climb ×2 → ×3 → ×4. The hit sound rises in pitch as the streak builds.
- **Boss wind-ups:** every 25–35% of the pile, the boss winds up and demands up to 3 items within 20 seconds each. Beat it for a CRITICAL, bonus score and a Loot Star. Miss it and the boss smugly heals its Ward (you lose a Loot Star, never progress).
- **Loot Stars → loot rarity:** 0–5 stars shift the odds of a common, rare, epic or legendary trophy from the chest.
- **Undo:** a mis-tap is one button away, so the count stays honest.
- **Trophy room:** 24 trophies to collect, with locked ones shown as silhouettes, plus your raid history.
- **Custom bosses:** "Summon a boss" turns any countable chore (plants, emails, bills) into a Mess Elemental.

## Built to be played without looking

Your eyes are on the laundry, not the phone, so the game is audio-first:

- **Spoken progress** in a deadpan boss voice: "Halfway. 10 dishes left." "The Hydra regrows a head. 3 dishes in 60 seconds."
- **Synthesized sound effects** for every hit, combo, wind-up tick, crit, heal, heartbeat at low HP and death.
- **Haptics** on hits (Android).
- **Optional voice hits:** say "hit", "done" or "next" instead of tapping. The mic pauses while the game is talking, so it never hears itself.
- **Screen stays awake** during a raid (Wake Lock API, with a tip where it isn't supported).
- **Resume after reload:** a locked phone or an accidental swipe never loses a 40-item pile.

## Game feel

The raid is a WebGL scene (PixiJS) over a painted boss: hit-stop on every strike, a white flash, squash-and-stretch, screen shake that scales with the combo, impact particles made of the boss's material, floating damage numbers, a red aura during wind-ups, and on death the boss shatters into pieces.

## How AI was used

- **Code:** written with Claude Code (Anthropic) during the build window, from a plan we wrote together ([PLAN.md](PLAN.md)). I made the design calls (the HP-is-sacred rule, the deadpan tone, the art direction); Claude implemented, tested and iterated.
- **Art:** the painted boss art was generated with **Bloom** from our own art-direction brief ([docs/ART_DIRECTION.md](docs/ART_DIRECTION.md)), then cut out into game sprites with a small script ([tools/cutout.py](tools/cutout.py)).
- **Audio and voice:** no AI audio. Sound effects are synthesized in code with the Web Audio API, and speech uses the browser's built-in text-to-speech.

## Tech

- Vite + React 19 + TypeScript, Tailwind CSS v4, Motion for UI animation
- PixiJS 8 for the raid scene
- Web Audio API (synthesized SFX), Web Speech API (speech + voice hits), Wake Lock API, Vibration API
- IndexedDB for everything (raids, photos, loot). **No backend, no account:** your photos never leave your phone.
- Vitest for the game logic: the raid reducer is pure and tested, including the HP rule, combos, wind-ups and loot odds.
- Hosted on Netlify

## Run it locally

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # game logic tests
npm run build   # production build in dist/
```

## License

[MIT](LICENSE)
