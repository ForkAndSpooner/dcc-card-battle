// Headless Playtest Engine - simulates battles with v4 math
// No visuals, no audio - pure game logic + AI decision-making

const CARDS = {
  carl: { name: 'Carl', str: 85, int: 45, con: 95, dex: 70, cha: 50, cost: 3, abilities: ['crowbar', 'jug', 'shell'], passive: 'cockroach' },
  donut: { name: 'Donut', str: 30, int: 120, con: 55, dex: 100, cha: 140, cost: 2, abilities: ['missile', 'overcharge', 'decree'], passive: 'narcissism' },
  mongo: { name: 'Mongo', str: 145, int: 15, con: 130, dex: 75, cha: 35, cost: 4, abilities: ['stomp', 'smash', 'devour'], passive: 'mommy' },
  mordecai: { name: 'Mordecai', str: 40, int: 130, con: 65, dex: 60, cha: 85, cost: 3, abilities: ['claw', 'analysis', 'boon'], passive: 'edge' },
  hekla: { name: 'Hekla', str: 135, int: 25, con: 110, dex: 90, cha: 65, cost: 3, abilities: ['frenzy', 'rage'], passive: 'defiant' },
  imani: { name: 'Imani', str: 100, int: 55, con: 150, dex: 55, cha: 120, cost: 4, abilities: ['strike', 'rally'], passive: null },
  bautista: { name: 'Bautista', str: 95, int: 60, con: 85, dex: 105, cha: 45, cost: 3, abilities: ['shoot', 'suppress'], passive: null },
};

const MOBS = {
  goblin: { name: 'Goblin', str: 30, int: 15, con: 40, dex: 35, cha: 10, cost: 1 },
  hobgoblin: { name: 'Hobgoblin', str: 50, int: 25, con: 60, dex: 40, cha: 15, cost: 2 },
  gnoll: { name: 'Shade Gnoll', str: 70, int: 30, con: 55, dex: 65, cha: 20, cost: 2 },
  bugbear: { name: 'Bugbear', str: 70, int: 20, con: 80, dex: 50, cha: 15, cost: 3 },
  borough_boss: { name: 'Borough Boss', str: 110, int: 80, con: 140, dex: 100, cha: 60, cost: 5 },
};

function hp(con) { return 50 + Math.floor(con / 2); }
function dr(con) { return con / 600; } // percentage as decimal (CON 150 = 25%)
function physDmg(str, base = 3) { return base + Math.floor(str / 2); }
function spellDmg(int, base = 2) { return base + Math.floor(int / 2); }
function applyDR(dmg, targetCon) { return Math.max(1, Math.round(dmg * (1 - dr(targetCon)))); }

class PlaytestBattle {
  constructor(playerDeck, enemyDeck) {
    this.turn = 0;
    this.mana = { player: 3, enemy: 3 };
    this.maxMana = { player: 3, enemy: 3 };
    this.playerHP = 50; // player face HP
    this.board = { player: [], enemy: [] };
    this.hand = {
      player: playerDeck.map(id => ({ ...CARDS[id], id, currentHP: hp(CARDS[id].con), maxHP: hp(CARDS[id].con), cd: {}, killCount: 0 })),
      enemy: enemyDeck.map(id => ({ ...MOBS[id], id, currentHP: hp(MOBS[id].con), maxHP: hp(MOBS[id].con) })),
    };
    this.log = [];
    this.winner = null;
    this.stats = { totalDamage: 0, turns: 0, kills: { player: 0, enemy: 0 } };
  }

