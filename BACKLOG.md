# DCC Card Battle — Backlog (updated 2026-06-13)

## ✅ DONE (recent → older)
- **Carl + Donut protagonist system**: Carl auto-deploys each battle, Crawler's Grit (survive first lethal at 1 HP), protagonist death = true Game Over, enemies target bodyguards first.
- **Smart enemy AI** (heuristic): best-value ability selection, threat-based targeting, impact-ordered deployment, scales 55%→95% smart by floor. Player win rate: normal 61-89%, bosses 46-89%.
- **In-game feedback widget** (💬 floating button → state snapshot → ~/shared/dcc-feedback/)
- **Match analyst** (post-game LLM assessment → ~/shared/dcc-insights/)
- **Progression reframe** — not a roguelite; forward-only "the Crawl." Retry on loss (protagonists alive). **Recruit-an-ally** after each floor (pick 1 of 3 to permanently join deck).
- Old-scale purge, bold proximal communication, target-scope labels, attack FX engine, balance pass
- **Balance pass** (verified via tools/balance-tester.js): free skills to "base + raw stat" (was *2, removed 1.8-2.1x outliers) + cooldowns on spammed skills; deep-floor (6/9/12) enemy stat scaling + bigger waves (was 100%/4-round → 69-91%/7-9 rounds); boss tuning (Krakaren tentacle cap, Blood Sultanate heir re-summon); sponsor rescale (GlubGlub con_aura 8→2 etc., spread 25→21pts); Pounce finisher 1.8→1.4. Net: all floors 69-91% normal / 53-100% boss, 0 invariant violations.
- Feedback batch: evolution stats to 1-10 scale (Mongo 255 fix), conscript keeps abilities + from board, sentient weapons/dolls to card slot, craft modal (scroll/sticky/sort/filter/mana warning), card-detail buffs/debuffs, color-coded action banners, voice conversation fallbacks + Creative Action dictation, card badge clipping fix
- Unique boss mechanics + spectacle (15 bosses), boss-mechanics.js
- All enemies + boss minions have art (182 card PNGs). Robust multi-candidate art resolver (`cardArtCandidates`/`artErr`)
- Persistence fix: inventory + equipped gear now carry between battles (save was firing before reconcile; equipped id mismatch fixed)
- Scroll of Upgrade upgrades weapon/armor (was wrongly +20 all stats); friendly item text in loot/discover; welcome screen shows once (localStorage); player cards no longer clip HP/ATK badges; harder early enemies (opening wave + deploy cap 4)
- Canon floor data 1-9 wired (floors.js), floor-advance shows lore + System Rule
- Sequential floors 1→18, boss every 3rd battle, descend-stairs cinematic
- Distinct ability mechanics (multiHit, lowHpBonus, fullHpBonus, executeBonus, fromStealth, finisher, ignoreArmor, lifesteal, dodgeBuff, exhausts)
- ~50/50 spell/skill aggregate split (32/28)
- Boss battle system (9 bosses, minions, cinematic intro, triggers on 3rd floor win)
- Weak-start horde system (15 swarm mobs, enemy 8 slots vs player 5)
- Boss + swarm mob art (24 images), card art resolver fix
- ElevenLabs music (9 stage tracks) + 22 SFX wired to events
- Settings modal (music/SFX/voice on-off+volume, fast mode)
- Status effects system (40 buffs/debuffs/diseases) + Codex browser + status chips + alert banners
- Kill announcements (crash-through text + combos), crit visuals
- Discover loot (pick 1 of 3), post-game breakdown, feed notification badge
- Per-item attack animations, data editor (/editor.html)
- Donut as hero/avatar, Hero Power, sponsor unlock system
- Ability unlock on level-up (L3, L5), floor transition cinematic
- God system (summon, boon/chaos, status auras, portraits, right-panel)
- Crafting L1 (LLM combine) + L2 (Creative Action DM mode) + canonical recipes
- 1-10 stat rebalance (from 1-300), full ability rebalance
- Master items DB (125 items, 9 categories)
- UX redesign (combat status vs inventory separation, FTUE overlay, rapport tooltip)
- Sentient weapons as board entities, plushie summoning
- 12 dungeon environments with backgrounds + weighted enemy pools
- 43 characters with book-accurate abilities + art + voices

