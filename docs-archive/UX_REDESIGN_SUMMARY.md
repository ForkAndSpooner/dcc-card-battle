# UX Testing Session Summary — June 11, 2026

## Branch Status
- `main` — merged from feature/crafting-level-2. Full game with all mechanics.
- `feature/ux-redesign` — this branch. UX improvements based on AI user testing.

## Phase 1: User Testing (Casual DCC Fans)
Two LLM personas (casual DCC fan + Hearthstone lite experience) tested the game and reported:

**Top pain points:**
- Buffs/debuffs mixed with inventory items — impossible to quickly see combat status
- "Rapport" had no explanation — players didn't know what it did or why to care
- Creative Action buried in left sidebar — looked like a minor feature
- Galactic Feed taking visual priority over combat info
- Sponsor not visible without clicking a button
- No first-turn guidance whatsoever

**What they loved:**
- Creative Action concept (typing wild DCC-style plans) was the #1 excitement
- Donut as avatar felt perfect for the IP
- Card art quality was praised
- Mana/attack/HP circles were intuitive for Hearthstone players

## Phase 2: Design Expert Review
Senior UX designer persona reviewed changes. Ratings:
- Sponsor badge on portrait: 5/5
- Separated status/inventory: 4/5  
- Creative Action centered: 5/5
- Galactic Feed collapsed: 4/5
- Rapport tooltip: 4/5
- Collapse/expand toggles: 5/5

Remaining gaps identified:
1. First-turn guidance still missing
2. Rapport needs behavioral feedback (not just tooltip)
3. Color-only status needs shape indicators too

## Changes Implemented

### Left Panel
- **COMBAT STATUS** section (color-coded chips): green=buff, red=debuff, gold=loot
- **INVENTORY** section below (separate, with click-for-details)
- Sponsor shown as compact line (not dominant section)
- Buffs and items no longer mixed

### Center
- **🎲 Creative Action** moved to mid-bar next to End Turn button
- Now treated as the game's "ultimate ability" rather than a sidebar item

### Donut Portrait
- Small sponsor emoji badge overlaid on portrait (always visible)
- Portrait pulses/glows briefly when card rapport increases

### Right Panel  
- Galactic Feed collapsed by default (click to expand)
- Live Feed visible by default
- Both panels have expand/collapse toggles

### First-Time Player Experience
- **FTUE overlay** on first game ever: 5-step guide explaining play cards → attack → Donut missile → Creative Action → End Turn
- Dismisses with "Got it, let's crawl!" and never shows again (localStorage flag)
- Rapport bar tooltip now says exactly what it does: "Chat to build bond: higher rapport = +dmg & better rolls"

## What Still Needs Work (Backlog)
- Shape indicators alongside color for buffs/debuffs (accessibility)
- Dynamic rapport feedback on portrait (partially done — pulse animation)
- "Guided first match" where the game highlights what to do each turn
- Live Feed auto-scroll conflict with reading (needs smart pause)
