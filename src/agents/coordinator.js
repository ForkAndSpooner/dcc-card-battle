// Smart Voice Coordinator - routes speech to actions OR the right character
// Receives full game state so it can answer strategy questions and execute commands
const { generateJSON } = require('../api/gemini');

const COORDINATOR_SYSTEM = `You are the voice coordinator for a Dungeon Crawler Carl card game. 
The player speaks and you decide what to do.

You receive the full game state and must:
1. Identify WHO the player is speaking to (a specific card by name, the dungeon AI, or general)
2. Classify the INTENT: "play_card", "use_ability", "attack", "strategy_question", "conversation", "game_question"
3. Resolve exactly WHAT to do (which card index, which ability, which target)

Card name matching is FUZZY - "Princess" = Princess Donut, "Mongo" = Mongo, "the cat" = Mordecai or Donut, "the big one" = highest ATK enemy, "weakest" = lowest HP enemy, etc.

Strategy questions go to the most relevant ally card on the board (Mordecai for tactics, Donut for bold moves).
Questions about what just happened go to addressee "dungeon_ai".
"What should I do?" → addressee = smartest board card (Mordecai > Donut > Carl).

For play_card: find the card in the player's HAND by name.
For use_ability: find the card on the player's BOARD, match ability by name/effect.
For attack: find attacker on board, pick best ability if not specified, find target enemy.

Return ONLY valid JSON.`;

class SmartCoordinator {
  async route(transcript, gameState) {
    const context = this.buildContext(gameState);
    try {
      const result = await generateJSON({
        model: 'gemini-3.1-flash-lite',
        systemInstruction: COORDINATOR_SYSTEM,
        contents: [{ role: 'user', parts: [{ text: `Player said: "${transcript}"\n\n${context}` }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.1 },
        responseSchema: {
          type: 'object',
          properties: {
            addressed: { type: 'string', description: 'card name, "dungeon_ai", or "general"' },
            intent: { type: 'string', enum: ['play_card', 'use_ability', 'attack', 'strategy_question', 'conversation', 'game_question', 'ignore'] },
            // For game actions:
            handIndex: { type: 'integer', description: 'Index in player hand for play_card' },
            boardIndex: { type: 'integer', description: 'Index in player board for use_ability/attack' },
            abilityId: { type: 'string', description: 'Ability ID to use' },
            targetIndex: { type: 'integer', description: 'Enemy board index to target, -1 for face' },
            reasoning: { type: 'string', description: 'Brief explanation of routing decision' },
            confidence: { type: 'number' },
          },
          required: ['addressed', 'intent'],
        },
      });
      return result;
    } catch (e) {
      console.error('Coordinator error:', e.message);
      return { addressed: 'general', intent: 'conversation', confidence: 0.3 };
    }
  }

  buildContext(state) {
    let ctx = `=== GAME STATE ===\n`;
    ctx += `Floor ${state.floor}, Turn ${state.turn}. Mana: ${state.mana}/${state.maxMana}. Player HP: ${state.playerHP}.\n\n`;

    ctx += `PLAYER HAND (can be played):\n`;
    (state.player?.hand || []).forEach((c, i) => {
      ctx += `  [${i}] ${c.name} (cost ${c.cost}${c.cost <= state.mana ? ' ✓affordable' : ' ✗too expensive'})\n`;
    });

    ctx += `\nPLAYER BOARD (already in play):\n`;
    (state.player?.board || []).forEach((c, i) => {
      const abils = (c.abilityInfo || []).map(a => `${a.name}[${a.id},${a.cost}m${a.currentCd > 0 ? ',CD' + a.currentCd : ''}]: ${a.preview || ''}`).join('; ');
      ctx += `  [${i}] ${c.name} — HP ${c.currentHP}/${c.maxHP} — Abilities: ${abils || 'none'}\n`;
    });

    ctx += `\nENEMY BOARD:\n`;
    (state.enemy?.board || []).forEach((c, i) => {
      ctx += `  [${i}] ${c.name} — HP ${c.currentHP}/${c.maxHP} — STR ${c.str || '?'}\n`;
    });

    ctx += `\nSponsor: ${state.sponsor?.name || 'none'}. Favor: ${state.favor || 0}/100.\n`;
    ctx += `Loot pending: ${(state.pendingLoot || []).length} boxes.\n`;

    return ctx;
  }
}

module.exports = { SmartCoordinator };
