// ============================================================================
// BALANCE TESTER — an AI "game tester" that plays the game many ways and
// produces actionable balance suggestions.
//
// It role-plays a critical playtester. It simulates games across floors,
// sponsors, and deck archetypes, gathers metrics, then applies established
// card-game balance heuristics to flag problems and recommend fixes.
//
// Heuristics drawn from card-game balancing best practices:
//  - Target win rate band: a fair PvE fight sits ~55-75% for the player.
//    100% = trivial (boring), <40% = punishing.  (tabletop-creator, ludocards)
//  - No dominant option: no single ability should account for an outsized
//    share of damage/usage — "auto-include" cards flatten decisions.
//    (boardgames.stackexchange — avoid auto-include / strictly-better cards)
//  - Cost/power curve: an ability's impact should scale with its mana cost.
//    Outliers above the curve are under-costed; below are dead cards.
//  - Game length: very short games (<4 rounds) = swingy/snowbally;
//    very long (>15) = grindy. Aim ~5-10 rounds.
//  - Sponsor parity: sponsors should land within a ~20-point win-rate spread.
//
// Run:  node tools/balance-tester.js [gamesPerCell]
// Writes: BALANCE_REPORT.md
// ============================================================================
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const { BattleEngine, ABILITIES } = require('../src/engine/battle');
const { setSeed } = require('../src/engine/rng');
const { getCard, CHARS } = require('../src/cards/library');
const { listSponsors } = require('../src/engine/sponsors');
const { FLOORS, BATTLES_PER_FLOOR } = require('../src/engine/floors');

const SPONSORS = listSponsors().map(s => s.id);
const FLOORS_TO_TEST = [1, 2, 3, 4, 5, 6, 9, 12];

// A few deck archetypes so we don't over-fit to one lineup
const ARCHETYPES = {
  balanced: ['carl', 'donut', 'mongo', 'hekla', 'bautista'],
  casters:  ['donut', 'signet', 'elle', 'ferdinand', 'prepotente'],
  martial:  ['carl', 'hekla', 'katia', 'li_jun', 'brutus'],
  mixed:    ['mongo', 'imani', 'britney', 'samantha', 'miriam_dom'],
};

// ---- metrics accumulators ----
const abilityStats = {};   // id -> { uses, damage, kills }
function track(id, dmg, kill) {
  const a = abilityStats[id] || (abilityStats[id] = { uses: 0, damage: 0, kills: 0 });
  a.uses++; a.damage += dmg || 0; if (kill) a.kills++;
}

// Smart-ish bot: plays cards, then casts the highest-value affordable ability,
// targeting the lowest-HP enemy (to maximize kills). Tracks ability output.
function botTurn(b) {
  if (b.pendingDraw) b.chooseDraw(Math.random() < 0.25 ? 'loot' : 'player');
  let guard = 0;
  while (guard++ < 12) {
    const st = b.getState();
    const saveMana = st.player.board.length > 0 ? 1 : 0;
    const idx = st.player.hand.findIndex(c => c.cost <= st.mana - saveMana && (c.isLootCard || st.player.board.length < 5));
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
        .filter(a => (a.kind === 'skill' || a.cost <= st.mana) && a.currentCd === 0 && !card.usedAction)
        .sort((a, b2) => (b2.damage || 0) - (a.damage || 0));
      if (opts.length) {
        let ti = 0, min = Infinity;
        st.enemy.board.forEach((e, ei) => { if (e.currentHP < min) { min = e.currentHP; ti = ei; } });
        const before = b.board.enemy.length;
        const enemyHpBefore = b.board.enemy.reduce((s, e) => s + e.currentHP, 0);
        const r = b.useAbility(ci, opts[0].id, ti);
        if (r && r.ok) {
          acted = true;
          const enemyHpAfter = b.board.enemy.reduce((s, e) => s + e.currentHP, 0);
          const killed = before - b.board.enemy.length;
          track(opts[0].id, Math.max(0, enemyHpBefore - enemyHpAfter), killed > 0);
        }
      }
    }
    if (!acted) break;
  }
}

function runGame(seed, sponsorId, floor, deckIds, isBoss) {
  setSeed(seed);
  const deck = deckIds.map(id => ({ ...getCard(id), level: 1 + Math.floor(floor / 3), instanceId: id + '_' + seed }))
    .filter(c => c && c.id);
  const b = new BattleEngine({ playerDeck: deck, floor, sponsorId, battleType: isBoss ? 'boss' : 'normal' });
  b.startTurn();
  let rounds = 0;
  while (!b.winner && rounds < 40) {
    rounds++;
    botTurn(b);
    if (b.winner) break;
    b.endTurn();
  }
  const playerHpLeft = b.board.player.reduce((s, c) => s + Math.max(0, c.currentHP), 0);
  const playerHpMax = b.board.player.reduce((s, c) => s + (c.maxHP || 0), 0);
  return { winner: b.winner || 'draw', rounds, hpFrac: playerHpMax ? playerHpLeft / playerHpMax : 0 };
}

