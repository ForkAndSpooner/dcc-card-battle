// ============================================================================
// BOSS MECHANICS — each boss has a signature behavior and a WEAKNESS the
// player must discover through play. Hooks called by BattleEngine:
//   onBossTurn(boss, eng)            -> runs during the enemy turn (spawn/charge/etc). Returns action descriptors.
//   modifyIncomingDamage(boss, dmg, ctx) -> { dmg, note, fx } resistance/weakness gate on player damage to the boss.
//   onMinionDeath(boss, minion, eng) -> { text, dmg, fx, big } when one of the boss's minions dies.
//   battleCondition                  -> { label, aoeNerf, manaBonus, ... } special rules that modify the fight.
// `weakness` is a short hint surfaced cryptically in the intro and confirmed via combat feedback.
const crypto = require('crypto');

function makeSwarmCard(name, { str = 2, con = 2, dex = 3, hp = 5, emoji = '🪳' } = {}) {
  return {
    id: 'minion_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    name, str, int: 1, con, dex, currentHP: hp, maxHP: hp, cd: {},
    emoji, instanceId: crypto.randomUUID(), justPlayed: true, bossSpawn: true,
  };
}

const MECHANICS = {
  // ===== THE HOARDER — the marquee fight =====
  choking_swarm: {
    weakness: 'Her hide is too thick to wound directly. Something about all those bugs in her throat…',
    battleCondition: { label: '🪳 The Hoarder\'s Lair is CRAMPED — AoE spells deal 70% less damage!', aoeNerf: 0.3 },
    fullBoard: true, // wants the whole board for her swarm
    onBossTurn(boss, eng) {
      // Fill EVERY empty enemy slot with Scatterer bugs — the player always faces a full swarm
      const MAX = 8;
      let spawned = 0;
      while (eng.board.enemy.length < MAX) {
        const bug = makeSwarmCard('Scatterer', { str: 2, con: 1, dex: 3, hp: 4 });
        bug.bossSwarm = true;
        eng.board.enemy.push(bug);
        spawned++;
      }
      if (!spawned) return [];
      return [{ type: 'boss_mechanic', name: 'Endless Swarm', text: `🪳 The Hoarder vomits ${spawned} more Scatterers — clear them!`, fx: 'swarm' }];
    },
    modifyIncomingDamage(boss, dmg, ctx) {
      const bugsLeft = ctx.engine.board.enemy.some(e => e.bossSwarm && e !== boss);
      if (bugsLeft) return { dmg: Math.max(1, Math.round(dmg * 0.12)), note: '🛡️ The Hoarder barely flinches — she\'s shielded by her swarm!', fx: 'resist' };
      return { dmg: Math.round(dmg * 2), note: '💥 Exposed! The Hoarder takes full damage!', fx: 'weak' };
    },
    onMinionDeath(boss, minion, eng) {
      if (!minion.bossSwarm) return null;
      const choke = 7;
      boss.currentHP -= choke;
      const bugsLeft = eng.board.enemy.some(e => e.bossSwarm && e !== boss);
      if (!bugsLeft) {
        const big = 30;
        boss.currentHP -= big;
        return { text: `🤢 The Hoarder CHOKES on the last Scatterer! ${choke + big} damage!`, dmg: choke + big, fx: 'choke', big: true };
      }
      return { text: `🤢 The Hoarder gags on a dying Scatterer (${choke} dmg)`, dmg: choke, fx: 'choke' };
    },
  },

  // ===== Krakaren Clone — tentacles regrow; body is armored until they're gone =====
  hydra_reach: {
    weakness: 'The body is wrapped in thrashing tentacles. They keep coming…',
    battleCondition: { label: '🐙 Flooded Chamber — fire damage is halved!', fireNerf: 0.5 },
    onMinionDeath(boss, minion, eng) {
      if (eng.board.enemy.length >= 6) return null;
      // Each severed tentacle births one more (capped so it stays winnable)
      const t = makeSwarmCard('Krakaren Tentacle', { str: 3, con: 2, dex: 2, hp: 7, emoji: '🐙' });
      t.bossSwarm = true; eng.board.enemy.push(t);
      return { text: '🐙 Sever one tentacle and another bursts from the walls!', fx: 'swarm' };
    },
    modifyIncomingDamage(boss, dmg, ctx) {
      const tentacles = ctx.engine.board.enemy.some(e => e.bossSwarm && e !== boss);
      if (tentacles) return { dmg: Math.max(1, Math.round(dmg * 0.2)), note: '🛡️ The tentacles shield the body!', fx: 'resist' };
      return { dmg: Math.round(dmg * 1.8), note: '💥 The body is exposed!', fx: 'weak' };
    },
  },

  // ===== Heather the Roller-Skating Bear — builds momentum; stun resets it =====
  skating_charge: {
    weakness: 'She gathers speed every turn. Knock her off her skates…',
    battleCondition: { label: '🛼 Open Arena — Heather has room to charge. No hiding!', noTaunt: true },
    onBossTurn(boss, eng) {
      if (boss.stunned) { boss.chargeStacks = 0; boss.str = boss._baseStr || boss.str; return [{ type: 'boss_mechanic', name: 'Wiped Out', text: '🛼 Heather is knocked off her skates — charge reset!', fx: 'stun' }]; }
      boss._baseStr = boss._baseStr || boss.str;
      boss.chargeStacks = (boss.chargeStacks || 0) + 1;
      boss.str = boss._baseStr + boss.chargeStacks * 2;
      return [{ type: 'boss_mechanic', name: 'Skating Charge', text: `🛼 Heather builds speed! (+${boss.chargeStacks * 2} STR — STUN her to reset)`, fx: 'charge' }];
    },
  },

  // ===== Ringmaster Grimaldi — mind-controls minions, shielded while they live =====
  parasitic_spores: {
    weakness: 'His vines control the circus. Free them from the spores…',
    battleCondition: { label: '🎪 Circus Tent — spore fog reduces visibility. Heal effects halved!', healNerf: 0.5 },
    onBossTurn(boss, eng) {
      const minions = eng.board.enemy.filter(e => e !== boss);
      minions.forEach(m => { m.str = (m.str || 1) + 2; });
      if (!minions.length) return [];
      return [{ type: 'boss_mechanic', name: 'Mind-Control Spores', text: `🎪 Grimaldi's spores enrage his ${minions.length} thralls (+2 STR each)`, fx: 'spore' }];
    },
    modifyIncomingDamage(boss, dmg, ctx) {
      const thralls = ctx.engine.board.enemy.some(e => e !== boss);
      if (thralls) return { dmg: Math.max(1, Math.round(dmg * 0.25)), note: '🛡️ Vines absorb the blow — kill his thralls first!', fx: 'resist' };
      return { dmg, note: null };
    },
  },

  // ===== Mimic Rex — regenerates unless you burst it hard =====
  chomp_split: {
    weakness: 'Chip damage just makes it scuttle and heal. Hit it HARD…',
    battleCondition: { label: '🦖 Narrow Tunnels — you can only deploy 3 cards at a time!', boardCap: 3 },
    modifyIncomingDamage(boss, dmg, ctx) {
      // A hit under 25% of max HP barely registers and it will regrow
      if (dmg < boss.maxHP * 0.25) { boss._chipped = true; return { dmg, note: '🦖 Too soft — the Mimic Rex will regrow this!', fx: 'resist' }; }
      boss._chipped = false;
      return { dmg: Math.round(dmg * 1.3), note: '💥 A mighty blow severs real mass!', fx: 'weak' };
    },
    onBossTurn(boss, eng) {
      if (boss._chipped && boss.currentHP < boss.maxHP) {
        const regen = Math.round(boss.maxHP * 0.12);
        boss.currentHP = Math.min(boss.maxHP, boss.currentHP + regen);
        boss._chipped = false;
        return [{ type: 'boss_mechanic', name: 'Chomp & Split', text: `🦖 Severed pieces scuttle back — Mimic Rex heals ${regen}!`, fx: 'heal' }];
      }
      return [];
    },
  },

  // ===== Lusca — swallows an ally each turn until you damage her enough =====
  soft_vore: {
    weakness: 'She swallows your crew whole. Make her spit them out…',
    battleCondition: { label: '🦈 Underwater — physical attacks deal 30% less damage!', physNerf: 0.7 },
    onBossTurn(boss, eng) {
      boss._dmgSinceSwallow = 0;
      const free = eng.board.player.filter(c => !c.swallowed);
      if (free.length > 1) {
        const victim = free[Math.floor(Math.random() * free.length)];
        victim.swallowed = true; victim.usedAction = true;
        return [{ type: 'boss_mechanic', name: 'Soft Vore', text: `🦈 Lusca swallows ${victim.name}! Damage her 20 to free them.`, fx: 'vore' }];
      }
      return [];
    },
    modifyIncomingDamage(boss, dmg, ctx) {
      boss._dmgSinceSwallow = (boss._dmgSinceSwallow || 0) + dmg;
      if (boss._dmgSinceSwallow >= 20) {
        ctx.engine.board.player.forEach(c => { c.swallowed = false; });
        boss._dmgSinceSwallow = 0;
        return { dmg, note: '🤮 Lusca retches up your swallowed crew!', fx: 'weak' };
      }
      return { dmg, note: null };
    },
  },

  // ===== Queen Imogen — intangible; only physical skills land, on the beat =====
  intangibility: {
    weakness: 'Magic passes right through her shimmering form. Steel, on the beat…',
    battleCondition: { label: '👑 Throne Room — magical wards reduce spell damage by 40%!', spellNerf: 0.6 },
    onBossTurn(boss, eng) {
      boss.phasedOut = !boss.phasedOut;
      return [{ type: 'boss_mechanic', name: boss.phasedOut ? 'Dandelion Phase' : 'Solid Form',
        text: boss.phasedOut ? '👑 Imogen turns to dandelion seeds — untouchable!' : '👑 Imogen is briefly solid — STRIKE NOW!', fx: boss.phasedOut ? 'phase' : 'weak' }];
    },
    modifyIncomingDamage(boss, dmg, ctx) {
      const type = ctx.dmgType;
      if (type === 'fire') return { dmg: 0, note: '🔥 Imogen REFLECTS the flames!', fx: 'reflect', reflect: dmg };
      if (type && type !== 'physical') return { dmg: 0, note: '✨ Magic phases through her!', fx: 'resist' };
      if (boss.phasedOut) return { dmg: Math.max(1, Math.round(dmg * 0.1)), note: '👻 She\'s phased out — almost no damage!', fx: 'resist' };
      return { dmg: Math.round(dmg * 1.5), note: '⚔️ A solid hit lands!', fx: 'weak' };
    },
  },

  // ===== Reminiscence Hydra — adapts to the last damage type =====
  adaptive_heads: {
    weakness: 'It learns. Hit it the same way twice and it shrugs you off…',
    battleCondition: { label: '🐉 Memory Storm — abilities on cooldown deal 50% less damage!', cdPenalty: 0.5 },
    modifyIncomingDamage(boss, dmg, ctx) {
      const type = ctx.dmgType || 'physical';
      if (boss._lastType === type) return { dmg: Math.max(1, Math.round(dmg * 0.3)), note: `🐉 The Hydra adapted to ${type}! Vary your attacks.`, fx: 'resist' };
      boss._lastType = type;
      return { dmg, note: '💥 A novel attack — the Hydra reels!', fx: 'weak' };
    },
  },

  // ===== Shi Maria — Cockroach: survives first death, revives full =====
  bedlam_cockroach: {
    weakness: 'Slay her and she just… gets back up. Kill her again…',
    modifyIncomingDamage(boss, dmg, ctx) {
      if (boss.currentHP - dmg <= 0 && !boss._revived) {
        boss._revived = true;
        boss.currentHP = boss.maxHP;
        return { dmg: 0, note: '🪳 COCKROACH! Shi Maria heals to full and rises again!', fx: 'revive' };
      }
      return { dmg, note: null };
    },
  },

  // ===== Ball of Swine — rolling momentum; stun resets =====
  rolling_formation: {
    weakness: 'The faster it rolls the harder it hits. Stop the roll…',
    onBossTurn(boss, eng) {
      if (boss.stunned) { boss.rollStacks = 0; boss.str = boss._baseStr || boss.str; return [{ type: 'boss_mechanic', name: 'Stopped Cold', text: '🐗 The Ball of Swine grinds to a halt — STR reset!', fx: 'stun' }]; }
      boss._baseStr = boss._baseStr || boss.str;
      boss.rollStacks = (boss.rollStacks || 0) + 1;
      boss.str = boss._baseStr + boss.rollStacks * 2;
      return [{ type: 'boss_mechanic', name: 'Rolling Charge', text: `🐗 It picks up speed (+${boss.rollStacks * 2} STR — STUN to stop it)`, fx: 'charge' }];
    },
  },

  // ===== The Juicer — only crits hit the pressurized vein =====
  pressure_vein: {
    weakness: 'His hide deflects normal blows. Aim for that throbbing vein…',
    modifyIncomingDamage(boss, dmg, ctx) {
      if (ctx.crit) return { dmg: Math.round(dmg * 3), note: '💉 VEIN HIT! The Juicer takes triple damage!', fx: 'weak' };
      return { dmg: Math.max(1, Math.round(dmg * 0.3)), note: '🛡️ Bounces off his bulging muscle — land a CRIT!', fx: 'resist' };
    },
  },

  // ===== Gore-Gore — periodic train surge AoE =====
  train_charge: {
    weakness: 'Every other turn the train surges. Burn him down before it does…',
    battleCondition: { label: '🚄 On the Rails — the floor shakes! Max 4 cards on your board.', boardCap: 4 },
    onBossTurn(boss, eng) {
      boss._surge = (boss._surge || 0) + 1;
      if (boss._surge % 2 === 0) {
        const dmg = 8;
        eng.board.player.forEach(c => { c.currentHP -= dmg; });
        eng.board.player = eng.board.player.filter(c => c.currentHP > 0);
        return [{ type: 'boss_mechanic', name: 'Train Surge', text: `🚄 GORE-GORE SURGES — ${dmg} damage to your whole board!`, fx: 'surge', big: true }];
      }
      return [{ type: 'boss_mechanic', name: 'Building Speed', text: '🚄 The train winds up… (surge next turn!)', fx: 'charge' }];
    },
  },

  // ===== Ghazi — scrambles lanes, electrified (melee recoil) =====
  glass_maze: {
    weakness: 'His electric glass maze punishes melee. Strike from range…',
    battleCondition: { label: '🏜️ Electrified Glass — melee attackers take recoil! Use ranged/magic.', meleeRecoil: 3 },
    onBossTurn(boss, eng) {
      // Scramble player board order
      for (let i = eng.board.player.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[eng.board.player[i], eng.board.player[j]] = [eng.board.player[j], eng.board.player[i]]; }
      return [{ type: 'boss_mechanic', name: 'Shifting Maze', text: '🏜️ Ghazi rearranges the glass maze — your lanes are scrambled!', fx: 'scramble' }];
    },
    modifyIncomingDamage(boss, dmg, ctx) {
      if (ctx.dmgType === 'physical' && ctx.source) {
        ctx.source.currentHP -= 3; // electrified recoil on melee
        return { dmg, note: '⚡ Electrified glass shocks your attacker (-3 HP)!', fx: 'shock' };
      }
      return { dmg, note: null };
    },
  },

  // ===== Odious Creepers — spawn creepers that fuse into a mega at 3+ =====
  night_combine: {
    weakness: 'Let them gather and they merge into something worse. Keep the board clear…',
    battleCondition: { label: '🌿 Overgrown at Night — enemy board cap increased to 10! Clear fast.', enemyBoardBonus: 2 },
    onBossTurn(boss, eng) {
      const creepers = eng.board.enemy.filter(e => e.creeper);
      if (creepers.length >= 3) {
        // Fuse the smallest 3 into one mega
        creepers.slice(0, 3).forEach(c => { eng.board.enemy = eng.board.enemy.filter(e => e !== c); });
        const mega = makeSwarmCard('Mega-Creeper', { str: 6, con: 5, dex: 2, hp: 22, emoji: '🌿' });
        mega.creeper = true; mega.bossSwarm = true; eng.board.enemy.push(mega);
        return [{ type: 'boss_mechanic', name: 'Night Fusion', text: '🌿 Three Creepers FUSE into a Mega-Creeper!', fx: 'fuse', big: true }];
      }
      const spawned = [];
      for (let i = 0; i < 2 && eng.board.enemy.length < 8; i++) {
        const c = makeSwarmCard('Odious Creeper', { str: 2, con: 4, dex: 2, hp: 10, emoji: '🌿' });
        c.creeper = true; c.bossSwarm = true; eng.board.enemy.push(c); spawned.push(c);
      }
      return spawned.length ? [{ type: 'boss_mechanic', name: 'Creep', text: `🌿 ${spawned.length} Odious Creepers crawl out — kill them before they fuse!`, fx: 'swarm' }] : [];
    },
  },

  // ===== Blood Sultanate — invulnerable while any royal lives; re-summons the line =====
  royal_succession: {
    weakness: 'The royal line shields her. End the bloodline first…',
    battleCondition: { label: '🩸 Blood Throne — the Sultana gains +1 STR every turn the royals live!', bossBuff: true },
    onBossTurn(boss, eng) {
      // If the bloodline is wiped, a new heir steps up every other turn — keep the pressure on
      boss._heirTimer = (boss._heirTimer || 0) + 1;
      const royals = eng.board.enemy.some(e => e !== boss && e.royal);
      if (!royals && boss._heirTimer % 2 === 0 && eng.board.enemy.length < 8) {
        const heir = makeSwarmCard('Blood Naga Heir', { str: 5, con: 4, dex: 4, hp: 14, emoji: '🩸' });
        heir.royal = true; eng.board.enemy.push(heir);
        return [{ type: 'boss_mechanic', name: 'Line of Succession', text: '🩸 A new heir rises to shield the Sultana — kill them and BURST her!', fx: 'spawn' }];
      }
      return [];
    },
    modifyIncomingDamage(boss, dmg, ctx) {
      const royals = ctx.engine.board.enemy.some(e => e !== boss && e.royal);
      if (royals) return { dmg: 1, note: '👑 The royal guard shields the Sultana — slay the royals first!', fx: 'resist' };
      return { dmg: Math.round(dmg * 1.5), note: '🩸 The bloodline is broken — she\'s vulnerable!', fx: 'weak' };
    },
  },
};

function getBossMechanic(name) { return MECHANICS[name] || null; }

module.exports = { getBossMechanic, MECHANICS, makeSwarmCard };
