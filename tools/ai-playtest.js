// AI vs AI playtest - Claude and Gemini play strategically (not random)
// Each AI receives game state as text and chooses actions
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const CARDS = {
  carl: { name: 'Carl', str: 85, int: 45, con: 95, dex: 70, cha: 50, cost: 3, abilities: ['crowbar_strike', 'jug_o_boom', 'protective_shell'], passive: 'cockroach' },
  donut: { name: 'Donut', str: 30, int: 120, con: 55, dex: 100, cha: 140, cost: 2, abilities: ['magic_missile', 'overcharge', 'decree'], passive: 'narcissism' },
  mongo: { name: 'Mongo', str: 145, int: 15, con: 130, dex: 75, cha: 35, cost: 4, abilities: ['stomp', 'smash', 'devour'], passive: 'mommy' },
  mordecai: { name: 'Mordecai', str: 40, int: 130, con: 65, dex: 60, cha: 85, cost: 3, abilities: ['claw', 'tactical_analysis', 'boon'], passive: 'edge' },
  hekla: { name: 'Hekla', str: 135, int: 25, con: 110, dex: 90, cha: 65, cost: 3, abilities: ['frenzy', 'berserker_rage'], passive: 'defiant' },
  imani: { name: 'Imani', str: 100, int: 55, con: 150, dex: 55, cha: 120, cost: 4, abilities: ['shield_bash', 'rally_cry'], passive: null },
  bautista: { name: 'Bautista', str: 95, int: 60, con: 85, dex: 105, cha: 45, cost: 3, abilities: ['shoot', 'suppress'], passive: null },
};

const MOBS = {
  goblin: { name: 'Goblin', str: 30, int: 15, con: 40, dex: 35, cost: 1 },
  hobgoblin: { name: 'Hobgoblin', str: 50, int: 25, con: 60, dex: 40, cost: 2 },
  gnoll: { name: 'Shade Gnoll', str: 70, int: 30, con: 55, dex: 65, cost: 2 },
  bugbear: { name: 'Bugbear', str: 70, int: 20, con: 80, dex: 50, cost: 3 },
  borough_boss: { name: 'Borough Boss', str: 110, int: 80, con: 140, dex: 100, cost: 5 },
};

const ABILITIES = {
  crowbar_strike: { name: 'Crowbar Strike', cost: 1, type: 'physical', target: 'single', calc: (c) => 3 + Math.floor(c.str/2) },
  jug_o_boom: { name: "Jug O'Boom", cost: 3, type: 'fire', target: 'cleave', calc: (c) => 5 + Math.floor(c.str/2), splash: (c) => 25, dot: 15, cd: 3 },
  protective_shell: { name: 'Protective Shell', cost: 3, type: 'shield', target: 'ally', shield: 60, cd: 3 },
  magic_missile: { name: 'Magic Missile', cost: 1, type: 'magic', target: 'single', calc: (c) => 2 + Math.floor(c.int/2) },
  overcharge: { name: 'Overcharged Missile', cost: 3, type: 'magic', target: 'multi', calc: (c) => 2 + Math.floor(c.int/2), hits: 3 },
  decree: { name: "Princess's Decree", cost: 4, type: 'buff', target: 'team', buff: 40, stat: 'str', duration: 2, cd: 4 },
  stomp: { name: 'Stomp', cost: 2, type: 'physical', target: 'aoe', calc: (c) => Math.floor(c.str/4) },
  smash: { name: 'Mongo Smash', cost: 2, type: 'physical', target: 'single', calc: (c) => Math.floor(c.str/2) },
  devour: { name: 'Devour', cost: 3, type: 'execute', target: 'single', threshold: 0.3, heal: 40, cd: 3 },
  claw: { name: 'Claw Swipe', cost: 1, type: 'magic', target: 'single', calc: (c) => Math.floor(c.int/4) },
  tactical_analysis: { name: 'Tactical Analysis', cost: 2, type: 'debuff', target: 'single', mark: true, cd: 2 },
  boon: { name: "Manager's Boon", cost: 3, type: 'buff', target: 'team', buff: 30, stat: 'str', duration: 2, cd: 3 },
  frenzy: { name: 'Battle Frenzy', cost: 1, type: 'physical', target: 'single', calc: (c) => 4 + Math.floor(c.str/2) },
  berserker_rage: { name: 'Berserker Rage', cost: 3, type: 'self_buff', target: 'self', doubleDmg: true, selfDmg: 20, cd: 4 },
  shield_bash: { name: 'Shield Bash', cost: 2, type: 'physical', target: 'single', calc: (c) => 3 + Math.floor(c.str/2), stun: true },
  rally_cry: { name: 'Rally Cry', cost: 3, type: 'heal', target: 'team', heal: (c) => Math.floor(c.cha/4), cd: 3 },
  shoot: { name: 'Shoot', cost: 1, type: 'physical', target: 'single', calc: (c) => 3 + Math.floor(c.dex/2) },
  suppress: { name: 'Suppressing Fire', cost: 2, type: 'debuff', target: 'single', reduceDmg: 30, duration: 2, cd: 2 },
};