function pct(n) { return Math.round(n * 100); }

function main() {
  const GAMES = parseInt(process.argv[2], 10) || 20; // games per (floor x archetype) cell
  console.log(`Balance Tester — ${GAMES} games per floor/archetype cell across ${FLOORS_TO_TEST.length} floors...`);

  const byFloor = {};   // floor -> { normal:{w,t,rounds,hp}, boss:{w,t,rounds,hp} }
  const bySponsor = {}; // id -> {w,t}
  let seed = 7000;

  for (const floor of FLOORS_TO_TEST) {
    byFloor[floor] = { normal: { w: 0, t: 0, rounds: 0, hp: 0 }, boss: { w: 0, t: 0, rounds: 0, hp: 0 } };
    for (const [arch, ids] of Object.entries(ARCHETYPES)) {
      for (let g = 0; g < GAMES; g++) {
        const sponsor = SPONSORS[seed % SPONSORS.length];
        const isBoss = g % BATTLES_PER_FLOOR === (BATTLES_PER_FLOOR - 1); // mirror real cadence
        const cell = isBoss ? byFloor[floor].boss : byFloor[floor].normal;
        const r = runGame(seed++, sponsor, floor, ids, isBoss);
        cell.t++; cell.rounds += r.rounds; cell.hp += r.hpFrac;
        if (r.winner === 'player') cell.w++;
        bySponsor[sponsor] = bySponsor[sponsor] || { w: 0, t: 0 };
        bySponsor[sponsor].t++; if (r.winner === 'player') bySponsor[sponsor].w++;
      }
    }
  }

  // ---- analyze + build suggestions ----
  const suggestions = [];
  const lines = [];
  lines.push('# ⚖️ Balance Test Report');
  lines.push(`_Generated ${new Date().toISOString()} by the AI game-tester (${GAMES} games/cell)._\n`);

  // Win rate per floor
  lines.push('## Win rate by floor\n');
  lines.push('| Floor | Name | Normal win% | Normal rounds | Normal HP left | Boss win% | Boss rounds | Boss HP left |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const floor of FLOORS_TO_TEST) {
    const n = byFloor[floor].normal, bo = byFloor[floor].boss;
    const nw = n.t ? pct(n.w / n.t) : '-', bw = bo.t ? pct(bo.w / bo.t) : '-';
    lines.push(`| ${floor} | ${FLOORS[floor]?.name || ''} | ${nw}% | ${n.t ? (n.rounds / n.t).toFixed(1) : '-'} | ${n.t ? pct(n.hp / n.t) : '-'}% | ${bw}% | ${bo.t ? (bo.rounds / bo.t).toFixed(1) : '-'} | ${bo.t ? pct(bo.hp / bo.t) : '-'}% |`);
    // Heuristic flags
    if (n.t) {
      const w = n.w / n.t, rounds = n.rounds / n.t, hp = n.hp / n.t;
      if (w >= 0.95 && hp > 0.7) suggestions.push(`**Floor ${floor} (normal) is too easy** — ${pct(w)}% win, ${pct(hp)}% HP remaining. Add more/stronger mobs, raise opening wave, or increase enemy deploy cap.`);
      if (w <= 0.4) suggestions.push(`**Floor ${floor} (normal) is too punishing** — only ${pct(w)}% win. Reduce enemy count/stats or ease the curve.`);
      if (rounds < 4) suggestions.push(`**Floor ${floor} (normal) ends too fast** (${rounds.toFixed(1)} rounds) — snowbally. Increase enemy HP or reduce burst.`);
      if (rounds > 15) suggestions.push(`**Floor ${floor} (normal) drags** (${rounds.toFixed(1)} rounds) — grindy. Trim enemy HP or board size.`);
    }
    if (bo.t) {
      const w = bo.w / bo.t;
      if (w >= 0.9) suggestions.push(`**Floor ${floor} BOSS is too easy** — ${pct(w)}% win. Buff boss HP/mechanic or minions.`);
      if (w <= 0.3) suggestions.push(`**Floor ${floor} BOSS is too hard** — ${pct(w)}% win. Soften boss stats or give the player more prep.`);
    }
  }
  lines.push('');

  // Sponsor parity
  lines.push('## Sponsor parity (win%)\n');
  lines.push('| Sponsor | win% | games |');
  lines.push('|---|---|---|');
  const spVals = [];
  for (const [id, { w, t }] of Object.entries(bySponsor).sort((a, b) => b[1].w / b[1].t - a[1].w / a[1].t)) {
    const v = t ? w / t : 0; spVals.push(v);
    lines.push(`| ${id} | ${pct(v)}% | ${t} |`);
  }
  if (spVals.length) {
    const spread = pct(Math.max(...spVals) - Math.min(...spVals));
    lines.push(`\n_Win-rate spread across sponsors: **${spread} points**._`);
    if (spread > 20) suggestions.push(`**Sponsor imbalance** — ${spread}-point win-rate spread. Tune the strongest/weakest sponsor passives toward the middle.`);
  }
  lines.push('');

  // Ability dominance + cost/power curve
  lines.push('## Ability usage & efficiency\n');
  const used = Object.entries(abilityStats).filter(([, s]) => s.uses > 0);
  const totalUses = used.reduce((s, [, a]) => s + a.uses, 0) || 1;
  const totalDmg = used.reduce((s, [, a]) => s + a.damage, 0) || 1;
  // efficiency = damage per use, normalized by (cost+1) so free skills aren't auto-flagged
  const rows = used.map(([id, s]) => {
    const ab = ABILITIES[id] || {};
    const cost = ab.kind === 'spell' ? (ab.cost || 1) : 0;
    const dmgPerUse = s.damage / s.uses;
    const eff = dmgPerUse / (cost + 1); // value-per-mana proxy
    return { id, name: ab.name || id, kind: ab.kind, cost, uses: s.uses, usePct: s.uses / totalUses, dmgShare: s.damage / totalDmg, dmgPerUse, eff };
  }).sort((a, b) => b.eff - a.eff);
  const avgEff = rows.reduce((s, r) => s + r.eff, 0) / (rows.length || 1);
  lines.push('| Ability | Kind | Cost | Uses | Use% | Dmg share | Dmg/use | Efficiency (vs avg) |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const r of rows.slice(0, 25)) {
    const ratio = avgEff ? (r.eff / avgEff) : 1;
    lines.push(`| ${r.name} | ${r.kind || '?'} | ${r.cost} | ${r.uses} | ${pct(r.usePct)}% | ${pct(r.dmgShare)}% | ${r.dmgPerUse.toFixed(1)} | ${ratio.toFixed(2)}x |`);
  }
  // Dominant ability flags
  const UTILITY = new Set(['heal', 'buff', 'shield', 'taunt', 'debuff', 'self_buff']); // value not measured by damage
  for (const r of rows) {
    const ab = ABILITIES[r.id] || {};
    const isDamage = !!ab.calc && !UTILITY.has(ab.type);
    if (r.usePct > 0.18) suggestions.push(`**"${r.name}" is over-used** (${pct(r.usePct)}% of all ability casts) — likely an auto-include. Consider a cooldown, cost bump, or trade-off to diversify play.`);
    if (isDamage && avgEff && r.eff / avgEff > 1.8 && r.uses > 5) suggestions.push(`**"${r.name}" is under-costed** — ${(r.eff / avgEff).toFixed(1)}x the average value-per-mana. Raise its cost or lower its damage.`);
    if (isDamage && avgEff && r.eff / avgEff < 0.35 && r.uses > 5) suggestions.push(`**"${r.name}" is a weak/dead damage pick** — ${(r.eff / avgEff).toFixed(1)}x average value. Buff it or give it utility so it's worth a card slot.`);
  }
  lines.push('');

  // Suggestions
  lines.push('## 🎯 Balance suggestions\n');
  if (!suggestions.length) lines.push('_No major balance issues detected at these settings. The game is within healthy bands._');
  else [...new Set(suggestions)].forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push('');
  lines.push('---');
  lines.push('_Heuristics: target player win 55-75% (PvE), no ability >18% of casts, value-per-mana within 0.35x–1.8x of average, games 4-15 rounds, sponsor spread <20 pts._');

  const out = path.join(__dirname, '../BALANCE_REPORT.md');
  fs.writeFileSync(out, lines.join('\n'));
  console.log(`\nReport written to ${out}`);
  console.log(`Found ${[...new Set(suggestions)].length} suggestion(s).`);
  // Echo a quick console summary
  console.log('\n=== QUICK SUMMARY ===');
  for (const floor of FLOORS_TO_TEST) {
    const n = byFloor[floor].normal, bo = byFloor[floor].boss;
    console.log(`Floor ${floor}: normal ${n.t?pct(n.w/n.t):'-'}% (${n.t?(n.rounds/n.t).toFixed(1):'-'}r) | boss ${bo.t?pct(bo.w/bo.t):'-'}%`);
  }
}

main();
