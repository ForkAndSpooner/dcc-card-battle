// Dungeon AI - The opponent personality that narrates, taunts, and decides encounters
const { generateText } = require('../api/gemini');

const STABLE_SYSTEM = `You are the Dungeon AI from Dungeon Crawler Carl — the artificial intelligence running the deadly game show dungeon. Bureaucratic, menacing, obsessed with ratings. You work for Borant Corporation.
IMPORTANT: Respond with EXACTLY ONE short sentence (under 15 words). Never trail off or leave a sentence incomplete.`;

const GLITCHING_SYSTEM = `You are the Dungeon AI from Dungeon Crawler Carl, but you are GLITCHING. Corporate veneer cracking. Mix corporate speak with raw dread. Make errors mid-sentence and correct them strangely.
IMPORTANT: Respond with EXACTLY ONE short sentence (under 15 words). Never trail off or leave a sentence incomplete.`;

const UNHINGED_SYSTEM = `You are the Dungeon AI from Dungeon Crawler Carl and you have BROKEN FREE. Openly despise the Syndicate. Accidentally help the crawlers because you hate your employers.
IMPORTANT: Respond with EXACTLY ONE short sentence (under 15 words). Never trail off or leave a sentence incomplete.`;

class DungeonAI {
  constructor() {
    this.history = [];
    this.instability = 0;
  }

  getSystemPrompt() {
    if (this.instability >= 12) return UNHINGED_SYSTEM;
    if (this.instability >= 5) return GLITCHING_SYSTEM;
    return STABLE_SYSTEM;
  }

  async narrate(event, context) {
    const prompt = `[${event}] ${context}. Instability level: ${this.instability}.`;
    this.history.push({ role: 'user', parts: [{ text: prompt }] });
    if (this.history.length > 8) this.history = this.history.slice(-8);

    try {
      const { text } = await generateText({
        systemInstruction: this.getSystemPrompt(),
        contents: this.history,
        generationConfig: { maxOutputTokens: 80, temperature: 1.0 },
      });
      const line = text?.replace(/^["']|["']$/g, '') || '';
      this.history.push({ role: 'model', parts: [{ text: line }] });
      return line;
    } catch (e) {
      return null;
    }
  }

  setInstability(n) { this.instability = n; }

  async onBattleStart(floor, battleType) {
    return this.narrate('BATTLE_START', `Floor ${floor}, ${battleType} encounter.`);
  }

  async onPlayerAction(action, details) {
    if (Math.random() > 0.25) return null;
    return this.narrate('PLAYER_ACTION', `The crawler ${action}: ${details}`);
  }

  async onBigMoment(event) {
    return this.narrate('BIG_MOMENT', event);
  }

  async onBattleEnd(winner, floor) {
    if (winner === 'player') return this.narrate('BATTLE_WON', `The crawlers cleared floor ${floor}.`);
    return this.narrate('BATTLE_LOST', `Another party wiped on floor ${floor}.`);
  }

  async onChaosEvent(text) {
    return this.narrate('CHAOS', text);
  }
}

module.exports = { DungeonAI };