function hp(con) { return 50 + Math.floor(con / 2); }
function dr(con) { return con / 600; }
function applyDR(dmg, targetCon) { return Math.max(1, Math.round(dmg * (1 - dr(targetCon)))); }

class SmartBattle {
  constructor(playerDeck, enemyDeck) {
    this.turn = 0;
    this.mana = { player: 3, enemy: 3 };
    this.maxMana = { player: 3, enemy: 3 };
    this.playerHP = 50;
    this.board = { player: [], enemy: [] };
    this.hand = {
      player: shuffle(playerDeck.map(id => this.makeCard(CARDS[id], id))),
      enemy: shuffle(enemyDeck.map(id => this.makeCard(MOBS[id], id))),
    };
    this.log = [];
    this.winner = null;
    this.buffs = []; // {target, stat, amount, turnsLeft}
    this.marks = []; // {target}
    this.shields = []; // {target, amount}
    this.dots = []; // {target, dmg, turnsLeft}
  }

  makeCard(template, id) {
    return { ...template, id, currentHP: hp(template.con), maxHP: hp(template.con), cd: {}, killCount: 0, stunned: false, doubleDmg: false };
  }

  getState() {
    return {
      turn: this.turn, mana: this.mana, maxMana: this.maxMana,
      playerHP: this.playerHP, winner: this.winner,
      board: { player: this.board.player.map(c => ({ name: c.name, hp: c.currentHP, maxHP: c.maxHP, str: c.str, int: c.int, con: c.con, abilities: c.abilities, cd: c.cd, stunned: c.stunned })),
               enemy: this.board.enemy.map(c => ({ name: c.name, hp: c.currentHP, maxHP: c.maxHP, str: c.str, con: c.con })) },
      hand: { player: this.hand.player.map(c => ({ name: c.name, cost: c.cost })), enemy: this.hand.enemy.length },
      buffs: this.buffs.filter(b => b.turnsLeft > 0).map(b => ({ target: b.target.name, stat: b.stat, amount: b.amount })),
    };
  }

  stateText() {
    const s = this.getState();
    let t = `Turn ${s.turn}. Mana: ${s.mana.player}/${s.maxMana.player}. Player HP: ${s.playerHP}.\n`;
    t += `Your board: ${s.board.player.map(c => `${c.name}(${c.hp}/${c.maxHP}, STR${c.str} INT${c.int||'-'}${c.stunned?' STUNNED':''})`).join(', ') || 'empty'}\n`;
    t += `Enemy board: ${s.board.enemy.map(c => `${c.name}(${c.hp}/${c.maxHP})`).join(', ') || 'empty'}\n`;
    t += `Your hand: ${s.hand.player.map(c => `${c.name}(cost ${c.cost})`).join(', ') || 'empty'}\n`;
    return t;
  }