  playTurn(side) {
    this.turn++;
    this.stats.turns++;
    const mana = this.maxMana[side] = Math.min(10, this.maxMana[side] + (this.turn > 1 ? 1 : 0));
    this.mana[side] = mana;

    // Play cards from hand if affordable (max 2 per turn for enemy)
    let played = 0;
    const maxPlays = side === 'enemy' ? 2 : 5;
    while (this.hand[side].length > 0 && this.board[side].length < 5 && played < maxPlays) {
      const card = this.hand[side].find(c => c.cost <= this.mana[side]);
      if (!card) break;
      this.mana[side] -= card.cost;
      this.hand[side] = this.hand[side].filter(c => c !== card);
      this.board[side].push(card);
      this.log.push(`[T${this.turn}] ${side} plays ${card.name}`);
      played++;
    }

    // Attack with board cards
    const otherSide = side === 'player' ? 'enemy' : 'player';
    for (const card of [...this.board[side]]) {
      if (this.board[otherSide].length === 0) {
        // Hit face
        const dmg = side === 'player' ? physDmg(card.str) : physDmg(card.str, 2);
        if (side === 'enemy') this.playerHP -= dmg;
        this.stats.totalDamage += dmg;
        this.log.push(`[T${this.turn}] ${card.name} hits face for ${dmg}`);
        if (this.playerHP <= 0) { this.winner = 'enemy'; return; }
        continue;
      }
      // Target weakest enemy
      const target = this.board[otherSide].reduce((a, b) => a.currentHP < b.currentHP ? a : b);
      let dmg;
      if (card.int > card.str) {
        dmg = applyDR(spellDmg(card.int), target.con);
      } else {
        dmg = applyDR(physDmg(card.str), target.con);
      }
      target.currentHP -= dmg;
      this.stats.totalDamage += dmg;
      this.log.push(`[T${this.turn}] ${card.name} → ${target.name} for ${dmg} (${target.currentHP}/${target.maxHP} HP)`);

      if (target.currentHP <= 0) {
        this.board[otherSide] = this.board[otherSide].filter(c => c !== target);
        this.stats.kills[side]++;
        card.killCount = (card.killCount || 0) + 1;
        this.log.push(`[T${this.turn}] ${target.name} DIES (killed by ${card.name})`);
        // Face damage when player's card dies
        if (otherSide === 'player') {
          this.playerHP -= 5;
          if (this.playerHP <= 0) { this.winner = 'enemy'; return; }
        }
      }
    }

    // Check win: all enemies dead and enemy hand empty
    if (side === 'player' && this.board.enemy.length === 0 && this.hand.enemy.length === 0) {
      this.winner = 'player';
    }
  }

  run(maxTurns = 30) {
    while (!this.winner && this.turn < maxTurns * 2) {
      this.playTurn('player');
      if (this.winner) break;
      this.playTurn('enemy');
    }
    if (!this.winner) this.winner = 'draw';
    return { winner: this.winner, turns: Math.ceil(this.turn / 2), stats: this.stats, log: this.log };
  }
}

// Run N battles and aggregate
function runPlaytest(n = 20) {
  const results = { player: 0, enemy: 0, draw: 0, avgTurns: 0, avgDamage: 0, logs: [] };
  const playerDeck = ['carl', 'donut', 'mongo', 'hekla', 'bautista'];
  const enemyDeck = ['goblin', 'goblin', 'hobgoblin', 'hobgoblin', 'gnoll', 'bugbear', 'borough_boss'];

  for (let i = 0; i < n; i++) {
    const b = new PlaytestBattle(
      shuffle([...playerDeck]),
      shuffle([...enemyDeck])
    );
    const r = b.run();
    results[r.winner]++;
    results.avgTurns += r.turns;
    results.avgDamage += r.stats.totalDamage;
    if (i < 3) results.logs.push(r.log); // save first 3 for review
  }
  results.avgTurns = Math.round(results.avgTurns / n);
  results.avgDamage = Math.round(results.avgDamage / n);
  return results;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = { PlaytestBattle, runPlaytest, CARDS, MOBS };

// If run directly
if (require.main === module) {
  const r = runPlaytest(50);
  console.log(`\n=== PLAYTEST RESULTS (50 battles) ===`);
  console.log(`Player wins: ${r.player} (${r.player*2}%)`);
  console.log(`Enemy wins: ${r.enemy} (${r.enemy*2}%)`);
  console.log(`Draws: ${r.draw}`);
  console.log(`Avg turns: ${r.avgTurns}`);
  console.log(`Avg total damage: ${r.avgDamage}`);
  console.log(`\n--- Sample battle log ---`);
  console.log(r.logs[0]?.join('\n'));
}