## 🔥 HIGH PRIORITY — NEXT UP
- [ ] **Floor 9/12 bosses still ~89-96%** — need dedicated floor-10+ bosses in BOSSES, or scale Sultanate mechanic harder. Syndicate Ascended lack boss-mechanics.js entries.
- [ ] **Deck management UI** — let the player view/reorder their party roster between battles (see who's in, who they've recruited, swap out cards).
- [ ] **Carl-specific quest line / personality** — Carl should feel like the main character, not just a stat-stick. Give him unique dialogue triggers, progression decisions.
- [ ] **Event log panel** (from earlier feedback) — accessible via Settings, shows all game actions and outcomes (mana gains, kills, buffs etc.) for clarity.
- [ ] **Deck Building UI** — choose which cards go in your deck between battles (currently fixed)
- [ ] **Character Creation (D&D-style)** — race/class, stat point allocation, starting skills, backstory passive → custom crawler card with generated art
- [ ] **#4 Chaos/kinetic energy: Hype Meter + escalating hazards** (NO hard timer — agreed against). Chain kills/crits/creative-actions → hype → bonus loot, crowd reactions, AI excitement. Dungeon drops mid-fight hazards (lava AoE, gravity flip, "collapse in 3 turns").
- [ ] **Pet mechanic** — Mongo as Donut's pet, pet biscuits to upgrade, pet box drops

## 🟡 MEDIUM
- [ ] Boss-specific reward boxes (Boss Box already drops; make rewards themed per boss)
- [ ] Non-combat encounters (exploration/traps/puzzles between battles)
- [ ] Audience voting on targets (viewer milestone reward)
- [ ] Drug addiction system (Blitz Sticks: INT buff + withdrawal counter)
- [ ] More god portraits (some still use ⚡ fallback)
- [ ] Remaining voice gen (Dungeon AI unhinged + named chars — some pending in voice-map)
- [ ] Tomes/scrolls that teach spells mid-run (Dungeon Anarchist's Cookbook unlocks recipes)
- [ ] Fast Mode wired to server-side enemy turn pacing (currently client-only)
- [ ] Tiara variants for Donut (Thousand Lights, Sepsis Whore, etc.)
- [ ] Sponsor viewer-progress bar in HUD (flagged by playtester)

## 🔵 VISUAL/UX
- [ ] Shape + icon for status chips (colorblind accessibility)
- [ ] Weapon/armor icon already on cards — verify rendering
- [ ] Evolution transform animation (currently text only)
- [ ] Per-card unique attack animations (partial — item FX done)
- [ ] Live Feed smart auto-scroll pause while reading

## 🟢 LOW / FUTURE
- [ ] PvP mode, Endless/Arena mode
- [ ] TypeScript migration (deferred — risky mid-dev, no player value)
- [ ] Code refactor: split battle.js, split game.js
- [ ] CSS cleanup pass

## KNOWN QUIRKS / NOTES
- Card ATK badge shows CURRENT damage incl. temporary buffs (can spike then return to base — not a bug)
- Fuzz tester win% is low because it plays randomly; smart-bot is the real balance signal
- ElevenLabs Music v2 not on API key (UI only) — using v1
- save file at ~/shared/dcc-save.json; DEFAULT_SAVE.floor = 1

## CANON DATA AVAILABLE (in resources/, from Book AI — not yet all wired)
- `Dungeon Crawler Carl Levels and Floor Mechanics.md` — full detail floors 1-9 (wired into floors.js)
- `Crawler Dungeon Compendium and System Mechanics.md` — has data NOT yet wired:
  - **Loot tiers**: Bronze→Silver→Gold→Platinum→Legendary→Celestial + specialty (Boss/Benefactor/Fan/Asshole-Savage/Spicy boxes). Celestial = game-breaking, heavily taxed.
  - **Stats (canon function)**: STR=melee power, DEX=dodge/evasion, CON=HP+regen+potion frequency (low CON = Potion Sickness), INT=mana(1:1)+spell duration (need INT≥2 for inventory/training), CHA=shop discounts+sell value+charm NPCs. Base 3-5, +3 points/level.
  - **Sponsors (canon)**: Valtay (Carl — wetware/HUD pills), The Apothecary (Donut/Katia/Prepotente — Cosmic Buff potions), Open Intellect Pacifist Action Network, Jaxbrin Amusements (Bautista — summoning plushies), Dictum Waystation (navigation). Higher bids = cheaper loot boxes for crawler.
  - **Currency/shops**: gold (drops from floor 2), General Stores (buy anything, pricey), saferoom vending (Hoop Cola/Warka/Mana Toast), Desperado Club (guilds, pharmacy w/ Blitz Sticks, casino Wheel of Fortune 10k gold/spin), Marketplace (eBay-style, opens floor 6).
  - **New bosses with canon mechanics** to add: Ball of Swine (f1 rolling), The Juicer (f2 neck-vein), Gore-Gore Mantaur (f4 train driver), Ghazi/Chaindrive/Quetzalcoatlus (f5 quadrants), Odious Creepers (f6 night-combine), Blood Sultanate (f9 succession).