  executeAction(action) {
    const { type, card, ability, target } = action;
    if (type === 'play') {
      const handCard = this.hand.player.find(c => c.name === card);
      if (!handCard || handCard.cost > this.mana.player) return false;
      this.mana.player -= handCard.cost;
      this.hand.player = this.hand.player.filter(c => c !== handCard);
      this.board.player.push(handCard);
      this.log.push(`  → Play ${handCard.name}`);
      return true;
    }
    if (type === 'ability') {
      const boardCard = this.board.player.find(c => c.name === card);
      // Match ability by ID or name
      let abilId = ability;
      if (!ABILITIES[ability]) {
        // Try to find by name match
        abilId = Object.keys(ABILITIES).find(k => ABILITIES[k].name.toLowerCase() === ability?.toLowerCase()) || 
                 Object.keys(ABILITIES).find(k => ABILITIES[k].name.toLowerCase().includes(ability?.toLowerCase())) ||
                 (boardCard?.abilities || []).find(a => ABILITIES[a]?.name?.toLowerCase().includes(ability?.toLowerCase()));
      }
      const abil = ABILITIES[abilId];
      if (!boardCard || !abil || abil.cost > this.mana.player) return false;
      if (boardCard.cd[abilId] > 0) return false;
      if (boardCard.stunned) return false;
      this.mana.player -= abil.cost;
      if (abil.cd) boardCard.cd[abilId] = abil.cd;

      const tgt = target ? this.board.enemy.find(c => c.name === target) || this.board.enemy[0] : this.board.enemy[0];
      
      if (abil.calc && tgt) {
        let dmg = abil.calc(boardCard);
        if (boardCard.doubleDmg) { dmg *= 2; boardCard.doubleDmg = false; }
        const isMarked = this.marks.some(m => m.target === tgt);
        if (isMarked) { dmg = Math.floor(dmg * 1.5); this.marks = this.marks.filter(m => m.target !== tgt); }
        const actual = applyDR(dmg, tgt.con);

        if (abil.target === 'aoe') {
          for (const e of [...this.board.enemy]) {
            const d = applyDR(dmg, e.con);
            e.currentHP -= d;
            this.log.push(`  → ${boardCard.name} ${abil.name} → ${e.name} for ${d}`);
            if (e.currentHP <= 0) this.killEnemy(e, boardCard);
          }
        } else if (abil.target === 'multi') {
          const hits = abil.hits || 3;
          for (let i = 0; i < hits && this.board.enemy.length > 0; i++) {
            const t2 = this.board.enemy[i % this.board.enemy.length];
            const d = applyDR(dmg, t2.con);
            t2.currentHP -= d;
            this.log.push(`  → ${boardCard.name} ${abil.name} → ${t2.name} for ${d}`);
            if (t2.currentHP <= 0) this.killEnemy(t2, boardCard);
          }
        } else if (abil.target === 'cleave' && tgt) {
          tgt.currentHP -= actual;
          this.log.push(`  → ${boardCard.name} ${abil.name} → ${tgt.name} for ${actual}`);
          if (tgt.currentHP <= 0) this.killEnemy(tgt, boardCard);
          // Splash adjacent
          const idx = this.board.enemy.indexOf(tgt);
          for (const adj of [this.board.enemy[idx-1], this.board.enemy[idx+1]].filter(Boolean)) {
            const sd = applyDR(abil.splash(boardCard), adj.con);
            adj.currentHP -= sd;
            this.log.push(`  → splash ${adj.name} for ${sd}`);
            if (adj.currentHP <= 0) this.killEnemy(adj, boardCard);
          }
          if (abil.dot) this.dots.push({ target: tgt, dmg: abil.dot, turnsLeft: 2 });
        } else if (tgt) {
          tgt.currentHP -= actual;
          this.log.push(`  → ${boardCard.name} ${abil.name} → ${tgt.name} for ${actual}`);
          if (abil.stun) tgt.stunned = true;
          if (tgt.currentHP <= 0) this.killEnemy(tgt, boardCard);
        }
      } else if (abil.type === 'buff') {
        for (const ally of this.board.player) {
          this.buffs.push({ target: ally, stat: abil.stat, amount: abil.buff, turnsLeft: abil.duration });
          ally[abil.stat] += abil.buff;
        }
        this.log.push(`  → ${boardCard.name} ${abil.name}: all allies +${abil.buff} ${abil.stat}`);
      } else if (abil.type === 'heal') {
        const healAmt = typeof abil.heal === 'function' ? abil.heal(boardCard) : abil.heal;
        for (const ally of this.board.player) {
          ally.currentHP = Math.min(ally.maxHP, ally.currentHP + healAmt);
        }
        this.log.push(`  → ${boardCard.name} ${abil.name}: heal all ${healAmt}`);
      } else if (abil.type === 'shield') {
        const allyTgt = this.board.player.reduce((a, b) => a.currentHP < b.currentHP ? a : b);
        this.shields.push({ target: allyTgt, amount: abil.shield });
        this.log.push(`  → ${boardCard.name} shields ${allyTgt.name} for ${abil.shield}`);
      } else if (abil.mark) {
        if (tgt) { this.marks.push({ target: tgt }); this.log.push(`  → ${boardCard.name} marks ${tgt.name}`); }
      } else if (abil.doubleDmg) {
        boardCard.doubleDmg = true;
        boardCard.currentHP -= abil.selfDmg;
        this.log.push(`  → ${boardCard.name} Berserker Rage! (self -${abil.selfDmg})`);
      } else if (abil.type === 'execute' && tgt) {
        if (tgt.currentHP / tgt.maxHP < abil.threshold) {
          this.log.push(`  → ${boardCard.name} DEVOURS ${tgt.name}!`);
          this.killEnemy(tgt, boardCard);
          boardCard.currentHP = Math.min(boardCard.maxHP, boardCard.currentHP + abil.heal);
        }
      } else if (abil.reduceDmg && tgt) {
        tgt.str -= abil.reduceDmg;
        this.buffs.push({ target: tgt, stat: 'str', amount: -abil.reduceDmg, turnsLeft: abil.duration });
        this.log.push(`  → ${boardCard.name} suppresses ${tgt.name} (-${abil.reduceDmg} STR)`);
      }
      return true;
    }
    return false;
  }

