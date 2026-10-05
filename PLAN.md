# Chore Raid — Build Plan

> Your home is a dungeon. Each chore is a boss made of the actual mess.
> You damage it by doing the real work, one item at a time.

Hackyard build week: **Mon Oct 5 18:00 UTC → Fri Oct 9 18:00 UTC**. Feature freeze **Fri Oct 9 12:00 UTC**.

---

## 0. The one rule everything else serves

**HP is sacred: 1 hit = 1 real item. The boss dies exactly when the chore is done.**

The brief asks for both "the boss only dies when the chore is done" and "combo multipliers / bonus damage / boss heals". Those conflict: if a 3× combo deals 3 damage, the boss dies with two-thirds of the laundry still on the bed.

**Resolution** (approved Oct 4):

| Mechanic | Affects HP? | What it actually changes |
|---|---|---|
| Hit | **−1 HP**, always | Real progress |
| Combo multiplier | No | **Score** (`10 × multiplier` per hit), callouts, sound pitch climbing |
| Wind-up beaten | No | Big "CRIT!" moment, bonus score, **+1 Loot Star** |
| Wind-up missed | No | Boss "heals" its **Ward** (a second, gold bar): **−1 Loot Star**, taunt |
| Loot Stars (0–5) | No | Rarity of the loot drop at the end |

The heal still *feels* like a heal (green glow, a rising bar, a smug sound) but it costs you loot, not extra chores. Damage numbers show score (`+30`), and the HP bar always drops by exactly one segment.

---

## 1. Scope tiers

**MUST (definition of done):** count → HP, giant tap target, undo, combos, wind-ups, synthesized SFX, spoken progress, Wake Lock + fallback, 3 bosses with damage states, death + loot, before/after photos, win card PNG, hub with total items conquered, IndexedDB persistence (including resuming a raid after a reload), deployed.

**SHOULD:** voice hits, trophy room, custom bosses, hero skins, share sheet for the win card.

**CUT FIRST if we slip (in this order):** hero skins → voice hits → trophy room becomes a plain list → custom bosses reuse one generic SVG.

**STRETCH (only if all of the above ships):** streaks, boss regrowth over days, elite bosses, PWA/offline.

---

## 2. Stack & dependencies

