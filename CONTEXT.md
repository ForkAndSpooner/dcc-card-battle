# DCC Card Battle — Master Context (updated 2026-06-13)

> **Persistent backup:** `~/shared/dcc-card-battle/` (survives space loss). Restore: see its `RESTORE.md`. Re-sync after major changes: `bash tools/backup-to-shared.sh`.

## WHAT THIS IS
A web-based card battle game inspired by the **Dungeon Crawler Carl** book series. Hybrid card game / tabletop RPG with AI-powered character voices (ElevenLabs), an AI Dungeon Master for creative actions (Gemini), real-time combat, crafting, loot, gods, sponsors, status effects, boss battles, and an alien audience system.

## HOW TO RUN
- Server: `cd /workspace/card-battle && node server.js > server.log 2>&1 &` (port 3000)
- Restart pattern: `kill $(lsof -t -i:3000) 2>/dev/null; sleep 1; node server.js > server.log 2>&1 & sleep 3`
- Validate after engine changes: `node tools/simulate.js` (checks balance, invariants, fuzz crashes) — ALWAYS run this
- Syntax check: `node -c src/engine/battle.js && node --check public/js/game.js && node -c server.js`
- Env: `/workspace/.env` — ELEVENLABS_API_KEY, GEMINI_API_KEY, FIRECRAWL_API_KEY, CLAUDE_API_KEY (sk-ant direct, NOT Bedrock)

## GIT / BRANCHES
- **main** — stable baseline
- **feature/ux-redesign** — CURRENT working branch (all recent work). Has everything.
- Routes: `/` = version select page; `/stable/` and `/experimental/` both serve the game; `/editor.html` = data editor
- After file changes bump cache version in index.html (`game.js?v=N`)
- Commit frequently. Never push.

## KEY FILES
- `src/engine/battle.js` (~1400 lines) — core engine: ABILITIES registry, STAT_MAP, BattleEngine class, combat resolution, enemy AI, gods, donut hero, hero power
- `src/engine/status-effects.js` — 48 book-accurate buffs/debuffs/diseases (registry, apply/tick/cleanse)
- `src/engine/bosses.js` — 9 boss encounters with minions/mechanics/intros
- `src/engine/syndicate.js` — floor enemies (floor 3 mobs/elites/boss, floors 6/9/12 aliens) + 15 swarm mobs
- `src/engine/environments.js` — 12 dungeon locations across floors 3/6/9/12, weighted enemy pools
- `src/engine/crafting.js` — L1 crafting (combine 2 items via Gemini), canonical recipes, item effect hints
- `src/engine/dm-agent.js` — L2 crafting (Creative Action: type any plan, AI evaluates + dice roll)
- `src/engine/gods.js`, `sponsors.js`, `audience.js`, `progression.js`, `evolution.js`, `keywords.js`, `weapons.js`, `armor.js`, `quests.js`, `achievements.js`, `rng.js`, `invariants.js`
- `server.js` (~667 lines) — Express + WebSocket, message routing, game-over/progression
- `public/js/game.js` (~1854 lines) — all client logic
- `public/js/sound.js` — audio system (music/sfx/voice channels + settings)
- `public/css/game.css` (~742 lines) — all styling
- `public/editor.html` — in-browser data table editor for items/mobs/recipes
- `data/items-master.json` — 130 items (9 categories), `data/mobs.json`, `data/recipes.json`, `data/voice-map.json`
- `tools/simulate.js` (validation harness), `tools/generate-art.js`, `tools/generate-music.js`, `tools/generate-sfx.js`, `tools/generate-voices.js`
- `resources/*.md` — 20 book-lore source docs (characters, items, bosses, gods, spells, environments, status effects)

## CORE MECHANICS (current state)

### Stats: 1-10 scale (NOT 1-300 anymore — converted)
- HP = 10 + CON×3 ; DR = CON×1.5% ; damage = base + STR (raw stat is the contribution)
- Stats can exceed 10 via items/buffs (intentional)

### Action Economy (spell/skill split — KEY RECENT FEATURE)
- Each board card gets ONE primary action per turn: a free **SKILL** OR a **SPELL** (costs mana)
- 32 skills / 28 spells (~50/50 aggregate, classified per book data)
- `card.usedAction` flag; reset each turn
- Free actions (items, loot, craft) are SEPARATE from the primary action
- Abilities have `kind: 'spell'|'skill'`. Spells show 🔮+cost, skills show ⚡ FREE
- Distinct ability mechanics: multiHit, lowHpBonus, fullHpBonus, executeBonus, fromStealth, finisher, ignoreArmor, lifesteal, dodgeBuff, exhausts

### Mana: starts at 4, +1/turn up to 10

### Donut as Hero/Avatar
- Donut's portrait IS the player HP bar (top-center). Her death = game over.
- Free Magic Missile (1/turn), Laundry Day (3 mana, strips enemy buffs), Cockroach passive (survives first lethal hit)
- Board cards are her bodyguards; empty board = enemies hit Donut directly
- Sponsor emoji badge on her portrait

### Carl as Protagonist
- **Carl auto-deploys** to the board at the start of every battle (never stuck in hand/deck).
- **Carl or Donut dying = TRUE Game Over.** The only real failure state.
- **Crawler's Grit**: Carl survives his first lethal hit at 1 HP (once per battle). Second death = end.
- Enemies prefer non-protagonist targets (bodyguards must fall first) — makes positioning meaningful.
- Losing a battle with both protagonists alive = **retry** that battle (no progress lost).

