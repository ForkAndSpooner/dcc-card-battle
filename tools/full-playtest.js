// Full AI playtest using the real shipped engine with all systems active
// Tests: sponsors, instability, loot boxes, two-deck, leveling
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { BattleEngine, ABILITIES } = require('../src/engine/battle');
const { getCard } = require('../src/cards/library');
const { listSponsors } = require('../src/engine/sponsors');
const { calcProgression } = require('../src/engine/progression');

const SPONSOR_IDS = listSponsors().map(s => s.id);

// Smart greedy AI: picks best affordable damage ability
function aiTurn(b) {
  if (b.pendingDraw) b.chooseDraw(Math.random() < 0.25 ? 'loot' : 'player');
  let guard = 0;
  while (guard++ < 10) {
    const st = b.getState();
    // Play cheapest affordable card (or loot box if hand is otherwise full)
    const idx = st.player.hand.findIndex(c => c.cost <= st.mana && (c.isLootCard || st.player.board.length < 5));
    if (idx < 0) break;
    b.playCard(idx);
  }
  guard = 0;
  while (guard++ < 20) {
    const st = b.getState();
    if (st.enemy.board.length === 0) break;
    let acted = false;
    for (let ci = 0; ci < st.player.board.length && !acted; ci++) {
      const card = st.player.board[ci];
      const opts = (card.abilityInfo || [])
        .filter(a => a.damage && a.cost <= st.mana && a.currentCd === 0)
        .sort((a, b2) => b2.damage - a.damage);
      if (opts.length) {
        let ti = 0, minHP = Infinity;
        st.enemy.board.forEach((e, ei) => { if (e.currentHP < minHP) { minHP = e.currentHP; ti = ei; } });
        const r = b.useAbility(ci, opts[0].id, ti);
        if (r.ok) acted = true;
      }
    }
    if (!acted) break;
  }
}

function runGame(deck, sponsorId, floor) {
  const b = new BattleEngine({ playerDeck: deck, floor, sponsorId });
  b.startTurn();
  const log = [];
  let rounds = 0;
  while (!b.winner && rounds < 40) {
    rounds++;
    aiTurn(b);
    if (b.winner) break;
    const actions = b.endTurn();
    // Collect interesting events
    actions.forEach(a => {
      if (a.type === 'chaos') log.push(`T${rounds} CHAOS: ${a.text.slice(0, 60)}`);
      if (a.type === 'card_died') log.push(`T${rounds} DIED: ${a.card.name}`);
    });
  }
  const lootTotal = (b.pendingLoot || []).reduce((s, box) => s + (box.items?.length || 0), 0);
  return { winner: b.winner || 'draw', rounds, loot: lootTotal, favor: b.favor, instability: b.instability, chaos: log };
}

function main() {
  console.log('=== FULL SYSTEM PLAYTEST (100 battles) ===\n');
  const deckIds = ['carl', 'donut', 'mongo', 'hekla', 'bautista', 'imani', 'mordecai'];
  let wins = 0, losses = 0, totalRounds = 0, totalLoot = 0, chaosEvents = 0;
  const sponsorWins = {};
  const bugs = [];

  for (let i = 0; i < 100; i++) {
    const sponsorId = SPONSOR_IDS[i % SPONSOR_IDS.length];
    const deck = deckIds.slice(0, 5).map(id => {
      try { return { ...getCard(id), level: 1 + Math.floor(i / 20), instanceId: id + i }; }
      catch (e) { bugs.push('getCard ' + id + ': ' + e.message); return null; }
    }).filter(Boolean);

    let result;
    try { result = runGame(deck, sponsorId, 1); }
    catch (e) { bugs.push('game ' + i + ': ' + e.message); continue; }

    if (result.winner === 'player') wins++;
    else losses++;
    totalRounds += result.rounds;
    totalLoot += result.loot;
    chaosEvents += result.chaos.length;
    sponsorWins[sponsorId] = (sponsorWins[sponsorId] || [0, 0]);
    if (result.winner === 'player') sponsorWins[sponsorId][0]++;
    sponsorWins[sponsorId][1]++;
  }

  const n = wins + losses;
  console.log(`Results: ${wins} wins / ${losses} losses = ${Math.round(wins/n*100)}% win rate`);
  console.log(`Avg rounds: ${(totalRounds/n).toFixed(1)}`);
  console.log(`Avg loot items/battle: ${(totalLoot/n).toFixed(1)}`);
  console.log(`Chaos events total: ${chaosEvents}`);
  console.log('\nSponsor win rates:');
  for (const [id, [w, total]] of Object.entries(sponsorWins)) {
    console.log(`  ${id.padEnd(12)}: ${w}/${total} = ${Math.round(w/total*100)}%`);
  }
  if (bugs.length) console.log('\n⚠️  Bugs:', bugs.join(', '));
  else console.log('\n✅ No bugs detected');
  console.log('\n=== SAMPLE CHAOS EVENTS ===');
}

main();