- `npm create vite@latest` → React + TypeScript
- Tailwind v4 via `@tailwindcss/vite`
- `motion` (Framer Motion's current package, `motion/react`)
- **That's it.** No router (a screen state machine), no IDB library (an ~80-line wrapper), no audio library (Web Audio synthesis), no html2canvas (the win card is drawn on a `<canvas>` by hand).
- Dev only: `vitest` for the raid reducer (pure logic, cheap to test, catches the HP-math bugs that would ruin a demo).
- Deploy: Netlify via its GitHub integration (set up in the Netlify dashboard).

---

## 3. Data model

```ts
type BossKind = 'laundry' | 'dishes' | 'clutter' | 'custom';

interface BossDef {
  id: string;                 // 'laundry' | 'dishes' | 'clutter' | uuid
  kind: BossKind;
  name: string;               // "The Laundry Leviathan"
  chore: string;              // "Fold the laundry"
  unit: string;               // "item" | "dish" | "thing" (used in speech: "12 dishes left")
  countPrompt: string;        // "How many items are in the pile?"
  hue: number;                // custom boss tint
  createdAt: number;
  builtIn: boolean;
}

type RaidStatus = 'active' | 'won' | 'abandoned';

interface Raid {
  id: string;
  bossId: string;
  maxHp: number;              // the count the player entered
  hp: number;                 // derived from hits, stored for quick reads
  status: RaidStatus;
  startedAt: number;
  endedAt?: number;
  hits: Hit[];                // kept inline: max a few hundred per raid
  score: number;
  bestCombo: number;
  lootStars: number;          // 0–5, starts at 2
  windups: { startedAt: number; target: number; beaten: boolean }[];
  beforePhotoId?: string;
  afterPhotoId?: string;
  lootId?: string;
}

interface Hit {
  at: number;
  source: 'tap' | 'voice' | 'key';
  combo: number;              // multiplier at the moment of the hit
  undone?: boolean;           // soft undo keeps the history honest
}

interface Photo { id: string; raidId: string; blob: Blob; w: number; h: number; takenAt: number; }

interface LootItem {
  id: string;
  type: 'trophy' | 'skin';
  name: string;               // "Leviathan's Lost Sock"
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  bossKind: BossKind;
  earnedAt: number;
  raidId: string;
}

interface Profile {           // singleton key 'me'
  totalItems: number;
  raidsWon: number;
  equippedSkin: string;
  settings: { muted: boolean; voiceHits: boolean; speech: boolean; volume: number };
}
```

**IndexedDB stores:** `bosses`, `raids` (index on `status`), `photos`, `loot`, `profile`. A small `db.ts` with `get/put/getAll/delete` and one `openDB` with versioned upgrades.

**Photos:** taken via `<input type="file" accept="image/*" capture="environment">` (it works everywhere, and the camera opens straight away on phones). Downscaled to max 1280px JPEG at 0.8 quality on a canvas before storing, so the IDB stays small.

**Active raid** is written to IDB after every hit (debounced 250ms). On app load, an `active` raid shows a "Resume raid?" prompt, so a locked phone or an accidental swipe-back doesn't kill a 40-item pile.

---

## 4. Game rules (tunable constants in `src/game/tuning.ts`)

| Constant | Start value | Notes |
|---|---|---|
| `HIT_COOLDOWN_MS` | 700 | Stops a wet palm from registering a double hit. Nobody folds a shirt in 0.7 s |
| `COMBO_WINDOW_MS` | 20 000 | Each hit refills the meter; it drains visibly |
| Combo multiplier | 1× → 2× at 3 hits → 3× at 6 → 4× at 10 | Callouts: "Combo!", "Triple!", "UNSTOPPABLE" |
| Wind-up trigger | every ~25–35% of HP, never in the last 3 items, never with HP < 5 total | |
| Wind-up demand | `min(3, hp - 1)` items in `20s × target` (3 items → 60 s) | Scaled by the boss's unit |
| Speech progress | every 5 hits, plus at 50%, at 3 left, and on the last hit | "Halfway! 12 shirts left" |
| Undo | small corner button, also long-press | Restores HP, breaks the combo |

All of the raid logic lives in a **pure reducer** `raidReducer(state, action, now)` with actions `HIT | UNDO | TICK | WINDUP_START | ...`. Side effects (sounds, speech, persistence) subscribe to the events it emits. That keeps the game testable and the components dumb.

---

## 5. Screens (simple state machine, no router)

```
Hub ──► BossSetup (count → before photo) ──► Raid ──► Victory (death → loot → after photo) ──► WinCard ──► Hub
 │                                            ▲
 ├──► TrophyRoom                              └── Resume prompt on load
 ├──► CustomBossForm
 └──► Settings (sheet: mute, voice, speech)
```

1. **Hub:** "The Dungeon". Three boss doors plus a "+ Summon a boss" door, a lifetime "Items conquered" counter, a trophy room link, a mute toggle.
2. **BossSetup:** a big number stepper (− / + / type it in), the boss's own prompt ("Count the pile. Every sock counts."), then "Snap BEFORE photo" or "Skip", then "BEGIN RAID" (this button also unlocks audio and the wake lock).
3. **Raid:** the boss fills the top two-thirds and the **whole screen is the tap target**. HP bar with segments, combo meter, wind-up countdown banner, tiny undo/pause/mute in the corners (`stopPropagation`, large enough not to be hit by accident). Also accepts Space/Enter on desktop.
4. **Victory:** death animation (shake → crack → burst into particles plus the boss's material: socks, plates, toys), a loot chest that opens on tap and shows its rarity, then the "Snap AFTER photo" prompt.
5. **WinCard:** a canvas-rendered card with before | after, the boss trophy, items, time, best combo, score, loot. Save PNG, plus Share (Web Share API with files when available).
6. **TrophyRoom:** a grid of loot (silhouettes for unearned items), raid history, equip skin.
7. **CustomBossForm:** chore name, unit word, hue slider → a generic "Mess Elemental" SVG tinted to the hue.

---

## 6. Component tree

```
<App>                         screen state, profile context, audio/speech providers
├─ <Hub>
│   ├─ <BossDoor boss/>  ×n
│   ├─ <ConqueredCounter/>
│   └─ <IconButton mute/>
├─ <BossSetup boss>
│   ├─ <CountStepper/>
│   └─ <PhotoCapture label="BEFORE"/>
├─ <RaidScreen raid>          uses useRaid() (reducer + timers + persistence)
│   ├─ <TapSurface onHit/>    full-screen pointerdown, cooldown, haptics (navigator.vibrate)
│   ├─ <BossArt kind hpPct stage hit windup/>
│   │   └─ <LaundryLeviathan/> | <SinkHydra/> | <ClutterGolem/> | <MessElemental hue/>
│   ├─ <HpBar hp max ward/>
│   ├─ <ComboMeter combo drainPct/>
│   ├─ <WindupBanner remaining secondsLeft/>
│   ├─ <DamageNumbers/>       floating "+30", "CRIT!"
│   ├─ <Particles/>           a lightweight canvas burst layer
│   ├─ <ScreenShake>          motion wrapper keyed on hit
│   └─ <RaidControls undo pause mute/>
├─ <Victory raid>
│   ├─ <BossDeath kind/>
│   ├─ <LootChest loot/>
│   └─ <PhotoCapture label="AFTER"/>
├─ <WinCard raid/>            <canvas> + save/share
├─ <TrophyRoom/>
└─ <CustomBossForm/>

src/
  game/    tuning.ts, raidReducer.ts (+ test), loot.ts, bosses.ts, speechLines.ts
  audio/   sfx.ts (Web Audio synth), speech.ts (TTS queue), voice.ts (recognition)
  lib/     db.ts, photos.ts, wakeLock.ts, winCard.ts, id.ts
  ui/      components above
```

---

## 7. Audio design (most important: the player is looking at the laundry)

All synthesized with Web Audio, so there are no asset licenses to worry about:

- **Hit:** noise burst + pitched thump; the pitch rises a semitone per combo step
- **Combo tier-up:** arpeggio + a spoken callout
- **Wind-up start:** a low rising drone + a boss taunt line ("The Hydra regrows! Three dishes in sixty seconds!")
- **Wind-up ticks:** a soft tick in the last 10 s, louder in the last 3 s
- **Wind-up beaten:** a power chord + "CRITICAL!"; **missed:** a reverse-swell "heal" + a smug taunt
- **Boss low HP:** heartbeat pulse below 20%
- **Death:** a descending sweep + explosion; **loot:** a sparkle arpeggio by rarity
- **Speech:** a `speechSynthesis` queue that drops stale progress lines instead of stacking them, with ducked SFX while speaking. Per-boss line banks (taunts, progress, death)

Platform gotchas handled in the plan:
- iOS needs a user gesture before audio plays → "BEGIN RAID" resumes the `AudioContext` and primes TTS with an empty utterance.
- The iOS silent switch mutes Web Audio → show a one-time "Ringer on?" hint on iOS.
- Voice recognition can hear the TTS → recognition **pauses while the game speaks**, and no TTS line contains the trigger words "hit/done/next".

---

## 8. Platform features

- **Wake Lock:** `navigator.wakeLock.request('screen')`, re-acquired on `visibilitychange`. Fallback: a visible "Set auto-lock to Never for this raid" tip. (The muted-looping-video trick is fiddly and battery-heavy. Skip it unless real-phone testing shows we need it.)
- **Voice hits:** `SpeechRecognition || webkitSpeechRecognition`, continuous, auto-restart on `end`, matching `/\b(hit|done|next|smash)\b/` on interim results, with the same cooldown as taps. Hidden when unsupported; shows a "mic listening" indicator. Off by default, toggled in setup.
- **Haptics:** `navigator.vibrate(15)` on a hit where supported (Android; iOS ignores it).

---

## 9. Art direction

- Dark dungeon palette (deep indigo/stone) with one hot accent per boss. A chunky pixel-ish display font from Google Fonts (e.g. "Press Start 2P" for numbers, a readable sans for everything else).
- Each boss is a hand-built SVG with **4 damage stages** (100–75 / 75–50 / 50–25 / 25–0%): cracks appear, it shrinks ~25% overall, the expression goes smug → annoyed → panicked → desperate, and an idle sway that gets more frantic.
  - **Laundry Leviathan:** a serpent of tangled shirts and socks, sock-puppet eyes, sleeves for fins.
  - **Sink Hydra:** three plate-headed necks rising from suds, fork teeth. A head drops off at each stage.
  - **Clutter Golem:** a stacked-junk humanoid (books, a shoe, a mug, cables). Blocks fall off as HP drops.
  - **Mess Elemental:** a generic tinted blob with the chore name on a banner.
- On hit: a white flash on the SVG, a squash-stretch, particles in the boss's material colors.

---

## 10. Day plan

Times are UTC. Each milestone ends with: run it, fix it, commit, push, deploy, and a **"test this with a real chore"** checklist for you.

**Day 1 (Mon 18:00 → Tue):** repo + MIT LICENSE + README stub + PLAN.md (first commit), Vite scaffold, Tailwind, Netlify deploy. `db.ts`, data model, built-in bosses. Hub → count → Raid with a full-screen tap and HP bar → boss dies → back to hub. Raid reducer with tests. Resume after reload. *Ugly but playable, deployed.*

**Day 2 (Tue → Wed):** combo meter, wind-ups, Loot Stars/Ward, the full SFX set, the speech queue with progress lines, Wake Lock, undo, voice hits. **You fold a real pile with eyes on the laundry. The question to answer: can you play it without looking?**

**Day 3 (Wed → Thu):** the three boss SVGs with damage stages, particles, shake, damage numbers, death + loot chest, photos, win card canvas, trophy room, custom bosses.

**Day 4 (Thu → Fri 12:00 freeze):** a real-phone bug bash across all three chores, perf on a mid-range Android, polish, final deploy. README (concept, how to play, how AI was used, stack, screenshots, live link), DEMO_SCRIPT.md. The afternoon before 18:00 is a buffer only.

**Deadline tripwires:** if Day 1 isn't playable end-to-end by Tue 18:00, voice hits and hero skins are cut immediately. If the boss art isn't done by Thu 12:00, the bosses ship as stylized 2-stage SVGs.

---

## 11. Decisions (answered Oct 4)

- **HP is sacred** (§0): approved.
- **Hosting:** Netlify.
- **Target devices:** both Android and iPhone, since users could have either. Voice hits ship with feature detection and must never be required. The tap path is primary, and both platforms get equal QA on Day 4.
- **Tone:** deadpan. ("The Leviathan is unimpressed. Eleven items remain.")
- **Hero skins:** they change the weapon (hit sound, particle shape, ripple color).
- **Schedule:** aim to have the full MUST + SHOULD list live by **Wed Oct 7 18:00 UTC** (48 h after kickoff). Thu–Fri go to the real-phone bug bash, polish and the video. No code is written before kickoff.
- **Repo:** `Bdot0311/chore-raid` (public), created and first pushed at kickoff (Mon Oct 5 18:00 UTC), not before.
- **Commit author:** `Bdot0311 <236258625+Bdot0311@users.noreply.github.com>`.
- **Netlify:** GitHub integration via the dashboard. The Netlify CLI isn't installed locally.