### Floors & Progression (the Crawl — continuous, forward-only)
- **Not a roguelite** — you don't die and reset. You progress through the dungeon. Only Carl or Donut dying ends the game.
- Losing a battle with both protagonists alive = retry that battle, not restart.
- **Floors 1 → 18 sequential** (canon-accurate names/desc/rules for 1-9 in `src/engine/floors.js`; 10-18 placeholders awaiting book data)
- Each floor = 2 battles; **2nd battle is the boss**; clear the boss → **recruit a new ally** (pick 1 of 3 cards to join your party permanently) → "descend the stairs" cinematic → next floor
- **Losing with both protagonists alive = retry the battle.** Only Carl or Donut dying ends the game.
- Canon floors: 1 First Floor (Garbage Dump), 2 White Labyrinth, 3 Over City, 4 Iron Tangle, 5 The Bubbles, 6 Hunting Grounds, 7 Great Race, 8 Ghosts of Earth (the card-game floor!), 9 Faction Wars/Larracos
- Boss floor assignments in bosses.js are canon-accurate (Hoarder=1, Krakaren=2, Heather/Grimaldi=3, Mimic Rex=4, Lusca=5, Imogen=6, Hydra/Shi Maria=8); getBossForFloor falls back to nearest lower boss for floors without a dedicated one
- Each battle = environment from that floor (env reused 3/6/9/12 until dedicated art) with matching background + weighted enemy pool
- Enemy board holds 8 slots (vs player's 5); deploys up to 3/turn — hordes of weak mobs

### Combat extras
- Crits: DEX×2.5% chance (cap 30%), 1.75x damage, big "CRIT!" text
- Kill announcements: crash-through text "GOBLIN SMUSHED!" + combo banners (DOUBLE/TRIPLE KILL/RAMPAGE)
- Status effects show as colored chips on cards + red banner alert when applied
- Enemy turn paced ~1.2s/action with timed SFX

### Systems
- **Gods** (Celestial Grenade summons one): boon + hidden chaos, thematic status auras (Khepri→Immortal, Ysalte→Vinegar, etc). God Zone panel top-right.
- **Sponsors**: 8 corps, start with Borant, unlock 7 more via viewer milestones. Each has a Hero Power (1 mana/turn) + favor-based intervention.
- **Crafting L1**: combine 2 inventory items → Gemini invents result with structured effects. Canonical recipes (Moonshine+Goblin Oil=Jug O'Boom). Rate to save permanent recipe.
- **Crafting L2 (Creative Action)**: type any DCC-style plan → DM agent evaluates feasibility, rolls d20+stat vs difficulty, narrates success/failure, executes effects.
- **Discover loot**: open box → pick 1 of 3 items
- **Status effects**: 48 effects, Codex browser (📖 button)
- **Ability unlocks** at card level 3 and 5
- **Plushie summoning**: tag-pull items spawn temporary allies
- **Sentient weapons** (Spunky Jefferson): deploy as indestructible 1-HP board entities

### Audio
- 9 ElevenLabs v1 music tracks (per-floor ambient, boss, victory/defeat, menu) — auto-swap by stage, start on first interaction
- 22 SFX wired to events (card play/attack/death, loot, spells by type, crits, boss horn, level up, craft, etc.)
- v2 music NOT available on the API key (UI-only) — generator ready to swap model_id when enabled
- Settings modal (⚙️): Music/SFX/Voice on-off+volume, Fast Mode toggle

### Art
- 43 character cards, 15 boss cards (9 original + 6 new), ALL enemies have art (61 enemy images generated this session — mobs, alien hunters/commanders/ascended gods, named bosses), 6+ god portraits, 12 environment backgrounds. 163 total card PNGs in public/cards/.
- Robust art resolver `cardArtCandidates(card)` → tries boss_/no-prefix/name variants in order, `artErr()` walks candidates then falls back to emoji. Handles generic ids (mob_0), boss_ prefix, trailing digits, hyphenated names.
- `tools/generate-enemy-art.js` — resume-safe enemy art generator with curated visual dictionary
- Generated via Gemini 3 Pro Image

## ROSTER (43 characters)
Main: carl, donut, mongo, mordecai, hekla, katia, imani, bautista, prepotente, odette
New: samantha (severed doll head — indestructible, fastball/conscript+sacrifice), elle, britney, li_jun, li_na, popov_twins, miriam_dom, chris_andrews, tran
Others: louis, florin, signet, miriam, langley, yolanda, lucia_mar, borant_exec, maestro, changeling_carl, changeling_donut, brutus, hellhound, zev, ferdinand (Gravy Boat), esther, fenwick, vex, silas, shrieker, the_warden, echo
Evolutions: donut_chonk, carl_primal, mongo_giant, hekla_berserker

## BALANCE STATUS
- simulate.js: 100% optimal-bot balance, 0 invariant violations, 0 fuzz crashes (fuzz bot is random so low win% is expected; smart-bot ~75% on floor 3 hordes)
- Stats 1-10, level scaling +1 STR/INT +2 CON per level

## VALIDATION RULE
After ANY engine change: run `node tools/simulate.js`, confirm 0 violations & 0 crashes, then restart server.
