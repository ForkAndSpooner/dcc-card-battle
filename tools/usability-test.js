// LLM Usability Test — play the game with minimal instructions
// See where they get confused, what's unclear, what they don't understand
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { BattleEngine, ABILITIES } = require('../src/engine/battle');
const { setSeed } = require('../src/engine/rng');
const { getCard } = require('../src/cards/library');

const MINIMAL_BRIEFING = `You are playtesting a card battle game based on "Dungeon Crawler Carl". You know basic card game conventions (mana, playing cards, attacking). Here's what you know:
- It's your turn. You have mana to spend on playing cards from hand or using abilities.
- Cards on the board can use abilities that cost mana.
- You're trying to defeat all enemy cards.
- End your turn when done.

You will receive the game state as text. Respond with:
1. What you UNDERSTAND about the current state
2. What CONFUSES you or is UNCLEAR
3. Your chosen ACTION as JSON: {"type":"play","index":0} or {"type":"ability","cardIndex":0,"abilityId":"smash","targetIndex":0} or {"type":"end_turn"}
4. Any questions you'd ask if you could

Be honest about confusion. Don't pretend you understand something that isn't clear.`;

async function askLLM(model, stateText, turn) {
  const prompt = `${turn === 1 ? MINIMAL_BRIEFING + '\n\n' : ''}GAME STATE (Turn ${turn}):\n${stateText}\n\nRespond with your analysis and action.`;

  if (model === 'claude') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 800, messages: [{ role: 'user', content: prompt }] })
    }).then(r => r.json());
    return r.content?.[0]?.text || '';
  } else {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 800, temperature: 0.3 } })
    }).then(r => r.json());
    return r.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
}

function stateToText(b) {
  const s = b.getState();
  let t = `Turn ${s.turn}. Your mana: ${s.mana}/${s.maxMana}. Your HP: ${s.playerHP}.\n`;
  t += `Instability: ${s.instability}. Favor: ${s.favor}.\n`;
  if (s.sponsor) t += `Sponsor: ${s.sponsor.name} (${s.sponsor.passive})\n`;
  t += s.pendingDraw ? `⚠️ You must choose a deck to draw from: "player" (characters) or "loot" (random items)\n` : '';
  t += `\nYOUR HAND:\n`;
  (s.player.hand || []).forEach((c, i) => {
    if (c.isLootCard) t += `  [${i}] ${c.name} (cost ${c.cost}) — a loot box card\n`;
    else t += `  [${i}] ${c.name} (cost ${c.cost}) — STR:${c.str||'?'} INT:${c.int||'?'} CON:${c.con||'?'}\n`;
  });
  t += `\nYOUR BOARD:\n`;
  (s.player.board || []).forEach((c, i) => {
    const abils = (c.abilityInfo || []).map(a => `${a.name}[id:${a.id}, cost:${a.cost}m${a.currentCd > 0 ? ', COOLDOWN:' + a.currentCd : ''}]: ${a.preview}`).join('; ');
    t += `  [${i}] ${c.name} — HP:${c.currentHP}/${c.maxHP}, Keywords:${(c.keywords||[]).join(',')||'none'}\n      Abilities: ${abils || 'none available'}\n`;
  });
  t += `\nENEMY BOARD:\n`;
  (s.enemy.board || []).forEach((c, i) => {
    t += `  [${i}] ${c.name} — HP:${c.currentHP}/${c.maxHP}, STR:${c.str||'?'}\n`;
  });
  t += `\nPending loot boxes: ${(s.pendingLoot || []).length}\n`;
  t += `Enemy cards remaining (deck+board): ${(s.enemy.deckSize || 0) + (s.enemy.board || []).length}\n`;
  return t;
}

async function playTestGame(model) {
  setSeed(42);
  const deck = ['carl', 'donut', 'mongo', 'hekla', 'bautista', 'imani'].map(id => ({ ...getCard(id), level: 1, instanceId: id }));
  const b = new BattleEngine({ playerDeck: deck, floor: 1, sponsorId: 'borant' });
  b.startTurn();

  const log = [];
  console.log(`\n${'='.repeat(60)}\n${model.toUpperCase()} USABILITY TEST\n${'='.repeat(60)}`);

  for (let turn = 1; turn <= 5 && !b.winner; turn++) {
    if (b.pendingDraw) b.chooseDraw('player'); // auto-draw for now

    const stateText = stateToText(b);
    console.log(`\n--- Turn ${turn} State Sent ---`);
    console.log(stateText.slice(0, 400));

    const response = await askLLM(model, stateText, turn);
    console.log(`\n--- ${model} Response ---`);
    console.log(response.slice(0, 600));

    // Parse their action
    const actionMatch = response.match(/\{[^}]+\}/);
    let action = null;
    try { action = JSON.parse(actionMatch?.[0] || '{}'); } catch {}

    if (action?.type === 'play' && action.index >= 0) {
      const r = b.playCard(action.index);
      console.log(`  → Played: ${r.ok ? r.card?.name : 'FAILED: ' + r.err}`);
    } else if (action?.type === 'ability') {
      const r = b.useAbility(action.cardIndex, action.abilityId, action.targetIndex ?? 0);
      console.log(`  → Ability: ${r.ok ? r.ability + ' → ' + (r.effects?.[0]?.target || 'team') : 'FAILED: ' + r.err}`);
    } else {
      console.log(`  → End turn (or couldn't parse action)`);
    }

    // End turn
    if (!b.winner) b.endTurn();

    // Collect confusion points
    const confusionMatch = response.match(/CONFUS[^]*?(?=\n\n|\n3\.|\nACTION)/i);
    if (confusionMatch) log.push({ turn, model, confusion: confusionMatch[0].slice(0, 300) });
  }

  return log;
}

async function main() {
  const allConfusion = [];

  const claudeLog = await playTestGame('claude');
  allConfusion.push(...claudeLog);

  const geminiLog = await playTestGame('gemini');
  allConfusion.push(...geminiLog);

  console.log(`\n\n${'='.repeat(60)}\nUSABILITY FINDINGS SUMMARY\n${'='.repeat(60)}`);
  console.log(`\nTotal confusion points: ${allConfusion.length}\n`);
  allConfusion.forEach((c, i) => {
    console.log(`${i + 1}. [${c.model} T${c.turn}]: ${c.confusion.slice(0, 200)}`);
    console.log('');
  });
}

main().catch(e => { console.error(e); process.exit(1); });
