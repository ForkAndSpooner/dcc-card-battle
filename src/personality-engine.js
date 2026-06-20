// AI Personality Engine - Per-card Gemini Flash 2.5 agents
// Each card instance gets its own conversation history (agent memory)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

const TRIGGER_CONTEXT = {
  on_play: 'You just appeared in this dungeon room. Short punchy entrance line. 3-8 words MAX.',
  on_attack: 'You are striking an enemy. Short grunt or quip. 2-6 words MAX.',
  on_damage: 'You got hit. React with a grunt, yelp, or 1-4 words. Can just be "Ugh!" or "Ow!" Not every hit needs words.',
  on_death: 'You are dying. Brief final words. 3-8 words max.',
  player_chat: 'The crawler is speaking directly to you. Respond naturally in character. 1-2 sentences allowed here.'
};

// Battle narrative context builder - gives cards awareness of game events
function buildBattleNarrative(gameState) {
  let narrative = '';
  narrative += `You are in a dungeon room on floor ${gameState.turnNumber}. `;
  narrative += `Your side has ${gameState.player.health} HP remaining. The enemy has ${gameState.enemy.health} HP. `;

  if (gameState.player.board.length > 0) {
    narrative += `Fighting alongside you: ${gameState.player.board.map(c => c.name).join(', ')}. `;
  }
  if (gameState.enemy.board.length > 0) {
    narrative += `Enemies facing you: ${gameState.enemy.board.map(c => c.name).join(', ')}. `;
  }

  return narrative;
}

class PersonalityEngine {
  constructor() {
    // Per-card agent state: each card instance maintains its own conversation
    this.agents = new Map(); // instanceId -> { systemPrompt, history[] }
  }

  getOrCreateAgent(card) {
    if (!this.agents.has(card.instanceId)) {
      this.agents.set(card.instanceId, {
        systemPrompt: card.personality.systemPrompt,
        history: [] // Array of { role, parts } for Gemini multi-turn
      });
    }
    return this.agents.get(card.instanceId);
  }

  async generate(card, trigger, gameState, playerMessage = null) {
    if (!card.personality) return null;

    const agent = this.getOrCreateAgent(card);
    const userMessage = this.buildContext(card, trigger, gameState, playerMessage);

    // Add user turn to agent history
    agent.history.push({ role: 'user', parts: [{ text: userMessage }] });

    // Keep history manageable (last 10 exchanges)
    if (agent.history.length > 20) {
      agent.history = agent.history.slice(-20);
    }

    try {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: agent.history,
          systemInstruction: {
            parts: [{ text: agent.systemPrompt }]
          },
          generationConfig: {
            maxOutputTokens: 100,
            temperature: 1.0,
            topP: 0.95
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Gemini API error:', response.status, errText);
        agent.history.pop(); // Remove failed user turn
        return this.getFallbackLine(card, trigger);
      }

      const data = await response.json();
      const line = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        ?.replace(/^["']|["']$/g, '') // Strip wrapping quotes
        ?.replace(/^\*.*?\*\s*/, ''); // Strip *action* prefixes

      if (line) {
        // Add model response to agent history
        agent.history.push({ role: 'model', parts: [{ text: line }] });
        return line;
      }

      agent.history.pop();
      return this.getFallbackLine(card, trigger);
    } catch (err) {
      console.error('Personality generation error:', err.message);
      agent.history.pop();
      return this.getFallbackLine(card, trigger);
    }
  }

  buildContext(card, trigger, gameState, playerMessage = null) {
    let ctx = `[${trigger.toUpperCase()}] ${TRIGGER_CONTEXT[trigger]}\n`;

    if (playerMessage) {
      ctx += `The crawler says to you: "${playerMessage}"\n`;
    }

    ctx += buildBattleNarrative(gameState);
    ctx += `Your current state: ${card.attack} strength / ${card.health} vitality remaining. `;

    if (gameState.player.board.length > 0) {
      const allies = gameState.player.board.map(c => c.name).filter(n => n !== card.name);
      if (allies.length > 0) ctx += `Your allies present: ${allies.join(', ')}. `;
    }
    if (gameState.enemy.board.length > 0) {
      ctx += `Enemies present: ${gameState.enemy.board.map(c => c.name).join(', ')}. `;
    }

    ctx += '\nRespond with ONLY your spoken line. One or two sentences max. Stay in character.';
    return ctx;
  }

  getFallbackLine(card, trigger) {
    const fallbacks = {
      carl: {
        on_play: "Great. Another fight in my underwear.",
        on_attack: "Let's get this over with.",
        on_damage: "Son of a—that hurt.",
        on_death: "Tell Donut... she's still annoying.",
        idle: "I miss having pants."
      },
      donut: {
        on_play: "FINALLY. The star has arrived!",
        on_attack: "Witness my GLORY!",
        on_damage: "How DARE you touch royalty!",
        on_death: "This is... unacceptable...",
        idle: "Are you even paying attention to me?"
      },
      mongo: {
        on_play: "Mongo here! Mongo help!",
        on_attack: "MONGO SMASH!",
        on_damage: "Ow. That hurt Mongo.",
        on_death: "Mongo... sleepy...",
        idle: "Mongo like friends."
      },
      mordecai: {
        on_play: "Let me assess the situation.",
        on_attack: "Calculated strike.",
        on_damage: "A tactical setback, nothing more.",
        on_death: "The system... has flaws...",
        idle: "Consider your next move carefully."
      },
      odette: {
        on_play: "The dance begins anew.",
        on_attack: "Pirouette of pain.",
        on_damage: "Beautiful... the red...",
        on_death: "The final curtain... lovely.",
        idle: "Can you hear the music too?"
      }
    };

    const baseId = card.id.split('-')[0];
    return fallbacks[baseId]?.[trigger] || fallbacks[baseId]?.idle || "...";
  }

  // Clean up agent when card leaves play
  removeAgent(instanceId) {
    this.agents.delete(instanceId);
  }
}

module.exports = { PersonalityEngine };