  killEnemy(enemy, killer) {
    this.board.enemy = this.board.enemy.filter(c => c !== enemy);
    killer.killCount++;
    this.log.push(`  💀 ${enemy.name} KILLED by ${killer.name}`);
  }

  enemyTurn() {
    this.turn++;
    this.maxMana.enemy = Math.min(10, this.maxMana.enemy + 1);
    this.mana.enemy = this.maxMana.enemy;

    // Play up to 2
    let played = 0;
    for (let i = 0; i < this.hand.enemy.length && played < 2; i++) {
      const c = this.hand.enemy[i];
      if (c.cost <= this.mana.enemy && this.board.enemy.length < 5) {
        this.mana.enemy -= c.cost;
        this.hand.enemy.splice(i, 1); i--;
        this.board.enemy.push(c);
        played++;
        this.log.push(`  [AI] plays ${c.name}`);
      }
    }

    // Attack: target lowest HP player card
    for (const m of [...this.board.enemy]) {
      if (m.stunned) { m.stunned = false; this.log.push(`  [AI] ${m.name} is stunned`); continue; }
      if (this.board.player.length === 0) {
        this.playerHP -= Math.floor(3 + m.str/2);
        this.log.push(`  [AI] ${m.name} hits face for ${3 + Math.floor(m.str/2)}`);
        if (this.playerHP <= 0) { this.winner = 'enemy'; return; }
        continue;
      }
      const target = this.board.player.reduce((a, b) => a.currentHP < b.currentHP ? a : b);
      let dmg = applyDR(3 + Math.floor(m.str/2), target.con);
      // Check shield
      const shield = this.shields.find(s => s.target === target);
      if (shield) {
        const absorbed = Math.min(shield.amount, dmg);
        dmg -= absorbed;
        shield.amount -= absorbed;
        if (shield.amount <= 0) this.shields = this.shields.filter(s => s !== shield);
      }
      target.currentHP -= dmg;
      this.log.push(`  [AI] ${m.name} → ${target.name} for ${dmg} (${target.currentHP}hp)`);
      if (target.currentHP <= 0) {
        // Check cockroach
        if (target.passive === 'cockroach' && !target.cockroachUsed) {
          target.currentHP = 1;
          target.cockroachUsed = true;
          this.log.push(`  🪳 ${target.name} COCKROACH! Survives at 1 HP!`);
        } else {
          this.board.player = this.board.player.filter(c => c !== target);
          this.playerHP -= 5;
          this.log.push(`  💀 ${target.name} dies! Player takes 5 face damage (${this.playerHP} HP)`);
          if (this.playerHP <= 0) { this.winner = 'enemy'; return; }
        }
      }
    }

    // Tick buffs
    for (const b of this.buffs) {
      b.turnsLeft--;
      if (b.turnsLeft <= 0) b.target[b.stat] -= b.amount;
    }
    this.buffs = this.buffs.filter(b => b.turnsLeft > 0);

    // Tick DoTs
    for (const d of [...this.dots]) {
      if (d.target.currentHP > 0) {
        d.target.currentHP -= d.dmg;
        this.log.push(`  🔥 ${d.target.name} burns for ${d.dmg}`);
      }
      d.turnsLeft--;
    }
    this.dots = this.dots.filter(d => d.turnsLeft > 0);

    // Check win
    if (this.board.enemy.length === 0 && this.hand.enemy.length === 0) this.winner = 'player';
  }

  playerTurn() {
    this.turn++;
    this.maxMana.player = Math.min(10, this.maxMana.player + 1);
    this.mana.player = this.maxMana.player;
    // Reduce CDs
    for (const c of this.board.player) { for (const k of Object.keys(c.cd)) { if (c.cd[k] > 0) c.cd[k]--; } }
  }
}

