// Headless test using the REAL v4 engine - validates shipped code
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { BattleEngine, ABILITIES } = require('../src/engine/battle');
const { calcProgression } = require('../src/engine/progression');
const { getCard } = require('../src/cards/library');

function makeDeck(ids, levels = {}) {
  return ids.map(id => ({ ...getCard(id), level: levels[id] || 1, instanceId: 'i_' + id + Math.random() }));
}

// Simple greedy AI: play affordable cards, then use best damage ability on weakest enemy
function autoPlayerTurn(b) {
  // Handle pending draw - randomly pick deck (mostly character)
  if (b.pendingDraw) b.chooseDraw(Math.random() < 0.3 ? 'loot' : 'player');
  const s = b.getState();
  // Play affordable cards (including loot cards)
  let guard = 0;
  while (guard++ < 10) {
    const st = b.getState();
    const idx = st.player.hand.findIndex(c => c.cost <= st.mana && (c.isLootCard || st.player.board.length < 5));
    if (idx < 0) break;
    b.playCard(idx);
  }
  // Use abilities: each board card uses its best affordable damage ability
  guard = 0;
  while (guard++ < 20) {
    const st = b.getState();
    if (st.enemy.board.length === 0) break;
    let acted = false;
    for (let ci = 0; ci < st.player.board.length; ci++) {
      const card = st.player.board[ci];
      const info = (card.abilityInfo || []).filter(a => a.damage && a.cost <= st.mana && a.currentCd === 0);
      if (info.length === 0) continue;
      // Pick highest damage
      info.sort((a, b2) => (b2.damage || 0) - (a.damage || 0));
      const ability = info[0];
      // Target weakest enemy
      let weakest = 0, minHP = Infinity;
      st.enemy.board.forEach((e, ei) => { if (e.currentHP < minHP) { minHP = e.currentHP; weakest = ei; } });
      const r = b.useAbility(ci, ability.id, weakest);
      if (r.ok) { acted = true; break; }
    }
    if (!acted) break;
  }
}

function runBattle(deck, floor = 1, sponsorId = 'borant') {
  const b = new BattleEngine({ playerDeck: deck, floor, sponsorId });
  b.startTurn();
  let rounds = 0;
  while (!b.winner && rounds < 30) {
    rounds++;
    autoPlayerTurn(b);
    if (b.winner) break;
    b.endTurn(); // enemy turn; internally calls startTurn() for next player turn
  }
  return { winner: b.winner || 'draw', rounds, kills: b.board.player.reduce((s, c) => s + (c.killCount || 0), 0), loot: (b.pendingLoot || []).length, battle: b };
}

function main() {
  const baseDeck = ['carl', 'donut', 'mongo', 'hekla', 'bautista'];
  const N = 40;
  let pw = 0, ew = 0, dr = 0, totalRounds = 0, totalLoot = 0;

  console.log(`=== ${N} battles with REAL engine (Lv1 cards, Floor 1) ===`);
  for (let i = 0; i < N; i++) {
    const r = runBattle(makeDeck(baseDeck), 1);
    if (r.winner === 'player') pw++; else if (r.winner === 'enemy') ew++; else dr++;
    totalRounds += r.rounds;
    totalLoot += r.loot;
  }
  console.log(`Player: ${pw} (${Math.round(pw/N*100)}%) | Enemy: ${ew} | Draw: ${dr}`);
  console.log(`Avg rounds: ${(totalRounds/N).toFixed(1)} | Avg loot boxes/battle: ${(totalLoot/N).toFixed(1)}`);

  // Test with leveled cards (Lv4)
  console.log(`\n=== ${N} battles with Lv4 cards (Floor 1) ===`);
  pw = 0; ew = 0; dr = 0;
  const lvls = Object.fromEntries(baseDeck.map(id => [id, 4]));
  for (let i = 0; i < N; i++) {
    const r = runBattle(makeDeck(baseDeck, lvls), 1);
    if (r.winner === 'player') pw++; else if (r.winner === 'enemy') ew++; else dr++;
  }
  console.log(`Player: ${pw} (${Math.round(pw/N*100)}%) | Enemy: ${ew} | Draw: ${dr}`);

  // Test progression
  console.log(`\n=== Progression test ===`);
  const r = runBattle(makeDeck(baseDeck), 1);
  const save = { cardXP: {}, cardLevels: {}, stats: {} };
  const prog = calcProgression(r.battle, save);
  console.log('XP gains:', prog.xpGains.map(x => `${x.name}+${x.xp}`).join(', '));
  console.log('Loot collected:', r.loot, 'boxes');
}

main();

// Sponsor favor test
function testSponsor() {
  const { BattleEngine } = require('../src/engine/battle');
  const { getCard } = require('../src/cards/library');
  const deck = ['carl','donut','mongo','hekla','bautista'].map(id => ({ ...getCard(id), level:1, instanceId:'s'+id+Math.random() }));
  const b = new BattleEngine({ playerDeck: deck, floor: 1, sponsorId: 'borant' });
  b.startTurn();
  let rounds=0;
  while(!b.winner && rounds<30){ rounds++; if(b.pendingDraw)b.chooseDraw('player'); autoPlayerTurn(b); if(b.winner)break; b.endTurn(); }
  console.log('Final favor:', b.favor, '| instability:', b.instability, '| winner:', b.winner);
}
testSponsor();
