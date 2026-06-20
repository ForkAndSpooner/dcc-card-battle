// Iterative LLM usability testing loop
// Round N: test → collect issues → fix → re-test
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { BattleEngine } = require('../src/engine/battle');
const { setSeed } = require('../src/engine/rng');
const { getCard } = require('../src/cards/library');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'usability-results.md');

function buildScreen(turn) {
  setSeed(42 + turn);
  const deck = ['carl', 'donut', 'mongo', 'hekla', 'bautista', 'imani'].map(id => ({ ...getCard(id), level: 1, instanceId: id }));
  const b = new BattleEngine({ playerDeck: deck, floor: 1, sponsorId: 'borant' });
  b.startTurn();
  if (b.pendingDraw) b.chooseDraw('player');
  // Simulate to the requested turn
  for (let t = 1; t < turn; t++) {
    const st = b.getState();
    const idx = st.player.hand.findIndex(c => c.cost <= st.mana && !c.isLootCard && st.player.board.length < 5);
    if (idx >= 0) b.playCard(idx);
    if (!b.winner) b.endTurn();
    if (!b.winner) b.startTurn();
    if (b.pendingDraw) b.chooseDraw('player');
  }
  const s = b.getState();

  let screen = `GAME STATE — TURN ${s.turn}\n`;
  screen += `Top bar: Floor ${s.floor} | Turn ${s.turn} | ${s.mana} mana${s.mana > s.maxMana ? ' (+bonus)' : ''} | HP: ${s.playerHP}\n`;
  screen += `Objective: "Defeat all enemies to win"\n`;
  screen += `Hint shown: `;
  if (s.player.board.length === 0) screen += '"Drag a card from hand onto board. Blue=cost, Orange=attack, Green=health"\n';
  else screen += '"Click a board card to use abilities, or End Turn to auto-attack"\n';
  screen += `\nENEMY BOARD (${s.enemy.board.length} on field, ${s.enemy.deckSize} incoming):\n`;
  s.enemy.board.forEach((c, i) => { screen += `  [${i}] ${c.name} — ATK:${Math.floor(c.str/2)+3} HP:${c.currentHP}/${c.maxHP}\n`; });
  screen += `\nYOUR BOARD:\n`;
  s.player.board.forEach((c, i) => {
    const abils = (c.abilityInfo||[]).map(a=>`${a.name}(${a.cost}m): ${a.preview}`).join(', ');
    screen += `  [${i}] ${c.name} HP:${c.currentHP}/${c.maxHP} | Keywords: ${(c.keywords||[]).join(',')||'none'} | Abilities: ${abils||'none'}\n`;
  });
  screen += `\nYOUR HAND:\n`;
  s.player.hand.forEach((c, i) => {
    if (c.isLootCard) screen += `  [${i}] "${c.name}" (cost ${c.cost}) — loot box, play to open\n`;
    else screen += `  [${i}] "${c.name}" (cost ${c.cost}) ATK:${Math.floor((c.str||0)/2)+3} HP:${c.currentHP||'?'} | Hover shows abilities\n`;
  });
  screen += `\nLeft panel: Sponsor "Borant Corp" (+1 mana/turn), Active Effects (shows buffs), Chat input\n`;
  if (s.turn >= 3) screen += `Right panel: Galactic Feed (alien viewer comments), Live Feed (events)\n`;
  screen += `Instability: ${s.instability > 4 ? s.instability + ' (AI glitching)' : 'hidden until turn 5'}\n`;
  return screen;
}

async function askClaude(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 600, messages: [{ role: 'user', content: prompt }] })
  }).then(r => r.json());
  return r.content?.[0]?.text || '';
}

async function askGemini(prompt) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 600, temperature: 0.5 } })
  }).then(r => r.json());
  return r.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function runRound(round) {
  const screen1 = buildScreen(1);
  const screen3 = buildScreen(3);

  const basePrompt = `You are a casual gamer testing a new card battle game. You see this screen. In 3 bullet points max:
1. ONE thing that still confuses you most
2. ONE specific change that would help
3. Confusion rating 1-10 (1=clear, 10=lost)
Be brief and direct.\n\n`;

  console.log(`\n--- ROUND ${round} ---`);
  const c1 = await askClaude(basePrompt + 'TURN 1:\n' + screen1);
  const g1 = await askGemini(basePrompt + 'TURN 1:\n' + screen1);
  const c3 = await askClaude(basePrompt + 'TURN 3:\n' + screen3);
  const g3 = await askGemini(basePrompt + 'TURN 3:\n' + screen3);

  console.log('Claude T1:', c1.slice(0, 200));
  console.log('Gemini T1:', g1.slice(0, 200));
  console.log('Claude T3:', c3.slice(0, 200));
  console.log('Gemini T3:', g3.slice(0, 200));

  return { round, claude_t1: c1, gemini_t1: g1, claude_t3: c3, gemini_t3: g3 };
}

async function main() {
  const results = [];
  for (let round = 1; round <= 3; round++) {
    results.push(await runRound(round));
  }

  // Compile findings
  let md = `# Usability Test Results (${new Date().toISOString()})\n\n`;
  for (const r of results) {
    md += `## Round ${r.round}\n### Claude Turn 1\n${r.claude_t1}\n### Gemini Turn 1\n${r.gemini_t1}\n### Claude Turn 3\n${r.claude_t3}\n### Gemini Turn 3\n${r.gemini_t3}\n\n---\n\n`;
  }
  fs.writeFileSync(LOG_FILE, md);
  console.log(`\nResults saved: ${LOG_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
