# Combat Redesign Session — June 12, 2026

## Branch: feature/ux-redesign

## What Was Built

### #1 — Spell/Skill Action Economy ✅
The core combat change. Each card gets **ONE primary action per turn**:
- **Skills** (martial/technical) = FREE, no mana (War Gauntlet, Smush, Backstab, Crowd Blast, etc.)
- **Spells** (magic) = cost mana (Magic Missile, Laundry Day, Graupel, Wisp Armor, etc.)
- A card uses its action on either a skill OR a spell, then is done for the turn
- 39 skills, 21 spells, classified per the book data
- Free Actions (items, loot) still separate from the primary action
- UI shows ⚡ FREE SKILL (teal) vs 🔮 mana SPELL (purple)

This fixes the unthematic "everything costs mana" problem — Carl's Smush isn't magic, and martial cards no longer compete with casters for mana.

### #2 — Weak-Start Horde System ✅
- Added 15 swarm mobs from the lower-floor bestiary (Goblin, Dungeon Rat, Scatterer, Rot Sticker, Troglodytes, Kobold Riders, Danger Dingos, etc.)
- All very weak (1-3 HP, 1-3 ATK on the 1-10 scale) — die in 1-2 hits
- **Enemy board now holds 8 slots** vs the player's 5 — you face hordes
- Enemy deploys up to 3 mobs/turn with bonus mana
- The fantasy: overwhelmed by cheap mobs you mow down for XP/loot, threat from volume not individual strength
- 75% smart-bot win rate (good challenge, winnable)

### #3 — Boss Battle System ✅
9 iconic DCC bosses recreated with full data:
- The Hoarder (F1), Krakaren Clone (F2), Heather the Roller-Skating Bear (F3), Ringmaster Grimaldi (F3), Mimic Rex (F4), Lusca (F5), Queen Imogen (F6), Reminiscence Hydra (F8), Shi Maria the Bedlam Bride (F8)
- Each has: themed minions, unique mechanic, threat level, book-accurate intro quote, thematic reward
- **Boss battles trigger on the 3rd win of a floor** (the final fight before advancing)
- **Cinematic intro**: "⚔️ BOSS BATTLE ⚔️" splash, boss emoji float-in, name, threat fire-meter, visual description, the boss's intro quote, mechanic warning, and reward preview — 5.5 second sequence
- Boss decks: minions in hand + boss centerpiece

## Validation
- 0 invariant violations, 0 fuzz crashes
- Smart bot: 75% on hordes, appropriate challenge
- All syntax checks pass

## Still On the Table (from the design discussion)
- #4 Chaos/kinetic energy: Hype Meter + escalating hazards (NOT a hard timer — we agreed against it)
- Boss-specific mechanics fully wired (currently they use standard abilities; the unique mechanics like Mimic Rex split, Imogen intangibility, Shi Maria cockroach are described but not all mechanically implemented yet)
- Boss card art generation
- Swarm mob art
