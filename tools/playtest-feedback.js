// Run playtest + get AI feedback on results
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { runPlaytest } = require('./playtest');

async function main() {
  const r = runPlaytest(30);
  const summary = `PLAYTEST RESULTS (30 battles):
Player wins: ${r.player} (${Math.round(r.player/30*100)}%)
Enemy wins: ${r.enemy} (${Math.round(r.enemy/30*100)}%)
Draws: ${r.draw}
Avg turns: ${r.avgTurns}
Avg total damage: ${r.avgDamage}

SAMPLE BATTLE LOG:
${r.logs[0]?.join('\n')}`;

  const prompt = `You are a game balance analyst. Review these playtest results from a DCC card battle game (v4 math: damage=base+STR/2, DR%=CON/6, HP=50+CON/2). Give: 1) Win rate assessment, 2) Battle length assessment, 3) Which card is too strong/weak, 4) Top 3 specific number tweaks. Be concise.\n\n${summary}`;

  // Claude
  const cRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 600, messages: [{role:'user', content: prompt}] })
  }).then(r => r.json());

  // Gemini
  const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{role:'user', parts:[{text: prompt}]}], generationConfig: { maxOutputTokens: 600 } })
  }).then(r => r.json());

  console.log('=== CLAUDE OPUS 4.8 ===');
  console.log(cRes.content?.[0]?.text || JSON.stringify(cRes).slice(0,300));
  console.log('\n=== GEMINI 3.1 ===');
  console.log(gRes.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(gRes).slice(0,300));
}

main();
