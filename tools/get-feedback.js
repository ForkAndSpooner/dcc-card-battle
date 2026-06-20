// Get game design feedback from Claude (Bedrock) and Gemini in parallel
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');

const RULES_FILE = path.join(__dirname, '../data/RULES.md');
const FEEDBACK_FILE = path.join(__dirname, '../data/FEEDBACK.md');

const FEEDBACK_PROMPT = `You are reviewing a tabletop card game design. The game is based on "Dungeon Crawler Carl" book series by Matt Dinniman. The game is meant to be a hybrid card game / tabletop RPG that takes many rounds (longer play sessions, not quick). Stats use a 1-300 scale per the books.

Below is the complete rules document. Please provide:

1. **Adherence to the books**: Does this capture the feel of DCC? What's missing or wrong?
2. **Gameplay fun**: Will this be fun to play? What's brilliant, what's tedious?
3. **Mechanical concerns**: Any rules that won't work, are too complex, or have edge cases?
4. **Missing mechanics**: What from the books should be in this game that isn't?
5. **Balance concerns**: Anything obviously broken (overpowered/underpowered)?
6. **Top 5 specific suggestions** for improvement

Be candid. Be specific. Don't be diplomatic - I want real critique. The designer wants this to be a real game, not a toy.

---

RULES DOCUMENT:

`;

async function getClaudeFeedback(rulesText) {
  const key = process.env.CLAUDE_API_KEY;
  if (!key) throw new Error('No CLAUDE_API_KEY');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 4000, messages: [{ role: 'user', content: FEEDBACK_PROMPT + rulesText }] })
  });
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  return data.content?.[0]?.text || JSON.stringify(data);
}

async function getGeminiFeedback(rulesText) {
  const key = process.env.GEMINI_API_KEY;
  // Try Gemini 3 Pro first; fall back to Flash if not available
  const models = ['gemini-3.1-pro-preview', 'gemini-2.5-pro', 'gemini-3.1-flash-lite'];
  let lastErr;
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const body = {
        contents: [{ role: 'user', parts: [{ text: FEEDBACK_PROMPT + rulesText }] }],
        generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { lastErr = `${model}: ${res.status} ${(await res.text()).slice(0, 100)}`; continue; }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('');
      if (text) return `[${model}]\n\n${text}`;
      lastErr = `${model}: no text in response`;
    } catch (e) {
      lastErr = `${model}: ${e.message}`;
    }
  }
  throw new Error(lastErr);
}

async function main() {
  const rules = fs.readFileSync(RULES_FILE, 'utf-8');
  console.log(`Rules: ${rules.length} chars`);
  console.log('Querying both AIs in parallel...');

  const [claudeRes, geminiRes] = await Promise.allSettled([
    getClaudeFeedback(rules),
    getGeminiFeedback(rules),
  ]);

  const claudeOut = claudeRes.status === 'fulfilled' ? claudeRes.value : `ERROR: ${claudeRes.reason.message}`;
  const geminiOut = geminiRes.status === 'fulfilled' ? geminiRes.value : `ERROR: ${geminiRes.reason.message}`;

  const out = `# Game Design Feedback\n\nGenerated: ${new Date().toISOString()}\n\n## Claude Sonnet 4 (via Bedrock)\n\n${claudeOut}\n\n---\n\n## Gemini 3 Pro\n\n${geminiOut}\n`;
  fs.writeFileSync(FEEDBACK_FILE, out);
  console.log(`Saved: ${FEEDBACK_FILE}`);
  console.log('\n=== CLAUDE ===\n');
  console.log(claudeOut.slice(0, 3000));
  console.log('\n=== GEMINI ===\n');
  console.log(geminiOut.slice(0, 3000));
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
