// Simulation Harness - seeded games, invariant checks, balance + fuzz testing
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { BattleEngine } = require('../src/engine/battle');
const { setSeed } = require('../src/engine/rng');
const { checkInvariants } = require('../src/engine/invariants');
const { calcProgression } = require('../src/engine/progression');
const { getCard } = require('../src/cards/library');
const { listSponsors } = require('../src/engine/sponsors');

const SPONSORS = listSponsors().map(s => s.id);
const DECK = ['carl', 'donut', 'mongo', 'hekla', 'bautista'];

// Greedy bot that plays a full turn
function botTurn(b, violations, seed) {
  const assert = (label) => {
    const viol = checkInvariants(b);
    if (viol.length) violations.push({ seed, label, viol });
  };

  if (b.pendingDraw) b.chooseDraw(Math.random() < 0.25 ? 'loot' : 'player');
  assert('after draw');

  // Play affordable cards
  let guard = 0;
  while (guard++ < 12) {
    const st = b.getState();
    // Save at least 1 mana for abilities if we have board cards
    const saveMana = st.player.board.length > 0 ? 1 : 0;
    const idx = st.player.hand.findIndex(c => c.cost <= st.mana - saveMana && (c.isLootCard || st.player.board.length < 5));
    if (idx < 0) break;
    b.playCard(idx);
    assert('after playCard');
  }

  // Use best abilities
  guard = 0;
  while (guard++ < 20) {
    const st = b.getState();
    if (st.enemy.board.length === 0) break;
    let acted = false;
    for (let ci = 0; ci < st.player.board.length && !acted; ci++) {
      const card = st.player.board[ci];
      const opts = (card.abilityInfo || []).filter(a => a.damage && a.cost <= st.mana && a.currentCd === 0).sort((a, b2) => b2.damage - a.damage);
      if (opts.length) {
        let ti = 0, min = Infinity;
        st.enemy.board.forEach((e, ei) => { if (e.currentHP < min) { min = e.currentHP; ti = ei; } });
        if (b.useAbility(ci, opts[0].id, ti).ok) { acted = true; assert('after useAbility'); }
      }
    }
    if (!acted) break;
  }
}

function runSeededGame(seed, sponsorId, level, floor, violations) {
  setSeed(seed);
  const deck = DECK.map(id => ({ ...getCard(id), level, instanceId: id + '_' + seed }));
  const b = new BattleEngine({ playerDeck: deck, floor, sponsorId });
  b.startTurn();
  checkInvariants(b).forEach(x => violations.push({ seed, label: 'init', viol: [x] }));

  let rounds = 0;
  while (!b.winner && rounds < 40) {
    rounds++;
    botTurn(b, violations, seed);
    if (b.winner) break;
    b.endTurn();
    const viol = checkInvariants(b);
    if (viol.length) violations.push({ seed, label: `after enemy turn ${rounds}`, viol });
  }
  return { winner: b.winner || 'draw', rounds };
}

// Fuzz tester: send illegal actions, ensure engine doesn't crash or corrupt
function fuzzTest(n = 200) {
  console.log(`\n=== FUZZ TEST (${n} illegal actions) ===`);
  let crashes = 0, corruptions = 0;
  setSeed(12345);
  const deck = DECK.map(id => ({ ...getCard(id), level: 1, instanceId: id }));
  const b = new BattleEngine({ playerDeck: deck, floor: 3, sponsorId: 'borant' }); // Test floor 3
  b.startTurn();
  for (let i = 0; i < n; i++) {
    const action = Math.floor(Math.random() * 5);
    try {
      if (action === 0) b.playCard(Math.floor(Math.random() * 20) - 5); // bad index
      else if (action === 1) b.useAbility(Math.floor(Math.random() * 10) - 2, 'fake_ability', Math.floor(Math.random() * 10) - 2);
      else if (action === 2) b.chooseDraw(Math.random() < .5 ? 'loot' : 'player');
      else if (action === 3) b.useAbility(0, 'smash', 99);
      else b.useIntervention();
      const viol = checkInvariants(b);
      if (viol.length) { corruptions++; if (corruptions <= 3) console.log('  corruption:', viol[0]); }
    } catch (e) { crashes++; if (crashes <= 3) console.log('  CRASH:', e.message.slice(0, 80)); }
  }
  console.log(`Crashes: ${crashes}, Corruptions: ${corruptions}`);
  return { crashes, corruptions };
}

function main() {
  const violations = [];
  const N = 200;
  console.log(`=== BALANCE + INVARIANT SIM (${N} seeded games) ===`);

  const results = { player: 0, enemy: 0, draw: 0, totalRounds: 0 };
  const bySponsor = {};

  for (let i = 0; i < N; i++) {
    const seed = 1000 + i;
    const sponsor = SPONSORS[i % SPONSORS.length];
    const level = 1 + (i % 3);
    const r = runSeededGame(seed, sponsor, level, 1, violations);
    results[r.winner]++;
    results.totalRounds += r.rounds;
    bySponsor[sponsor] = bySponsor[sponsor] || { w: 0, t: 0 };
    if (r.winner === 'player') bySponsor[sponsor].w++;
    bySponsor[sponsor].t++;
  }

  console.log(`Player ${results.player} / Enemy ${results.enemy} / Draw ${results.draw} = ${Math.round(results.player/N*100)}% win`);
  console.log(`Avg rounds: ${(results.totalRounds/N).toFixed(1)}`);
  console.log('\nSponsor balance:');
  for (const [id, {w,t}] of Object.entries(bySponsor)) console.log(`  ${id.padEnd(11)}: ${Math.round(w/t*100)}%`);

  console.log(`\n=== INVARIANT VIOLATIONS: ${violations.length} ===`);
  if (violations.length) {
    // Group by violation type
    const byType = {};
    violations.forEach(v => v.viol.forEach(x => {
      const key = x.replace(/\d+/g, '#').replace(/[A-Z][a-z]+ /g, '');
      byType[key] = byType[key] || { count: 0, example: x, seed: v.seed, label: v.label };
      byType[key].count++;
    }));
    for (const [type, info] of Object.entries(byType)) {
      console.log(`  [${info.count}x] ${info.example} (seed ${info.seed}, ${info.label})`);
    }
  } else {
    console.log('  ✅ No invariant violations across all games!');
  }

  const fuzz = fuzzTest(300);
  console.log(`\n=== SUMMARY ===`);
  console.log(`Balance: ${Math.round(results.player/N*100)}% | Invariant violations: ${violations.length} | Fuzz crashes: ${fuzz.crashes} | Fuzz corruptions: ${fuzz.corruptions}`);
}

main();
