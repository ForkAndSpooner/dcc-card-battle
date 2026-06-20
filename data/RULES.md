# DCC Card Game — Battle Rules v4 (Math Fixed)

## Core Math Change (v4)

**Damage scales with stats. Defense is percentage-based, not flat.**

- Physical damage: `base + STR/2` (Carl STR 85 → base 3 + 42 = 45 damage from Crowbar)
- Spell damage: `base + INT/2` (Donut INT 120 → base 2 + 60 = 62 from Magic Missile)
- Damage reduction: `CON/6`% (Imani CON 150 = 25% reduction, not 150 flat)
- Evasion reduction: `DEX/10`% chance to halve incoming damage (Odette DEX 165 = 16% half-damage)
- Healing: `base + CHA/4` (Bea CHA 95 → base 5 + 23 = 28 heal)
- HP: `50 + CON/2` (Imani: 50 + 75 = 125 HP. Donut: 50 + 27 = 77 HP.)
- Mana regen bonus: `INT/100` extra per turn (Donut +1, Mordecai +1)

### Why this works
- Hekla (STR 135): Crowbar = 3 + 67 = 70 damage. Against Imani (25% reduction) = 52 actual. Imani has 125 HP. Dies in ~2.5 hits. Feels right.
- Donut (INT 120): Magic Missile = 2 + 60 = 62 damage. Glass cannon.
- Mongo (STR 145): Smash = 72 damage single target. Beast.
- Mobs (STR 40): basic attack = 20 damage. Manageable chip.

### Stat growth stays 1-300 but numbers land in the 20-100 damage range naturally.

---

## Mana Economy Fix (v4)

**Start at 3 mana, +1/turn, cap 10.** (Not 1 — removes dead early turns.)
- Turn 1: 3 mana — play a 2-cost + use a 1-cost ability. Real decisions immediately.
- Turn 5: 7 mana — big plays online.
- Turn 8+: 10 mana cap — dump hand, go wild.

---

## Rapport Fix (v4)

**Rapport unlocks are tiered but don't create power creep.**
- Ability 3 unlocked at rapport 30 (modest threshold)
- Ability 4 (ultimate) at rapport 70
- Bonded status at rapport 100: NOT +20 all stats. Instead: **card cannot permanently die** (revives at half HP next battle). This is flavor-powerful without stat inflation.

---

## Full Stat Blocks (v4 math)

```
                STR  INT  CON  DEX  CHA   HP   Dmg(basic) DR%
Carl            85   45   80   70   50   90   45         13%
Donut           30  120   55  100  140   77   62(spell)   9%
Mongo          145   15  130   75   35  115   72          21%
Mordecai        40  130   65   60   85   82   (utility)  10%
Imani          100   55  150   55  120  125   53         25%
Hekla          135   25  110   90   65  105   70         18%
Prepotente      50  110   70   65  155   85   57(spell)  11%
Bautista        95   60   85  105   45   92   50         14%
Odette          75   85   45  165   70   72   42(dex)     7%
Lucia Mar       90  105   70  175  140   85   47/54      11%
```

Mob stat examples:
```
Goblin         30   15   40   35   10   70   18          6%
Hobgoblin      50   25   60   40   15   80   28         10%
Shade Gnoll    70   30   55   65   20   77   38          9%
Borough Boss  110   80  140  100   60  120   58         23%
Floor Boss    180  150  200  120  100  150   93         33%
```

---

## Abilities (v4 rebalanced)

### Carl
- **Crowbar Strike** [1 mana] — `3 + STR/2` physical (45). Bread & butter.
- **Jug O'Boom** [3 mana, CD 3] — `5 + STR/2` fire to target (47) + 25 splash adjacent. Burning 2 turns (15/turn).
- **Hole in the World** [4 mana, CD 6] — Banish one non-boss enemy 2 turns. Can't target bosses.
- **Protective Shell** [3 mana, CD 3] — Shield ally, absorbs next 60 damage.
- **Cockroach** [Passive] — Once/battle: survive lethal at 1 HP.

### Donut
- **Magic Missile** [1 mana] — `2 + INT/2` magic (62). Single target nuke.
- **Overcharged Missile** [X mana] — Fire X missiles, each `2 + INT/2` at separate targets. Costs X mana total.
- **Princess's Decree** [4 mana, CD 4] — All allies +40 STR for 2 turns.
- **Hate-Boner** [2 mana, CD 2] — Taunt all enemies 1 turn. Donut gains +50 CON (DR goes to ~17%).
- **Royal Demeanor** [Passive] — +50% rapport gains.
- **Compelling Narcissism** [Passive] — Each kill by Donut: +5 sponsor favor.

### Mongo
- **Stomp** [2 mana] — `STR/4` to ALL enemies (36 to all). Board clear for weak mobs.
- **Mongo Smash** [2 mana] — `STR/2` to one (72). Single target crusher.
- **Devour** [3 mana, CD 3] — If enemy < 30% HP: kill it, heal Mongo 40.
- **Loyal to Mommy** [Passive] — Donut on board: +30 STR (Mongo Smash becomes 87).

### Mordecai (weak attack added)
- **Claw Swipe** [1 mana] — `INT/4` damage (32). Usable but not his role.
- **Tactical Analysis** [2 mana, CD 2] — Mark enemy (next hit +50% damage). Reveal stats.
- **Manager's Boon** [3 mana, CD 3] — All allies +30 STR and +30 INT for 2 turns.
- **System Edge** [Passive] — See top card of AI's deck.

### Hekla (capped)
- **Battle Frenzy** [1 mana] — `4 + STR/2` physical (71). Big single hit.
- **Berserker Rage** [3 mana, CD 4] — Double damage on next attack. Take 20 self-damage.
- **Skald's Glory** [Passive] — +10 STR per kill (cap +40). Capped.
- **Defiant** [Passive] — Below 50% HP: +50% damage.

---

## Turn Structure (v4)

1. **Start**: +1 max mana (cap 10), refill, tick effects, AI draws Event
2. **Draw**: Choose Character or Loot deck
3. **Main**: Play cards, use abilities, use items, spend Sponsor Favor (any order)
4. **End**: Open kill-loot, check quests, pass to AI

---

## Everything else from v3 stays:
- Two-deck system (unchanged)
- Sponsor system (unchanged — 8 sponsors, favor track, interventions)
- AI Event Deck + Instability counter (unchanged)
- Status effects (10, unchanged)
- Quest system (unchanged)
- Leveling: XP thresholds, +10/stat/level, death = -1 level
- Kill-bound loot (unchanged)
- Rapport thresholds (30/70/100 as above)
- Damage types (5 types, strong/weak +/-50%)
- Player HP: 30 + floor×5. Card death = 5 + level face damage.