// AI player that queries Claude or Gemini for decisions
async function getAIAction(model, stateText, availableActions) {
  const prompt = `You are playing a card battle game. Choose the BEST action. Respond with ONLY a JSON object.

GAME STATE:
${stateText}

AVAILABLE ACTIONS:
${availableActions}

Respond with ONE JSON like: {"type":"play","card":"Carl"} or {"type":"ability","card":"Donut","ability":"magic_missile","target":"Goblin"} or {"type":"end_turn"}
Choose the strategically optimal action.`;

  if (model === 'claude') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-opus-4-8', max_tokens: 100, messages: [{role:'user', content: prompt}] })
    }).then(r => r.json());
    const text = r.content?.[0]?.text || '{}';
    try { return JSON.parse(text.match(/\{[^}]+\}/)?.[0] || '{"type":"end_turn"}'); } catch { return { type: 'end_turn' }; }
  } else {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{role:'user', parts:[{text: prompt}]}], generationConfig: { maxOutputTokens: 100, temperature: 0.2 } })
    }).then(r => r.json());
    const text = r.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    try { return JSON.parse(text.match(/\{[^}]+\}/)?.[0] || '{"type":"end_turn"}'); } catch { return { type: 'end_turn' }; }
  }
}

function getAvailableActions(battle) {
  let actions = [];
  // Play from hand
  for (const c of battle.hand.player) {
    if (c.cost <= battle.mana.player) actions.push(`play ${c.name} (cost ${c.cost})`);
  }
  // Use abilities
  for (const c of battle.board.player) {
    if (c.stunned) continue;
    for (const aId of (c.abilities || [])) {
      const a = ABILITIES[aId];
      if (a && a.cost <= battle.mana.player && !(c.cd[aId] > 0)) {
        const targets = battle.board.enemy.map(e => e.name).join('/');
        actions.push(`${c.name} use ${a.name} (cost ${a.cost}${targets ? ', targets: '+targets : ''})`);
      }
    }
  }
  actions.push('end_turn');
  return actions.join('\n');
}

async function playGame(model, gameNum) {
  const playerDeck = shuffle(['carl', 'donut', 'mongo', 'hekla', 'bautista', 'mordecai', 'imani']);
  const enemyDeck = shuffle(['goblin', 'goblin', 'hobgoblin', 'hobgoblin', 'gnoll', 'bugbear', 'borough_boss']);
  const battle = new SmartBattle(playerDeck, enemyDeck);

  console.log(`\n${'='.repeat(50)}\nGAME ${gameNum} (${model}) — Player: ${playerDeck.map(id => CARDS[id].name).join(', ')}\n${'='.repeat(50)}`);

  for (let round = 0; round < 20 && !battle.winner; round++) {
    battle.playerTurn();
    console.log(`\n--- Round ${round+1} (mana ${battle.mana.player}) ---`);

    // Player takes up to 3 actions per turn
    for (let actionNum = 0; actionNum < 4 && !battle.winner; actionNum++) {
      const available = getAvailableActions(battle);
      if (available === 'end_turn') break;

      const action = await getAIAction(model, battle.stateText(), available);
      if (!action || action.type === 'end_turn') break;

      const prevLogLen = battle.log.length;
      const success = battle.executeAction(action);
      // Print new log entries
      for (let i = prevLogLen; i < battle.log.length; i++) console.log(battle.log[i]);
      if (!success) { console.log(`  (action failed: ${JSON.stringify(action)})`); break; }
    }

    if (battle.winner) break;
    const prevLogLen = battle.log.length;
    battle.enemyTurn();
    for (let i = prevLogLen; i < battle.log.length; i++) console.log(battle.log[i]);
    if (battle.board.enemy.length === 0 && battle.hand.enemy.length === 0) battle.winner = 'player';
  }

  if (!battle.winner) battle.winner = 'draw';
  console.log(`\n🏁 RESULT: ${battle.winner.toUpperCase()} WINS (${battle.turn} turns)`);
  console.log(`   Kills: ${battle.board.player.reduce((s, c) => s + c.killCount, 0)} enemies destroyed`);
  return { winner: battle.winner, turns: battle.turn, log: battle.log };
}

function shuffle(arr) { for (let i = arr.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }

async function main() {
  const results = { claude: [], gemini: [] };

  for (let i = 1; i <= 3; i++) {
    results.claude.push(await playGame('claude', i));
    results.gemini.push(await playGame('gemini', i));
  }

  console.log('\n\n' + '='.repeat(50));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(50));
  console.log(`Claude: ${results.claude.filter(r=>r.winner==='player').length}/3 wins, avg ${Math.round(results.claude.reduce((s,r)=>s+r.turns,0)/3)} turns`);
  console.log(`Gemini: ${results.gemini.filter(r=>r.winner==='player').length}/3 wins, avg ${Math.round(results.gemini.reduce((s,r)=>s+r.turns,0)/3)} turns`);
}

main().catch(e => { console.error(e); process.exit(1); });
