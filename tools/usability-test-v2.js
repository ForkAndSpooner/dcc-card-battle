// LLM Usability Test v2 — "You are a confused human" framing
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { BattleEngine } = require('../src/engine/battle');
const { setSeed } = require('../src/engine/rng');
const { getCard } = require('../src/cards/library');

const HUMAN_FRAMING = `You are a real human who just opened a card game on your computer for the first time. You've played some mobile games but never Hearthstone or Magic. You know nothing about "Dungeon Crawler Carl."

You see a game screen. Below is EXACTLY what you see (described as text). React naturally as a confused first-time player:
- What do you THINK you're supposed to do first?
- What would you click?
- What makes NO SENSE to you?
- What would make you close the app in frustration?
- Rate your confusion 1-10 (10 = totally lost, might quit)

Be BLUNT and HONEST. Don't be nice. Don't analyze like a designer — react like a person.`;

async function run() {
  setSeed(42);
  const deck = ['carl', 'donut', 'mongo', 'hekla', 'bautista', 'imani'].map(id => ({ ...getCard(id), level: 1, instanceId: id }));
  const b = new BattleEngine({ playerDeck: deck, floor: 1, sponsorId: 'borant' });
  b.startTurn();
  if (b.pendingDraw) b.chooseDraw('player');
  const s = b.getState();

  let screen = '=== WHAT YOU SEE ON SCREEN ===\n\n';
  screen += 'TOP BAR: Floor 1 | Turn 1 | 0 gold | 500 watching | Heart icon 35 | Blue gem 4/3\n\n';
  screen += 'LEFT SIDE:\n  Purple panel "Borant Corporation (+1 mana each turn)"\n  "Active Effects" panel (empty)\n  Text box "Talk to your cards (or hold SPACE)"\n\n';
  screen += 'CENTER TOP: "Defeat all enemies to win" + "3 enemy cards remaining"\n\n';
  screen += 'ENEMY AREA (top of center):\n';
  (s.enemy.board || []).forEach((c, i) => {
    screen += `  A dark card with art: "${c.name}" — orange circle: ${Math.floor(c.str/2)+3} | green circle: ${c.currentHP}\n`;
  });
  screen += '\n  [Big gold button: "END TURN"]\n\n';
  screen += 'YOUR AREA: 5 dashed outlines (empty slots)\n\n';
  screen += 'YOUR HAND (bottom, cards fanned in an arc):\n';
  (s.player.hand || []).forEach((c, i) => {
    const atk = Math.floor((c.str || 0) / 2) + 3;
    screen += `  Card: "${c.name}" — small blue circle: ${c.cost} (top left) | orange circle: ${atk} | green circle: ${c.currentHP}\n`;
    screen += `    When you hover: tooltip shows ability names + damage numbers\n`;
  });
  screen += '\nRIGHT SIDE:\n  "Galactic Feed" — weird alien comments scrolling by\n  "Live Feed" — game events\n\n';
  screen += 'ALSO: there is a red pulsing microphone icon if you hold spacebar\n';

  const prompt = HUMAN_FRAMING + '\n\n' + screen;

  // Claude
  console.log('=== CLAUDE (as confused human player) ===\n');
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 800, messages: [{ role: 'user', content: prompt }] })
    }).then(r => r.json());
    console.log(r.content?.[0]?.text || 'no response');
  } catch (e) { console.log('Error:', e.message); }

  // Gemini
  console.log('\n\n=== GEMINI (as confused human player) ===\n');
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 800, temperature: 0.6 } })
    }).then(r => r.json());
    console.log(r.candidates?.[0]?.content?.parts?.[0]?.text || 'no response');
  } catch (e) { console.log('Error:', e.message); }
}

run();
