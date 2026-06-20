// Personality Agent - per-card AI with memory + rapport awareness
const { generateText } = require('../api/gemini');

const TRIGGERS = {
  on_play: 'You just appeared. Short punchy entrance. 3-8 words MAX.',
  on_attack: 'Striking an enemy. Grunt or quip. 2-6 words MAX.',
  on_damage: 'You got hit. Grunt/yelp. 1-4 words. Can be just "Ugh!" or "Argh!"',
  on_death: 'You are dying. Brief final words. 3-8 words.',
  player_chat: 'The crawler speaks to you. Respond naturally. 1-2 sentences.',
  rapport_up: 'The crawler said something that really connects with you. React warmly. 1 sentence.',
  rapport_down: 'The crawler said something that offends/disappoints you. React coolly. 1 sentence.',
};

class PersonalityAgent {
  constructor() {
    this.agents = new Map(); // instanceId -> {history, rapport}
  }

  getAgent(card) {
    if (!this.agents.has(card.instanceId)) {
      this.agents.set(card.instanceId, { history: [], rapport: 50 });
    }
    return this.agents.get(card.instanceId);
  }

  async generate(card, trigger, gameState, playerMessage = null, opts = {}) {
    if (!card.personality) return null;
    if (card.growlOnly && trigger !== 'player_chat') return this.getEmotionTag(card, trigger);

    const agent = this.getAgent(card);
    const ctx = this.buildContext(card, trigger, gameState, playerMessage, agent.rapport);
    agent.history.push({ role: 'user', parts: [{ text: ctx }] });
    if (agent.history.length > 16) agent.history = agent.history.slice(-16);

    const sysPrompt = opts.familyMode
      ? card.personality + '\n\nIMPORTANT: You are in FAMILY FRIENDLY mode. Do NOT use any profanity, swear words, curse words, vulgar language, sexual references, or adult humor. Keep all responses clean and appropriate for all ages. Replace any urge to curse with creative dungeon-themed insults (e.g. "floor-turd", "sewer-brain", "dungeon-breath").'
      : card.personality;

    try {
      const { text } = await generateText({
        systemInstruction: sysPrompt,
        contents: agent.history,
        generationConfig: { maxOutputTokens: 80, temperature: 1.0 },
      });
      const line = text?.replace(/^["']|["']$/g, '').replace(/^\*.*?\*\s*/, '') || '...';
      agent.history.push({ role: 'model', parts: [{ text: line }] });
      return line;
    } catch (e) {
      console.error('Personality error:', e.message);
      agent.history.pop();
      return '...';
    }
  }

  async getEmotionTag(card, trigger) {
    // For creatures: map trigger to emotion
    const map = { on_play: 'happy', on_attack: 'aggressive', on_damage: 'hurt', on_death: 'hurt' };
    return map[trigger] || 'aggressive';
  }

  buildContext(card, trigger, state, playerMessage, rapport) {
    let ctx = `[${trigger.toUpperCase()}] ${TRIGGERS[trigger] || 'React.'}\n`;
    if (playerMessage) ctx += `The crawler says: "${playerMessage}"\n`;
    ctx += `Floor ${state.floor}. Your side: ${state.player.health} HP. Enemy: ${state.enemy.health} HP. `;
    ctx += `Your rapport with the crawler: ${rapport}/100. `;
    const allies = state.player.board.map(c => c.name).filter(n => n !== card.name);
    if (allies.length) ctx += `Allies: ${allies.join(', ')}. `;
    const enemies = state.enemy.board.map(c => c.name);
    if (enemies.length) ctx += `Enemies: ${enemies.join(', ')}. `;
    ctx += '\nSpoken line ONLY. No quotes, actions, or stage directions.';
    return ctx;
  }

  adjustRapport(card, delta) {
    const agent = this.getAgent(card);
    agent.rapport = Math.max(0, Math.min(100, agent.rapport + delta));
    return agent.rapport;
  }

  getRapport(card) {
    return this.getAgent(card).rapport;
  }
}

module.exports = { PersonalityAgent };
