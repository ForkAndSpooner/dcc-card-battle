// Rapport Judge Agent - scores player speech for in-character-ness
const { generateJSON } = require('../api/gemini');

const JUDGE_SYSTEM = `You judge whether a player's speech to a character is "in-character" - meaning it matches how someone would naturally interact with that character given their personality. Score:
- rapportDelta: -10 to +10. Positive if speech shows understanding/respect for the character. Negative if rude, off-character, or generic.
- persuasionTier: 0 (fail), 1 (partial), 2 (success) - for ability activation attempts.
- reason: brief explanation.

Consider: Does the player use the character's name/title correctly? Do they acknowledge the character's personality? Is the request appropriate for this character's role?`;

class RapportJudge {
  async judge(playerMessage, card, context) {
    try {
      return await generateJSON({
        model: 'gemini-3.1-flash-lite',
        systemInstruction: JUDGE_SYSTEM,
        contents: [{
          role: 'user',
          parts: [{ text: `Character: ${card.name} (${card.title})\nPersonality: ${card.personality?.slice(0, 200)}\nPlayer said: "${playerMessage}"\nContext: ${context || 'general conversation'}` }]
        }],
        generationConfig: { maxOutputTokens: 100, temperature: 0.3 },
        responseSchema: {
          type: 'object',
          properties: {
            rapportDelta: { type: 'integer' },
            persuasionTier: { type: 'integer' },
            reason: { type: 'string' },
          },
          required: ['rapportDelta', 'persuasionTier', 'reason'],
        },
      });
    } catch (e) {
      console.error('Judge error:', e.message);
      return { rapportDelta: 0, persuasionTier: 1, reason: 'judge unavailable' };
    }
  }
}

module.exports = { RapportJudge };
