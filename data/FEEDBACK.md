# Game Design Feedback

Generated: 2026-06-06T17:59:38.573Z

## Claude Sonnet 4 (via Bedrock)

ERROR: Bedrock 403: {"message":"Model access is denied due to INTERNAL_SERVICE_ERROR:Internal service error.. Your AWS Marketplace subscription for this model cannot be completed at this time. If you recently fixed this issue, try again after 2 minutes."}

---

## Gemini 3 Pro

[gemini-2.5-pro]

Excellent. This is a robust and well-considered design document. You've clearly put a ton of thought into capturing the spirit of the books. As requested, here is a candid, specific critique.

---

### 1. Adherence to the Books

This design *nails* the tone and atmosphere of Dungeon Crawler Carl. The core concepts of the Sponsors and the unhinged Dungeon AI are not just present, they are central, mechanical pillars of the game. That is a massive success.

**What's Right:**
*   **The Dungeon AI:** The Instability Counter and Event Deck are pure genius. This perfectly captures the feeling of the AI as a character who is both a corporate shill and a barely-contained chaos entity. The idea that it can start "helping" you out of sheer spite or system failure is 100% DCC.
*   **Sponsors:** Making them a mechanical resource track with tangible interventions is the correct move. The sponsor names and effects are thematic and feel right (GlubGlub, Borant, etc.).
*   **Loot-centric Gameplay:** The focus on kill-bound loot boxes and the constant gear chase is spot-on. The two-deck system (safe Character vs. risky Loot) is a clever abstraction of Carl deciding whether to rely on his skills or pray for a good drop.
*   **Character Abilities:** The abilities generally match the characters' personalities. Mongo smashes, Donut is a charismatic glass cannon, Carl has his cockroach survivability.

**What's Missing or Wrong:**
*   **The Player's Role:** The biggest thematic disconnect is the abstract "Player HP." In the books, we are inside **Carl's head**. He is the protagonist, not a disembodied party manager. When Donut is in danger, *Carl* is in danger because she's his anchor. The game currently treats all characters as equal assets. This robs the game of its central point-of-view.
*   **Achievements & Skill Books:** A defining feature of Carl's progression is the absurdly specific achievements and the game-breaking skill books he finds. The current leveling system (`+10 to a stat`) is generic and misses this core flavor. Where is "You've killed 100 goblins with a shoe. You unlock the 'Podiatrist of Doom' skill"?
*   **Crafting:** You've deferred this, but it's not a secondary system in the books; it's a primary engine of survival and creativity for Carl. It needs to be a core mechanic, not an afterthought.

### 2. Gameplay Fun

This looks like it would be a blast for dedicated fans, but potentially bogged down by its own systems.

**What's Brilliant:**
*   **Emergent Narrative:** The combination of the Dungeon AI Event Deck, the Instability Counter, and the Sponsor Interventions will create incredible "water cooler" moments. No two games will feel the same. A "Commercial Break" event happening right when you're about to die, or the AI spawning a mob on your side because it's glitching, is peak DCC fun.
*   **Meaningful Choices:** The turn-by-turn decision of "Draw Character or Loot?" is simple but profound. The pre-battle choice of a Sponsor will drastically change your strategy. These are great design elements.
*   **Rapport System:** Using rapport as a threshold unlock instead of a dice roll is smart. It creates a long-term bond with your cards and makes you invest in them, which feels very appropriate for the story.

**What's Tedious:**
*   **The Math Problem:** You call it "flat math," but there are six different divisors for stats (`/5`, `/7`, `/10`, `/20`, `/30`, `/50`, `/100`). In a game with multiple characters and enemies, every single action will require a player to stop and do arithmetic. `(Base + STR/10) - (Target_CON/50) - (Target_DEX/30)`. This will grind the game to a halt. It's the definition of "fiddly."
*   **Bookkeeping Overload:** Players will need to track: Mana, Cooldowns (per ability), Status Effects (per card), Sponsor Favor, AI Instability, Rapport (per card), and temporary stat buffs. This is a heavy cognitive load and will require a mountain of tokens or a dedicated app to manage without frustration.
*   **Slow Ramp-Up:**
