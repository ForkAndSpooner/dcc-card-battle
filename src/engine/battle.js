// Battle Engine v4 - Ported from playtest harness with full abilities
const { getAllCards } = require('../cards/library');
const mobData = require('../../data/mobs.json');
const itemData = require('../../data/items.json');
const { random: rng } = require('./rng');
const { getSponsor } = require('./sponsors');
const { getEvolvedForm } = require('./evolution');
const { getKeywords, getBattlecry, getDeathrattle } = require('./keywords');
const { rollLootBox, tierForFloor } = require('./progression');
const { calcFreeAttackDamage, getWeapon } = require('./weapons');
const { applyArmorReduction } = require('./armor');
const { applyStatus, hasStatus, tickStatuses, cleanseStatuses, getStatusList } = require('./status-effects');

const ABILITIES = {
  war_gauntlet:    { kind: 'skill', name: 'War Gauntlet',        cost: 1, type: 'physical', target: 'single', calc: (c) => 2 + c.str },
  wisp_armor:      { kind: 'spell', name: 'Wisp Armor',           cost: 4, type: 'shield',   target: 'self',   shield: 10, magicImmune: 1, cd: 4 },
  soul_reaper:     { kind: 'spell', name: 'Soul Reaper',          cost: 3, type: 'physical', target: 'single', calc: (c) => Math.floor(c.str * 2.5 * (1 + Math.min(c.killCount||0,5)*0.15)), lifesteal: true, cd: 3 },
  fear_spell:      { kind: 'spell', name: 'Fear',                 cost: 2, type: 'debuff',   target: 'single', stun: true, cd: 2 },
  laundry_day:     { kind: 'spell', name: 'Laundry Day',          cost: 3, type: 'debuff',   target: 'aoe',    calc: (c) => 0, cd: 3 },
  clockwork_triplicate: { kind: 'spell', name: 'Clockwork Triplicate', cost: 4, type: 'summon', target: 'self', cd: 4 },
  astral_paw:      { kind: 'spell', name: 'Astral Paw',           cost: 5, type: 'physical', target: 'aoe',    calc: (c) => 4 + c.cha, cd: 5 },
  pounce:          { kind: 'skill', name: 'Pounce',               cost: 2, type: 'physical', target: 'single', calc: (c) => 2 + c.str, finisher: true, cd: 1 },
  crossbow_burst:  { kind: 'skill', name: 'Nekhebit Crossbow Burst', cost: 2, type: 'physical', target: 'cleave', calc: (c) => 2 + c.dex, splash: (c) => Math.ceil(c.dex/2), cd: 1 },
  donut_kick:      { kind: 'skill', name: 'Donut Kick',           cost: 2, type: 'physical', target: 'single', calc: (c) => 3 + c.dex, stun: true, cd: 3 },
  wing_buff:       { kind: 'spell', name: 'Wing Blessing',        cost: 2, type: 'buff',     target: 'team',   buff: 2, stat: 'str', duration: 2, cd: 2 },
  crowd_blast:     { kind: 'spell', name: 'Crowd Blast',          cost: 3, type: 'physical', target: 'aoe',    calc: (c) => 3 + c.str * 2, cd: 2 },
  debuff_stack:    { kind: 'skill', name: 'Debuff Stack',         cost: 2, type: 'debuff',   target: 'single', reduceDmg: 3, duration: 3, cd: 0 },
  plushie_swarm:   { kind: 'spell', name: 'Plushie Swarm',        cost: 3, type: 'physical', target: 'aoe',    calc: (c) => 2 + c.dex * 2, cd: 3 },
  fastball_special: { kind: 'spell', name: 'Fastball Special',    cost: 3, type: 'fire',     target: 'aoe',    calc: (c) => 10, cd: 0, sacrifice: true },
  conscript_fly:   { kind: 'skill', name: 'Conscript & Fly',      cost: 5, type: 'skill',    target: 'single', effect: 'steal_enemy', sacrifice: true, cd: 0 },
  mordecai_brew:   { kind: 'skill', name: "Mordecai's Special Brew", cost: 4, type: 'self_buff', target: 'ally', invincible: 2, cd: 5 },
  ink_marauder:    { kind: 'spell', name: 'Ink Marauder',         cost: 4, type: 'physical', target: 'aoe',    calc: (c) => 2 + c.int, cd: 4 },
  chain_attack:    { kind: 'spell', name: 'Profane Iron Chains',  cost: 3, type: 'physical', target: 'aoe',    calc: (c) => 2 + c.dex, stun: true, cd: 2 },
  lightning_bolt_pet: { kind: 'spell', name: 'Lightning Bolt',    cost: 2, type: 'magic',    target: 'single', calc: (c) => 3 + c.int * 2, cd: 2 },
  cloud_of_exhaust: { kind: 'spell', name: 'Cloud of Exhaust',    cost: 3, type: 'debuff',   target: 'aoe',    stun: true, cd: 4 },
  graupel:         { kind: 'spell', name: 'Graupel',              cost: 6, type: 'magic',    target: 'aoe',    calc: (c) => 3 + c.int, cd: 7 },
  jug_o_boom:      { kind: 'spell', name: "Jug O'Boom",          cost: 3, type: 'fire',     target: 'cleave', calc: (c) => 3 + c.str, splash: () => 3, cd: 2 },
  protective_shell: { kind: 'spell', name: 'Protective Shell',    cost: 3, type: 'shield',   target: 'ally',   shield: 8, cd: 3 },
  magic_missile:   { kind: 'spell', name: 'Magic Missile',        cost: 2, type: 'magic',    target: 'cleave', calc: (c) => 2 + c.int, splash: (c) => Math.floor(c.int/2) },
  overcharge:      { kind: 'spell', name: 'Overcharged Missile',  cost: 3, type: 'magic',    target: 'overcharge', calc: (c) => 3 + c.int, extraDmgPct: 0.5, maxExtra: 2 },
  decree:          { kind: 'spell', name: "Princess's Decree",   cost: 4, type: 'buff',     target: 'team',   buff: 3, stat: 'str', duration: 2, cd: 4 },
  stomp:           { kind: 'skill', name: 'Stomp',                cost: 2, type: 'physical', target: 'aoe',    calc: (c) => 2 + c.str },
  smash:           { kind: 'skill', name: 'Mongo Smash',          cost: 2, type: 'physical', target: 'single', calc: (c) => 3 + c.str, stun: true },
  devour:          { kind: 'skill', name: 'Devour',               cost: 3, type: 'execute',  target: 'single', threshold: 0.3, heal: 8, cd: 3 },
  claw:            { kind: 'spell', name: 'Claw Swipe',           cost: 1, type: 'magic',    target: 'single', calc: (c) => 2 + c.int },
  tactical_analysis: { kind: 'skill', name: 'Tactical Analysis', cost: 2, type: 'debuff',   target: 'single', mark: true, cd: 2 },
  boon:            { kind: 'skill', name: "Manager's Boon",      cost: 3, type: 'buff',     target: 'team',   buff: 2, stat: 'str', duration: 2, cd: 3 },
  frenzy:          { kind: 'skill', name: 'Battle Frenzy',        cost: 2, type: 'physical', target: 'single', calc: (c) => 2 + c.str, multiHit: 2 },
  berserker_rage:  { kind: 'skill', name: 'Berserker Rage',       cost: 3, type: 'self_buff', target: 'self',  selfBuff: 3, selfDmg: 2, resetAction: true, cd: 4 },
  shield_bash:     { kind: 'skill', name: 'Shield Bash',          cost: 2, type: 'physical', target: 'single', calc: (c) => 2 + c.str, stun: true, cd: 1 },
  rally_cry:       { kind: 'skill', name: 'Rally Cry',            cost: 3, type: 'heal',     target: 'team',   healAmt: 5, cd: 3 },
  shoot:           { kind: 'skill', name: 'Shoot',                cost: 1, type: 'physical', target: 'single', calc: (c) => 2 + c.dex },
  suppress:        { kind: 'skill', name: 'Suppressing Fire',     cost: 2, type: 'debuff',   target: 'single', reduceDmg: 2, duration: 2, cd: 2 },
  hate_boner:      { kind: 'skill', name: 'Hate-Boner',           cost: 2, type: 'taunt',    target: 'self',   conBuff: 3, cd: 2 },
  backstab:        { kind: 'skill', name: 'Backstab',             cost: 2, type: 'physical', target: 'single', calc: (c) => 2 + c.dex, fullHpBonus: true },
  shadow_strike:   { kind: 'skill', name: 'Shadow Strike',        cost: 3, type: 'physical', target: 'single', calc: (c) => 3 + c.dex, fromStealth: true, cd: 2 },
  vanish:          { kind: 'spell', name: 'Vanish',               cost: 2, type: 'skill',    target: 'self',   hidden: true, cd: 3 },
  aria:            { kind: 'spell', name: 'Aria of Glory',        cost: 2, type: 'buff',     target: 'team',   buff: 2, stat: 'str', duration: 3, cd: 3 },
  high_c:          { kind: 'spell', name: 'High C',               cost: 3, type: 'magic',    target: 'aoe',    calc: (c) => 2 + c.int, cd: 2 },
  pirouette:       { kind: 'skill', name: 'Pirouette of Pain',    cost: 1, type: 'physical', target: 'single', calc: (c) => 2 + c.dex, dodgeBuff: true },
  final_bow:       { kind: 'skill', name: 'Final Bow',            cost: 4, type: 'physical', target: 'single', calc: (c) => 4 + c.dex, exhausts: true, cd: 4 },
  precision_strike: { kind: 'skill', name: 'Precision Strike',   cost: 2, type: 'physical', target: 'single', calc: (c) => 3 + c.dex, ignoreArmor: true },
  flying_kick:     { kind: 'skill', name: 'Flying Kick',          cost: 3, type: 'physical', target: 'single', calc: (c) => 3 + c.dex, stun: true, cd: 3 },
  double_strike:   { kind: 'skill', name: 'Double Strike',        cost: 3, type: 'physical', target: 'single', calc: (c) => 2 + c.str, multiHit: 2, cd: 1 },
  heal_touch:      { kind: 'spell', name: 'Healing Touch',        cost: 2, type: 'heal',     target: 'ally',   healAmt: 8, cd: 2 },
  group_heal:      { kind: 'spell', name: 'Group Heal',           cost: 4, type: 'heal',     target: 'team',   healAmt: 6, cd: 3 },
  field_surgery:   { kind: 'skill', name: 'Field Surgery',        cost: 3, type: 'heal',     target: 'ally',   healAmt: 4, cd: 2 },
  shield_wall:     { kind: 'spell', name: 'Shield Wall',          cost: 2, type: 'shield',   target: 'team',   shield: 4, cd: 3 },
  headshot:        { kind: 'skill', name: 'Headshot',             cost: 3, type: 'physical', target: 'single', calc: (c) => 3 + c.dex, executeBonus: true, cd: 2 },
  ambush:          { kind: 'skill', name: 'Ambush',               cost: 3, type: 'physical', target: 'single', calc: (c) => 4 + c.dex, fromStealth: true, cd: 3 },
  rage_strike:     { kind: 'skill', name: 'Rage Strike',          cost: 1, type: 'physical', target: 'single', calc: (c) => 2 + c.str, lowHpBonus: true },
  improvised_bomb: { kind: 'spell', name: 'Improvised Bomb',      cost: 3, type: 'fire',     target: 'aoe',    calc: (c) => 2 + c.int, cd: 2 },
  ping:            { kind: 'spell', name: 'Ping',                 cost: 1, type: 'skill',    target: 'single', mark: true },
  confuse:         { kind: 'spell', name: 'Confuse',              cost: 2, type: 'debuff',   target: 'single', stun: true, cd: 2 },
};

function hp(con) { return 10 + con * 3; }
function dr(con) { return con * 0.015; }
function applyDR(dmg, targetCon) { return Math.max(1, Math.round(dmg * (1 - dr(targetCon)))); }

// Damage with type checking against target resistances
function applyTypedDamage(dmg, target, damageType) {
  let d = applyDR(dmg, target.con);
  if (target.resistances && target.resistances.includes(damageType)) d = Math.floor(d * 0.5);
  if (target.damageReduction) d = Math.floor(d * (1 - target.damageReduction / 100));
  if (target.invincible) return 0;
  return Math.max(1, d);
}

// Fire procs on a card when trigger occurs
function fireProcs(card, trigger, context) {
  if (!card.procs || !card.procs.length) return [];
  const results = [];
  for (const proc of card.procs) {
    if (proc.trigger !== trigger) continue;
    if (rng() > (proc.chance || 1.0)) continue;
    results.push(proc);
  }
  return results;
}

// Critical hit: DEX/300 base chance (capped 25%), 1.75x damage on crit
function rollCrit(attackerDex) {
  // 1-10 scale: DEX 10 = ~25% crit, DEX 5 = ~12%, DEX 1 = ~2.5%
  const chance = Math.min(0.30, (attackerDex || 3) * 0.025);
  return rng() < chance;
}
function applyCrit(dmg, attackerDex) {
  if (rollCrit(attackerDex)) return { dmg: Math.round(dmg * 1.75), crit: true };
  return { dmg, crit: false };
}

// Map library cards to v4 stat format
const STAT_MAP = {
  // ===== STAT MAP — Book-accurate, floor-depth balanced =====
  // Floor 12 survivors (cap 300)
  carl: { str: 3, int: 2, con: 3, dex: 2, cha: 2, cost: 3,
    abilities: ['war_gauntlet', 'jug_o_boom', 'wisp_armor', 'soul_reaper', 'fear_spell'],
    passive: 'mind_balance' },
  donut: { str: 1, int: 8, con: 2, dex: 3, cha: 10, cost: 4,
    abilities: ['magic_missile', 'laundry_day', 'decree', 'clockwork_triplicate', 'astral_paw'],
    passive: 'cockroach' },
  mongo: { str: 5, int: 1, con: 4, dex: 4, cha: 1, cost: 4,
    abilities: ['pounce', 'stomp', 'devour'], passive: 'mascot' },
  mordecai: { str: 1, int: 7, con: 2, dex: 2, cha: 3, cost: 3,
    abilities: ['tactical_analysis', 'boon', 'field_surgery'], passive: 'edge' },
  // Floor 9 exits (cap 250)
  katia: { str: 4, int: 2, con: 3, dex: 4, cha: 2, cost: 3,
    abilities: ['crowd_blast', 'backstab', 'vanish'], passive: 'doppelganger' },
  bautista: { str: 3, int: 2, con: 3, dex: 4, cha: 3, cost: 3,
    abilities: ['shoot', 'plushie_swarm', 'suppress'], passive: null },
  louis: { str: 2, int: 3, con: 3, dex: 2, cha: 3, cost: 3,
    abilities: ['cloud_of_exhaust', 'stomp', 'rally_cry'], passive: null },
  florin: { str: 3, int: 2, con: 3, dex: 3, cha: 2, cost: 3,
    abilities: ['shoot', 'suppress', 'headshot'], passive: null },
  li_jun: { str: 4, int: 1, con: 2, dex: 6, cha: 2, cost: 3,
    abilities: ['precision_strike', 'flying_kick', 'double_strike'], passive: 'bullet_time' },
  li_na: { str: 1, int: 8, con: 3, dex: 8, cha: 3, cost: 5,
    abilities: ['chain_attack', 'magic_missile', 'confuse'], passive: 'dread_aura' },
  prepotente: { str: 2, int: 7, con: 2, dex: 2, cha: 5, cost: 4,
    abilities: ['debuff_stack', 'aria', 'confuse'], passive: 'genius' },
  // Floor 8 exits (cap 200)
  signet: { str: 2, int: 5, con: 2, dex: 2, cha: 3, cost: 3,
    abilities: ['ink_marauder', 'magic_missile', 'boon'], passive: null },
  ferdinand: { str: 2, int: 3, con: 3, dex: 4, cha: 2, cost: 3,
    abilities: ['lightning_bolt_pet', 'vanish', 'shadow_strike'], passive: 'cat_instincts' },
  tran: { str: 3, int: 2, con: 2, dex: 5, cha: 1, cost: 3,
    abilities: ['ambush', 'backstab', 'vanish'], passive: null },
  // Floor 6 exits (cap 160)
  miriam: { str: 1, int: 3, con: 3, dex: 2, cha: 4, cost: 3,
    abilities: ['field_surgery', 'group_heal', 'mordecai_brew'], passive: 'vampire_princess' },
  miriam_dom: { str: 1, int: 3, con: 3, dex: 2, cha: 4, cost: 3,
    abilities: ['field_surgery', 'group_heal', 'heal_touch'], passive: 'shepherd' },
  chris_andrews: { str: 4, int: 1, con: 5, dex: 3, cha: 1, cost: 3,
    abilities: ['stomp', 'smash', 'suppress'], passive: 'igneous' },
  // Floor 5 exits (cap 140)
  hekla: { str: 4, int: 1, con: 3, dex: 4, cha: 2, cost: 3,
    abilities: ['crossbow_burst', 'donut_kick', 'berserker_rage'], passive: 'defiant' },
  imani: { str: 3, int: 3, con: 4, dex: 2, cha: 4, cost: 3,
    abilities: ['wing_buff', 'shield_bash', 'rally_cry'], passive: 'butterfly_aura' },
  // Floor 3 exits (cap 100)
  brandon: { str: 2, int: 1, con: 3, dex: 2, cha: 1, cost: 2,
    abilities: ['shield_bash', 'frenzy'], passive: null },
  // Supporting cast (varied)
  odette: { str: 3, int: 3, con: 2, dex: 5, cha: 2, cost: 3,
    abilities: ['pirouette', 'final_bow'], passive: null },
  // All remaining characters (floor 9 range unless noted)
  louis: { str: 2, int: 3, con: 3, dex: 2, cha: 3, cost: 3, abilities: ['cloud_of_exhaust', 'stomp', 'rally_cry'], passive: null },
  florin: { str: 3, int: 2, con: 3, dex: 3, cha: 2, cost: 3, abilities: ['shoot', 'suppress', 'headshot'], passive: null },
  signet: { str: 2, int: 5, con: 2, dex: 2, cha: 3, cost: 4, abilities: ['ink_marauder', 'magic_missile', 'boon'], passive: null },
  langley: { str: 2, int: 2, con: 3, dex: 3, cha: 2, cost: 3, abilities: ['shoot', 'ambush', 'suppress'], passive: null },
  yolanda: { str: 2, int: 3, con: 2, dex: 3, cha: 2, cost: 2, abilities: ['backstab', 'precision_strike', 'heal_touch'], passive: null },
  lucia_mar: { str: 3, int: 5, con: 3, dex: 4, cha: 2, cost: 3, abilities: ['magic_missile', 'stomp', 'confuse'], passive: 'rubber_reflect' },
  borant_exec: { str: 1, int: 3, con: 2, dex: 1, cha: 4, cost: 2, abilities: ['boon', 'aria'], passive: null },
  maestro: { str: 1, int: 3, con: 2, dex: 2, cha: 4, cost: 3, abilities: ['aria', 'high_c', 'heal_touch'], passive: null },
  changeling_carl: { str: 3, int: 2, con: 3, dex: 3, cha: 2, cost: 3, abilities: ['war_gauntlet', 'vanish', 'frenzy'], passive: 'cockroach' },
  changeling_donut: { str: 1, int: 4, con: 2, dex: 3, cha: 5, cost: 4, abilities: ['magic_missile', 'overcharge', 'decree'], passive: 'narcissism' },
  brutus: { str: 4, int: 1, con: 4, dex: 2, cha: 1, cost: 4, abilities: ['stomp', 'smash', 'berserker_rage'], passive: null },
  hellhound: { str: 3, int: 1, con: 2, dex: 3, cha: 1, cost: 2, abilities: ['frenzy', 'precision_strike'], passive: null },
  zev: { str: 2, int: 3, con: 2, dex: 3, cha: 2, cost: 2, abilities: ['shoot', 'tactical_analysis'], passive: null },
  ferdinand: { str: 2, int: 3, con: 3, dex: 4, cha: 2, cost: 3, abilities: ['lightning_bolt_pet', 'vanish', 'shadow_strike'], passive: 'cat_instincts' },
  esther: { str: 2, int: 2, con: 2, dex: 3, cha: 2, cost: 2, abilities: ['shoot', 'backstab'], passive: null },
  fenwick: { str: 1, int: 3, con: 2, dex: 2, cha: 3, cost: 3, abilities: ['magic_missile', 'tactical_analysis', 'boon'], passive: null },
  vex: { str: 3, int: 2, con: 2, dex: 3, cha: 1, cost: 3, abilities: ['precision_strike', 'flying_kick', 'vanish'], passive: null },
  silas: { str: 2, int: 2, con: 3, dex: 2, cha: 2, cost: 3, abilities: ['shield_bash', 'rally_cry', 'frenzy'], passive: null },
  shrieker: { str: 2, int: 1, con: 1, dex: 4, cha: 1, cost: 1, abilities: ['precision_strike'], passive: null },
  the_warden: { str: 3, int: 2, con: 4, dex: 2, cha: 2, cost: 4, abilities: ['shield_bash', 'shield_wall', 'rally_cry'], passive: null },
  echo: { str: 2, int: 3, con: 2, dex: 3, cha: 2, cost: 2, abilities: ['magic_missile', 'vanish'], passive: null },
  samantha: { str: 1, int: 7, con: 10, dex: 3, cha: 2, cost: 2, abilities: ['fastball_special', 'conscript_fly'], passive: 'indestructible' },
  elle: { str: 2, int: 5, con: 2, dex: 2, cha: 3, cost: 3, abilities: ['improvised_bomb', 'magic_missile', 'graupel'], passive: 'frost_maiden' },
  britney: { str: 3, int: 1, con: 3, dex: 2, cha: 2, cost: 3, abilities: ['rage_strike', 'berserker_rage', 'frenzy'], passive: null },
  li_jun: { str: 4, int: 1, con: 2, dex: 6, cha: 2, cost: 3, abilities: ['precision_strike', 'flying_kick', 'double_strike'], passive: 'bullet_time' },
  li_na: { str: 1, int: 8, con: 3, dex: 8, cha: 3, cost: 5, abilities: ['chain_attack', 'magic_missile', 'confuse'], passive: 'dread_aura' },
  popov_twins: { str: 5, int: 1, con: 4, dex: 2, cha: 1, cost: 4, abilities: ['double_strike', 'stomp', 'frenzy'], passive: 'resurrection_split' },
  miriam_dom: { str: 1, int: 3, con: 3, dex: 2, cha: 4, cost: 3, abilities: ['field_surgery', 'group_heal', 'heal_touch'], passive: 'shepherd' },
  chris_andrews: { str: 4, int: 1, con: 5, dex: 3, cha: 1, cost: 4, abilities: ['stomp', 'smash', 'suppress'], passive: 'igneous' },
  tran: { str: 3, int: 2, con: 2, dex: 5, cha: 1, cost: 3, abilities: ['ambush', 'backstab', 'vanish'], passive: null },
};

class BattleEngine {
  constructor({ playerDeck, floor = 1, sponsorId = 'borant', environment = null, battleType = 'normal' }) {
    this.floor = floor;
    this.environment = environment;
    this.turn = 0;
    this.mana = 4;
    this.maxMana = 4;
    this.playerHP = 20 + floor * 5;
    this.board = { player: [], enemy: [] };
    this.hand = { player: [], enemy: [] };
    this.deck = { player: [], enemy: [] };
    this.graveyard = [];
    this.winner = null;
    this.log = [];
    this.buffs = [];
    this.marks = [];
    this.shields = [];
    this.dots = [];
    this.currentTurn = 'player';
    this.pendingLoot = [];
    this.battleInventory = []; // items available to use as free actions this battle
    this.godZone = null; // active god card (one at a time)
    // Sponsor system
    const { getSponsor } = require('./sponsors');
    this.sponsor = getSponsor(sponsorId);
    this.favor = 0;
    this.instability = 0;

    // Build player deck
    this.deck.player = shuffle(playerDeck.map(c => this.makePlayerCard(c)));

    // PROTAGONIST SYSTEM: Carl always starts on the board (never in hand/deck).
    // Carl or Donut (player HP) dying = Game Over.
    const carlIdx = this.deck.player.findIndex(c => c.id === 'carl');
    if (carlIdx >= 0) {
      const carl = this.deck.player.splice(carlIdx, 1)[0];
      carl.isProtagonist = true;
      carl.crawlersGritUsed = false; // one-time survive-lethal
      this.board.player.push(carl);
    }
    // Build loot deck (10 loot-box cards of varying tiers)
    this.deck.loot = this.buildLootDeck();
    // Build enemy deck
    this.battleType = battleType;
    this.deck.enemy = battleType === 'boss' ? this.buildBossDeck(floor) : shuffle(this.buildEnemyDeck(floor));
    // Draw initial hands (4 char each)
    for (let i = 0; i < 4; i++) { this.draw('player'); this.draw('enemy'); }
    // Pre-stage enemies on the board so the player faces pressure immediately (non-boss only).
    // Hordes shouldn't start empty — deploy a small opening wave (scales slightly with floor).
    if (battleType !== 'boss') {
      const opening = Math.min(this.hand.enemy.length, 2 + Math.floor(floor / 3)); // 2 on floor 1-2, 3 on 3-5, ...
      for (let i = 0; i < opening; i++) {
        const c = this.hand.enemy.shift();
        if (!c) break;
        c.cd = c.cd || {};
        this.board.enemy.push(c);
      }
      this.draw('enemy'); this.draw('enemy'); // refill some so next turn keeps pressure
    }
  }

  makePlayerCard(card) {
    const { getEvolvedForm } = require('./evolution');
    // If card has evolved, use evolved form's stats instead
    const evolvedForm = card.evolvedTo ? getEvolvedForm(card.evolvedTo) : null;
    const stats = evolvedForm || STAT_MAP[card.id] || { str: 5, int: 4, con: 5, dex: 5, cha: 4, abilities: ['crowbar_strike'], passive: null };
    const level = card.level || 1;
    // Each level adds +10 to STR and INT, +20 to CON (HP)
    const lvlBonus = (level - 1);
    const str = stats.str + lvlBonus;
    const int = stats.int + lvlBonus;
    let con = stats.con + lvlBonus * 2;
    // GlubGlub CON aura
    if (this.sponsor?.passive?.type === 'con_aura') con += this.sponsor.passive.value;
    // Equipped gear bonuses (supports: weapon, armor, accessory, mount, patch)
    let eqStr = 0, eqInt = 0, eqCon = 0, eqDex = 0;
    const resistances = [];
    const procs = [];
    if (card.equipped) {
      for (const slot of Object.values(card.equipped)) {
        if (!slot) continue;
        if (slot.stats) { eqStr += slot.stats.str || 0; eqInt += slot.stats.int || 0; eqCon += slot.stats.con || 0; eqDex += slot.stats.dex || 0; }
        if (slot.statBonus) { eqStr += slot.statBonus.str || 0; eqInt += slot.statBonus.int || 0; eqCon += slot.statBonus.con || 0; }
        if (slot.resistances) resistances.push(...slot.resistances);
        if (slot.procs) procs.push(...slot.procs);
      }
    }
    const finalStr = str + eqStr, finalInt = int + eqInt, finalCon = con + eqCon;
    const { getKeywords } = require('./keywords');
    return {
      ...card, ...stats, str: finalStr, int: finalInt, con: finalCon, dex: (stats.dex || 50) + eqDex, baseStr: finalStr, baseInt: finalInt, baseCon: finalCon, level,
      currentHP: hp(finalCon), maxHP: hp(finalCon),
      cd: {}, killCount: 0, stunned: false, doubleDmg: false, cockroachUsed: false,
      instanceId: card.instanceId || crypto.randomUUID(), canAttack: true,
      lootBoxes: [], equipped: card.equipped,
      resistances, procs,
      keywords: getKeywords(card.id),
    };
  }

  buildBossDeck(floor) {
    const { getBossForFloor, makeBossCard, makeMinionCard } = require('./bosses');
    const bossEntry = getBossForFloor(floor);
    if (!bossEntry) return shuffle(this.buildEnemyDeck(floor)); // fallback
    const [bossId, bossData] = bossEntry;
    this.bossData = bossData;
    // Store battle condition from boss mechanic (AoE nerf, board cap, etc.)
    const { getBossMechanic } = require('./boss-mechanics');
    const mech = getBossMechanic(bossData.mechanic);
    this.bossCondition = mech?.battleCondition || null;
    const deck = [];
    // Minions deploy first (in hand), boss is the centerpiece
    for (const minionName of bossData.minions) {
      const m = makeMinionCard(minionName, floor);
      // Tag minions for boss mechanics that key off minion type
      if (/naga|prince|princess|vizier|sultan/i.test(minionName)) m.royal = true;
      if (/creeper/i.test(minionName)) m.creeper = true;
      deck.push(m);
    }
    const bossCard = makeBossCard(bossId);
    deck.push(bossCard);
    return deck;
  }

  buildEnemyDeck(floor) {
    // Syndicate/special floors: 3, 6, 9, 12
    if (floor === 3 || floor === 6 || floor === 9 || floor === 12) {
      const { getSyndicateEnemies, makeEnemyCard } = require('./syndicate');
      const data = getSyndicateEnemies(floor);
      const deck = [];
      // Helper: weighted pick — 70% preferred, 30% any pool item
      const weightedPick = (pool, preferred) => {
        if (preferred?.length && rng() < 0.7) {
          const pref = pool.filter(t => preferred.includes(t.name));
          if (pref.length) return pref[Math.floor(rng() * pref.length)];
        }
        return pool[Math.floor(rng() * pool.length)];
      };
      const preferred = this.environment?.preferred || [];
      if (floor === 3) {
        // Floor 3: 3 mobs, 1 elite, 1 boss
        for (let i = 0; i < 3; i++) {
          const t = weightedPick(data.mobs, preferred);
          const card = makeEnemyCard(t, floor); card.id = 'mob_' + i; card.instanceId = crypto.randomUUID(); card.cd = {}; card.emoji = '👹';
          deck.push(card);
        }
        const elite = weightedPick(data.elites, preferred);
        const eliteCard = makeEnemyCard(elite, floor); eliteCard.id = 'elite_0'; eliteCard.instanceId = crypto.randomUUID(); eliteCard.cd = {}; eliteCard.emoji = '⭐'; eliteCard.isElite = true;
        deck.push(eliteCard);
        const bossCard = makeEnemyCard(data.boss, floor); bossCard.id = 'boss_scolopendra'; bossCard.instanceId = crypto.randomUUID(); bossCard.cd = {}; bossCard.emoji = '💀';
        deck.push(bossCard);
      } else {
        const templates = Array.isArray(data) ? data : data.mobs || [];
        const count = floor === 12 ? 3 : floor === 9 ? 5 : 6; // bigger waves so deep floors aren't over in 4 rounds
        for (let i = 0; i < count; i++) {
          const t = weightedPick(templates, preferred);
          const card = makeEnemyCard(t, floor); card.id = t.name.toLowerCase().replace(/\s/g, '_') + '_' + i; card.instanceId = crypto.randomUUID(); card.cd = {};
          card.emoji = floor === 12 ? '👑' : floor === 9 ? '⚔️' : '🎯';
          deck.push(card);
        }
      }
      return deck;
    }
    const mobs = mobData.mobs.filter(m => m.floor <= floor + 1);
    const bosses = mobData.bosses.filter(b => b.floor <= floor);
    const deck = [];
    const mobCount = 8 + Math.floor(floor / 2); // bigger hordes — enemy fields up to 8 at once
    for (let i = 0; i < mobCount; i++) {
      const m = mobs[Math.floor(rng() * mobs.length)];
      const con = Math.max(2, m.health + Math.floor(floor / 3) + 1); // +1 baseline so floor-1 mobs aren't 1-hit
      const str = Math.max(1, m.attack + Math.floor(floor / 3));
      deck.push({ id: m.name.toLowerCase().replace(/\s/g, '_') + i, name: m.name, str, int: 1, con, dex: 2, cost: Math.max(1, Math.ceil(str / 3)), emoji: '👹', currentHP: hp(con), maxHP: hp(con), cd: {}, instanceId: crypto.randomUUID() });
    }
    if (bosses.length) {
      const b = bosses[Math.floor(rng() * bosses.length)];
      const con = Math.max(2, b.health + Math.floor(floor / 2));
      const str = Math.max(2, b.attack + Math.floor(floor / 2));
      deck.push({ id: 'boss_' + b.name.toLowerCase().replace(/\s/g, '_'), name: b.name, str, int: 2, con, dex: 3, cost: 5, emoji: '💀', currentHP: hp(con), maxHP: hp(con), cd: {}, instanceId: crypto.randomUUID(), isBoss: true });
    }
    return deck;
  }

  buildLootDeck() {
    // 10 loot-box cards; tier weighted toward floor
    const tiers = ['bronze', 'bronze', 'silver', 'silver', 'silver', 'gold', 'gold', 'platinum'];
    const deck = [];
    for (let i = 0; i < 10; i++) {
      const tier = tiers[Math.floor(rng() * tiers.length)];
      deck.push({ id: 'lootcard_' + i, name: tier.charAt(0).toUpperCase() + tier.slice(1) + ' Loot Box', isLootCard: true, tier, cost: 2, emoji: '📦', instanceId: crypto.randomUUID() });
    }
    return shuffle(deck);
  }

  draw(side, deckType = 'player') {
    const targetDeck = side === 'player' && deckType === 'loot' ? this.deck.loot : this.deck[side];
    if (targetDeck && targetDeck.length > 0 && this.hand[side].length < 8) {
      this.hand[side].push(targetDeck.pop());
    }
  }

  startTurn() {
    // Safety: check if game should already be over
    if (this.playerHP <= 0 && !this.winner) this.winner = 'enemy';
    if (this.winner) return;
    this.turn++;
    this.maxMana = Math.min(10, this.maxMana + (this.turn > 1 ? 1 : 0));
    this.mana = this.maxMana;
    // INT bonus mana
    const intBonus = this.board.player.reduce((s, c) => s + Math.floor((c.int || 0) / 100), 0);
    this.mana = Math.min(10, this.mana + intBonus);
    // Sponsor turn-start passive
    if (this.sponsor?.passive?.type === 'mana_regen') this.mana = Math.min(10, this.mana + this.sponsor.passive.value);
    // Instability grows each turn
    this.instability++;
    // Reduce CDs + reset per-turn tracking
    for (const c of this.board.player) {
      for (const k of Object.keys(c.cd)) { if (c.cd[k] > 0) c.cd[k]--; }
      c.usedThisTurn = new Set(); // reset each turn
      c.usedFreeAction = false;   // reset free action
    }
    // Tick DoTs
    for (const d of [...this.dots]) { if (d.target.currentHP > 0) d.target.currentHP -= d.dmg; d.turnsLeft--; }
    this.dots = this.dots.filter(d => d.turnsLeft > 0);
    this.cleanupDead();
    // Tick god zone (turn countdown, chaos reveal)
    this.lastGodEffects = this.tickGodZone();
    // Tick buffs
    for (const b of this.buffs) { b.turnsLeft--; if (b.turnsLeft <= 0) b.target[b.stat] -= b.amount; }
    this.buffs = this.buffs.filter(b => b.turnsLeft > 0);
    // Clean dead from DoTs
    this.board.enemy = this.board.enemy.filter(c => c.currentHP > 0);
    this.currentTurn = 'player';
    this.heroPowerUsed = false;
    this.donutMissileUsed = false;
    if (this.donutLaundryCd > 0) this.donutLaundryCd--;
    // Tick status effects on all player cards
    this.statusMessages = [];
    for (const c of this.board.player) {
      const msgs = tickStatuses(c, this);
      if (msgs.length) this.statusMessages.push(...msgs);
    }
    this.board.player = this.board.player.filter(c => {
      if (c.currentHP > 0 || c.indestructible) return true;
      // Protagonist death check — Carl's Grit saves once, second time = Game Over
      if (c.isProtagonist && !c.crawlersGritUsed) {
        c.crawlersGritUsed = true; c.currentHP = 1;
        this.statusMessages.push(`⚡ CRAWLER'S GRIT — ${c.name} survives at 1 HP!`);
        return true;
      }
      if (c.isProtagonist) { this.winner = 'enemy'; this.protagonistFell = c.name; }
      this.graveyard.push(c);
      return false;
    });
    // Reset per-turn action economy
    for (const c of this.board.player) { c.usedAction = !!c.swallowed; c.usedFreeAction = !!c.swallowed; }
    // Expire summoned plushies
    this.board.player = this.board.player.filter(c => {
      if (c.summoned && c.turnsLeft !== undefined) { c.turnsLeft--; return c.turnsLeft > 0; }
      return true;
    });
    this.pendingDraw = true; // player must choose which deck to draw from
  }

  chooseDraw(deckType) {
    if (!this.pendingDraw) return { ok: false, err: 'No draw available' };
    // If chosen deck is empty, auto-switch to the other
    let deck = deckType === 'loot' ? 'loot' : 'player';
    const targetDeck = deck === 'loot' ? this.deck.loot : this.deck.player;
    if (!targetDeck || targetDeck.length === 0) {
      deck = deck === 'loot' ? 'player' : 'loot';
      const fallback = deck === 'loot' ? this.deck.loot : this.deck.player;
      if (!fallback || fallback.length === 0) { this.pendingDraw = false; return { ok: true, empty: true }; }
    }
    this.draw('player', deck);
    this.pendingDraw = false;
    return { ok: true };
  }

  playCard(idx) {
    const card = this.hand.player[idx];
    if (!card || card.cost > this.mana) return { ok: false, err: `Not enough mana (need ${card?.cost || '?'}, have ${this.mana})` };

    if (card.isLootCard) {
      this.mana -= card.cost;
      this.hand.player.splice(idx, 1);
      const { rollLootBox } = require('./progression');
      const box = rollLootBox(card.tier);
      // Items go to inventory — player uses them via free action
      if (!this.battleInventory) this.battleInventory = [];
      for (const item of box.items) this.battleInventory.push(item);
      const applied = box.items.map(i => i.name + ' added to inventory');
      this.log.push({ type: 'loot_played', box: box.boxName, applied });
      return { ok: true, lootCard: true, box, applied };
    }

    // Boss condition: board cap (some bosses restrict how many cards you can field)
    const maxBoard = this.bossCondition?.boardCap || 5;
    if (this.board.player.length >= maxBoard) return { ok: false, err: `Board full! (boss condition limits you to ${maxBoard} cards)` };
    this.mana -= card.cost;
    this.hand.player.splice(idx, 1);
    this.board.player.push(card);
    this.log.push({ type: 'play', card: card.name });
    // Battlecry trigger
    const battlecryEffects = this.triggerBattlecry(card);
    return { ok: true, card, battlecry: battlecryEffects };
  }
  // Free action — one per card per turn, no mana cost
  // Available if card hasn't used a mana ability this turn (or even if they have — it's always available)
  useFreeAction(cardIdx, action, targetIdx = 0, itemIdx = null, extra = {}) {
    // Player-level free actions aren't tied to a specific card's action economy
    const PLAYER_LEVEL = ['craft', 'open_loot'];
    const card = this.board.player[cardIdx] || this.board.player[0];
    if (!PLAYER_LEVEL.includes(action)) {
      if (!card) return { ok: false, err: 'No card at that position' };
      if (card.usedFreeAction) return { ok: false, err: `${card.name} already used their free action this turn` };
    }
    const effects = [];

    switch (action) {
      case 'stack': { // weapon-based free attack
        const tgt = this.board.enemy[targetIdx];
        if (!tgt) return { ok: false, err: 'No target' };
        const { calcFreeAttackDamage } = require('./weapons');
        const weapon = card.equippedWeapon || null;
        const baseDmg = calcFreeAttackDamage(card, weapon, this);
        // DEX accuracy check (1-10 scale)
        const hitChance = Math.min(0.98, 0.82 + (card.dex || 3) * 0.02);
        if (rng() > hitChance) { effects.push({ miss: card.name }); break; }
        const actual = applyDR(baseDmg, tgt.con);
        tgt.currentHP -= actual;
        effects.push({ target: tgt.name, dmg: actual, weapon: weapon?.name || 'fist' });
        // Fire on_hit procs from equipped items
        const hitProcs = fireProcs(card, 'on_hit');
        for (const p of hitProcs) {
          if (p.effect === 'stun' && !tgt.stunned) { tgt.stunned = true; effects.push({ proc: p.effect, target: tgt.name }); }
          if (p.effect === 'poison') { this.dots.push({ target: tgt, dmg: 8, turnsLeft: 3 }); effects.push({ proc: 'poisoned', target: tgt.name }); }
          if (p.effect === 'lifesteal') { card.currentHP = Math.min(card.maxHP, card.currentHP + (p.value || 10)); }
          if (p.effect === 'bonked') { tgt.str = Math.max(0, (tgt.str || 30) - 15); effects.push({ proc: 'bonked', target: tgt.name }); }
          if (p.effect === 'burn') { this.dots.push({ target: tgt, dmg: 6, turnsLeft: p.duration || 3 }); effects.push({ proc: 'burning', target: tgt.name }); }
        }
        if (tgt.currentHP <= 0) this.killEnemy(tgt, card, { effects });
        // Fire on_kill procs
        if (tgt.currentHP <= 0) {
          const killProcs = fireProcs(card, 'on_kill');
          for (const p of killProcs) {
            if (p.effect === 'damage_stack') { card.str += Math.floor(p.value || 1); }
            if (p.effect === 'gold_burst') { effects.push({ proc: 'gold_burst' }); }
          }
        }
        // Weapon specials
        if (weapon?.freeAttack?.special === 'stun' && rng() < (weapon.freeAttack.stunChance || 0.3)) {
          tgt.stunned = true; effects.push({ stunned: tgt.name });
        }
        if (weapon?.freeAttack?.special === 'confuse' && rng() < (weapon.freeAttack.confuseChance || 0.2)) {
          effects.push({ confused: tgt.name });
        }
        if (weapon?.freeAttack?.special === 'poison_dot') {
          this.dots.push({ target: tgt, dmg: weapon.freeAttack.dotDmg || 10, turnsLeft: weapon.freeAttack.dotTurns || 3 });
          effects.push({ poisoned: tgt.name });
        }
        if (weapon?.freeAttack?.special === 'multi_hit' && this.board.enemy.length > 0) {
          // Second hit at same target
          const dmg2 = applyDR(Math.floor(baseDmg * 0.6), tgt.con);
          if (tgt.currentHP > 0) { tgt.currentHP -= dmg2; effects.push({ target: tgt.name, dmg: dmg2, extra: true }); }
        }
        // Weapon break chance
        if (weapon?.freeAttack?.breakChance && rng() < weapon.freeAttack.breakChance) {
          card.equippedWeapon = null; effects.push({ broken: weapon.name });
        }
        break;
      }
      case 'return': { // return to hand — free tactical retreat
        const idx = this.board.player.indexOf(card);
        if (idx < 0) return { ok: false, err: 'Card not on board' };
        this.board.player.splice(idx, 1);
        this.hand.player.push(card);
        card.usedThisTurn = new Set();
        effects.push({ returned: card.name });
        break;
      }
      case 'open_loot': { // open one pending kill loot box — items go to inventory
        if (!this.pendingLoot?.length) return { ok: false, err: 'No pending loot boxes' };
        const box = this.pendingLoot.shift();
        if (!this.battleInventory) this.battleInventory = [];
        // Discover: roll 3 choices, let player pick 1
        const { rollLootBox } = require('./progression');
        const extras1 = rollLootBox(box.tier || 'silver');
        const extras2 = rollLootBox(box.tier || 'silver');
        const allChoices = [...(box.items || []), ...(extras1.items || []), ...(extras2.items || [])];
        // Deduplicate by name, take 3
        const seen = new Set();
        const choices = allChoices.filter(i => { if (seen.has(i.name)) return false; seen.add(i.name); return true; }).slice(0, 3);
        if (choices.length <= 1) {
          // Fallback: just give the item
          for (const item of (box.items || [])) this.battleInventory.push(item);
          effects.push({ loot: box.boxName, items: (box.items||[]).map(i=>i.name) });
        } else {
          // Return choices for player to pick
          this.pendingDiscover = { boxName: box.boxName, choices };
          effects.push({ discover: true, boxName: box.boxName, choices });
        }
        break;
      }
      case 'use_item': { // use an item from the battle inventory
        if (!this.battleInventory?.length) return { ok: false, err: 'No items in inventory' };
        const item = itemIdx != null ? this.battleInventory[itemIdx] : this.battleInventory[0];
        if (!item) return { ok: false, err: 'No such item' };
        // Sapient weapons & living toys/dolls deploy as a special board card (not equipped)
        const isLivingThing = item.sapient || /doll|plushie|jefferson|mongo|dolores|toy|puppet/i.test(item.name || '');
        if (isLivingThing && (item.sapient || item.slot === 'plushie' || /jefferson|dolores|doll|puppet/i.test(item.name || ''))) {
          if (this.board.player.length >= 5) {
            return { ok: false, err: `Board is full — free a slot before deploying ${item.name}` };
          }
          this.battleInventory = this.battleInventory.filter((_, i) => i !== (itemIdx ?? 0));
          const s = item.stats || {};
          const weaponEntity = {
            id: 'sentient_' + (item.name || 'thing').toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            name: item.name, str: s.str || 5, int: s.int || 2, con: s.con || 3, dex: s.dex || 4,
            currentHP: 1, maxHP: 1, cd: {}, instanceId: require('crypto').randomUUID(),
            isSentient: true, indestructible: item.rarity === 'legendary' || item.rarity === 'celestial',
            abilities: ['war_gauntlet'], procs: item.procs || [], killCount: 0, emoji: '🗡️',
          };
          this.board.player.push(weaponEntity);
          effects.push({ deployed: item.name, sentient: true });
          break;
        }
        this.battleInventory = this.battleInventory.filter((_, i) => i !== (itemIdx ?? 0));
        // Check if it's a weapon — equip it instead of consuming
        const { getWeapon } = require('./weapons');
        const weaponDef = getWeapon(item.weaponId || item.name?.toLowerCase().replace(/[^a-z_]/g, '_'));
        if (weaponDef || item.slot === 'weapon') {
          // Equip: return old weapon to inventory if present
          if (card.equippedWeapon) this.battleInventory.push({ name: card.equippedWeapon.name, slot: 'weapon', weaponId: card.equippedWeapon.id });
          card.equippedWeapon = weaponDef || { name: item.name, id: item.name, freeAttack: { baseDamage: (item.statBonus?.str || 15), damageType: 'physical', scaling: 'str', scaleFactor: 6, special: null } };
          effects.push({ equipped: item.name, to: card.name });
          // First equip also fires the attack immediately if there's an enemy
          if (this.board.enemy.length > 0) {
            const { calcFreeAttackDamage } = require('./weapons');
            const tgt = this.board.enemy[targetIdx] || this.board.enemy[0];
            const dmg = applyDR(calcFreeAttackDamage(card, card.equippedWeapon, this), tgt.con);
            tgt.currentHP -= dmg;
            effects.push({ target: tgt.name, dmg, firstStrike: true });
            if (tgt.currentHP <= 0) this.killEnemy(tgt, card, { effects });
          }
          break;
        }
        // Otherwise consume the item (potions, bombs, scrolls)
        // CANON: Constitution governs potion frequency. Low CON = Potion Sickness if you chain potions.
        const isPotion = /potion|elixir|tonic|draught|hoop cola|mana toast|healing|drink/i.test(item.name || '');
        let potionSick = false;
        if (isPotion) {
          const gap = Math.max(0, 3 - Math.floor((card.con || 1) / 3)); // CON 9+ => 0, CON 3 => 2, CON 1 => 3
          if (card.lastPotionTurn != null && (this.turn - card.lastPotionTurn) <= gap) {
            potionSick = true;
            applyStatus(card, 'potion_sickness');
          }
          card.lastPotionTurn = this.turn;
        }
        const result = this.applyLootItem(item, card, { halfEffect: potionSick });
        effects.push({ used: item.name, effect: potionSick ? `${result} (⚠️ POTION SICKNESS — CON too low, effect halved!)` : result });
        // Smoke bomb
        if (/smoke/i.test(item.name)) {
          this.board.enemy.forEach(e => {
            e.dex = Math.max(0, (e.dex || 40) - 40);
            e.smoked = true;
          });
          this.buffs.push(...this.board.enemy.map(e => ({ target: e, stat: 'dex', amount: -40, turnsLeft: 2 })));
          effects.push({ smokeEffect: true });
        }
        break;
      }
      case 'inspect': { // mark enemy — next hit does +50% damage
        const tgt = this.board.enemy[targetIdx];
        if (!tgt) return { ok: false, err: 'No target' };
        this.marks.push({ target: tgt });
        effects.push({ marked: tgt.name });
        break;
      }
      case 'recover': { // heal self for CON/20
        const heal = Math.max(5, Math.floor(card.con / 20));
        card.currentHP = Math.min(card.maxHP, card.currentHP + heal);
        effects.push({ healed: card.name, amount: heal });
        break;
      }
      case 'taunt': { // force enemies to target this card
        card.taunting = true;
        effects.push({ taunting: card.name });
        break;
      }
      case 'craft': {
        if (this.mana < 1) return { ok: false, err: 'Need 1 mana to craft' };
        const idxA = extra.itemIdxA ?? itemIdx;
        const idxB = extra.itemIdxB;
        if (idxA == null || idxB == null) return { ok: false, err: 'Select 2 items to combine' };
        if (idxA === idxB) return { ok: false, err: 'Cannot combine item with itself' };
        const iA = this.battleInventory[idxA];
        const iB = this.battleInventory[idxB];
        if (!iA || !iB) return { ok: false, err: 'Invalid item selection' };
        this.mana -= 1;
        effects.push({ craft: true, itemA: iA, itemB: iB, idxA, idxB });
        return { ok: true, action: 'craft', effects };
      }
      default: return { ok: false, err: `Unknown free action: ${action}` };
    }
    card.usedFreeAction = true;
    this.log.push({ type: 'free_action', action, card: card.name });
    return { ok: true, action, effects };
  }

  triggerBattlecry(card) {
    const { getBattlecry } = require('./keywords');
    const bc = getBattlecry(card.id);
    if (!bc) return null;
    const effects = [];
    switch (bc.effect) {
      case 'shield_ally': {
        const t = this.board.player.reduce((a, b) => a.currentHP < b.currentHP ? a : b, card);
        this.shields.push({ target: t, amount: 10 });
        effects.push(`${card.name} shields ${t.name} (30)`);
        break;
      }
      case 'gain_taunt': card.taunting = true; effects.push(`${card.name} gains Taunt`); break;
      case 'taunt_self': card.taunting = true; card.con += 4; effects.push(`${card.name} demands attention (Taunt +4 CON)`); break;
      case 'mark_enemy': if (this.board.enemy.length) { const e = this.board.enemy.reduce((a,b)=>(a.str||0)>(b.str||0)?a:b); this.marks.push({ target: e }); effects.push(`${card.name} marks ${e.name}`); } break;
      case 'shield_all': this.board.player.forEach(c => this.shields.push({ target: c, amount: 15 })); effects.push(`${card.name} shields the party (15)`); break;
      case 'self_rage': card.str += 3; effects.push(`${card.name} enters enraged (+3 STR)`); break;
      case 'weaken_enemy': if (this.board.enemy.length) { const e = this.board.enemy.reduce((a,b)=>(a.str||0)>(b.str||0)?a:b); e.str = Math.max(0, e.str - 20); effects.push(`${card.name} suppresses ${e.name} (-20 STR)`); } break;
    }
    if (effects.length) this.log.push({ type: 'battlecry', card: card.name, effects });
    return effects;
  }

  // Remove any cards at 0 HP from boards (handles non-combat deaths: DoT, AoE, chaos)
  // ===== DONUT (Hero/Avatar) =====
  useDonutAbility(ability) {
    if (this.currentTurn !== 'player') return { ok: false, err: 'Not your turn' };
    if (ability === 'missile') {
      if (this.donutMissileUsed) return { ok: false, err: 'Missile already used this turn' };
      if (!this.board.enemy.length) return { ok: false, err: 'No targets' };
      this.donutMissileUsed = true;
      const target = this.board.enemy[Math.floor(rng() * this.board.enemy.length)];
      const dmg = 3 + this.turn; // scales with game length
      target.currentHP -= dmg;
      const killed = target.currentHP <= 0;
      if (killed) this.board.enemy = this.board.enemy.filter(e => e !== target);
      return { ok: true, name: 'Magic Missile', target: target.name, dmg, killed };
    }
    if (ability === 'laundry') {
      if (this.mana < 3) return { ok: false, err: 'Need 3 mana' };
      if (this.donutLaundryCd > 0) return { ok: false, err: `Cooldown: ${this.donutLaundryCd} turns` };
      this.mana -= 3;
      this.donutLaundryCd = 4;
      // Strip buffs from all enemies
      this.board.enemy.forEach(e => { e.str = Math.max(1, (e.str || 3) - 2); e.doubleDmg = false; e.con = Math.max(1, (e.con || 3) - 1); });
      return { ok: true, name: 'Laundry Day', effect: 'Stripped enemy buffs! -30 STR, -20 CON' };
    }
    return { ok: false, err: 'Unknown ability' };
  }

  // ===== HERO POWER =====
  useHeroPower() {
    if (this.heroPowerUsed) return { ok: false, err: 'Hero Power already used this turn' };
    const hp = this.sponsor?.heroPower;
    if (!hp) return { ok: false, err: 'No Hero Power available' };
    if (this.mana < hp.cost) return { ok: false, err: `Need ${hp.cost} mana` };
    this.mana -= hp.cost;
    this.heroPowerUsed = true;
    const result = { ok: true, name: hp.name, desc: hp.desc };
    switch (hp.effect) {
      case 'draw': this.draw('player'); result.effect = 'Drew 1 card'; break;
      case 'heal_lowest': { const t = this.board.player.length ? this.board.player.reduce((a,b)=>a.currentHP<b.currentHP?a:b) : null; if(t){t.currentHP=Math.min(t.maxHP,t.currentHP+(hp.value||12));result.effect=`Healed ${t.name} +${hp.value||12}`;} break; }
      case 'ping': { if(this.board.enemy.length){const e=this.board.enemy[Math.floor(rng()*this.board.enemy.length)];e.currentHP-=(hp.value||8);result.effect=`${hp.value||8} to ${e.name}`;if(e.currentHP<=0)this.board.enemy=this.board.enemy.filter(x=>x!==e);} break; }
      case 'buff_con': { const t=this.board.player.length?this.board.player.reduce((a,b)=>a.currentHP<b.currentHP?a:b):null; if(t){t.con+=(hp.value||10);t.maxHP+=5;t.currentHP+=5;result.effect=`${t.name} +${hp.value||10} CON`;} break; }
      case 'weaken': { if(this.board.enemy.length){const e=this.board.enemy.reduce((a,b)=>(b.str||0)>(a.str||0)?b:a);e.str=Math.max(0,(e.str||30)-(hp.value||8));result.effect=`${e.name} -${hp.value||8} STR`;} break; }
      case 'team_str': { this.board.player.forEach(c=>c.str+=(hp.value||5)); result.effect=`All allies +${hp.value||5} STR`; break; }
      case 'mark': { if(this.board.enemy.length){const e=this.board.enemy[Math.floor(rng()*this.board.enemy.length)];this.marks.push({target:e});result.effect=`Marked ${e.name}`;} break; }
      case 'team_crit': { this.board.player.forEach(c=>c.dex=(c.dex||0)+6); result.effect=`All allies +crit this turn`; break; }
      case 'shield_lowest': { const t=this.board.player.length?this.board.player.reduce((a,b)=>a.currentHP<b.currentHP?a:b):null; if(t){this.shields.push({target:t,amount:(hp.value||15)});result.effect=`Shielded ${t.name} ${hp.value||15}`;} break; }
      case 'mark_strongest': { if(this.board.enemy.length){const e=this.board.enemy.reduce((a,b)=>(b.str||0)>(a.str||0)?b:a);this.marks.push({target:e});result.effect=`Marked ${e.name} (strongest)`;} break; }
      case 'summon_striker': { const s={id:'plushie_striker',name:'Plushie Striker',str:4,int:1,con:2,dex:3,currentHP:6,maxHP:6,cd:{},temporary:true,turnsLeft:1,instanceId:require('crypto').randomUUID()}; if(this.board.player.length<5){this.board.player.push(s);result.effect='Summoned a Plushie Striker';} else result.effect='Board full'; break; }
    }
    return result;
  }

  // ===== GOD ZONE =====
  summonGod(godName) {
    const { createGodCard, applyBoon } = require('./gods');
    const god = createGodCard(godName || this.randomGodName());
    if (!god) return { ok: false, err: 'No god available' };
    this.godZone = god;
    // Apply boon immediately
    const boonEffects = applyBoon(god.boon, { player: { board: this.board.player, graveyard: this.graveyard, mana: this.mana }, enemy: { board: this.board.enemy, health: 0 } });
    // God-specific thematic status auras
    const godAuras = {
      Khepri: () => { this.board.player.forEach(c => applyStatus(c, 'immortal')); return 'grants IMMORTALITY to your team!'; },
      Ysalte: () => { this.board.player.forEach(c => applyStatus(c, 'vinegar')); return 'turns all your potions to vinegar!'; },
      Emberus: () => { if (this.board.player.length) { applyStatus(this.board.player[0], 'shunned'); return 'SHUNS a crawler — divine smite incoming!'; } },
      Eris: () => { const c = this.board.player[Math.floor(rng()*this.board.player.length)]; if (c) { applyStatus(c, rng()<0.5?'magical_fervor':'confused_mind'); return 'unleashes CHAOS — random effect!'; } },
      Ogun: () => { this.board.enemy.forEach(e => applyStatus(e, 'shelved')); return 'SHELVES the enemies — frozen in place!'; },
    };
    let auraMsg = '';
    if (godAuras[god.name]) auraMsg = godAuras[god.name]() || '';
    this.log.push({ type: 'god_summoned', name: god.name, boon: god.boonDescription });
    return { ok: true, god, boonEffects, auraMsg };
  }

  randomGodName() {
    const { GODS } = require('./gods');
    return GODS[Math.floor(rng() * GODS.length)]?.name || 'Emberus';
  }

  tickGodZone() {
    if (!this.godZone) return null;
    this.godZone.turnsRemaining--;
    const effects = [];

    // Reveal chaos on turn 2 of god presence
    if (this.godZone.turnsRemaining === 1 && this.godZone.chaosEffect && !this.godZone.chaosRevealed) {
      this.godZone.chaosRevealed = true;
      // Check if Laundry Day protection is active
      if (!this.godZone.laundryDayProtected) {
        const { applyChaos } = require('./gods');
        const chaosResults = applyChaos(this.godZone.chaosEffect, { player: { board: this.board.player, mana: this.mana }, enemy: { board: this.board.enemy, health: 0 } });
        effects.push({ type: 'chaos_revealed', effect: this.godZone.chaosEffect, results: chaosResults });
      } else {
        effects.push({ type: 'chaos_blocked', message: 'Laundry Day protects your team from the chaos!' });
      }
    }

    // God expires
    if (this.godZone.turnsRemaining <= 0) {
      effects.push({ type: 'god_departed', name: this.godZone.name });
      this.godZone = null;
    }

    return effects.length ? effects : null;
  }

  // Laundry Day: protects allies from god's negative effects
  castLaundryDay() {
    if (!this.godZone) return { ok: false, err: 'No active god to protect against' };
    this.godZone.laundryDayProtected = true;
    return { ok: true, message: `Laundry Day cast! Your team is protected from ${this.godZone.name}'s chaos.` };
  }

  cleanupDead() {
    // Enemy dead
    this.board.enemy = this.board.enemy.filter(c => c.currentHP > 0);
    // Player dead — respect cockroach + protagonist Grit + deathrattle
    const survivors = [];
    for (const c of this.board.player) {
      if (c.currentHP > 0) { survivors.push(c); continue; }
      if (c.indestructible) { c.currentHP = 1; survivors.push(c); continue; }
      if (c.isProtagonist && !c.crawlersGritUsed) { c.crawlersGritUsed = true; c.currentHP = 1; survivors.push(c); continue; }
      if (c.passive === 'cockroach' && !c.cockroachUsed) { c.currentHP = 1; c.cockroachUsed = true; survivors.push(c); continue; }
      // dies
      if (c.isProtagonist) { this.winner = 'enemy'; this.protagonistFell = c.name; }
      this.graveyard.push(c);
      this.playerHP -= 2;
      this.triggerDeathrattle(c);
      if (this.playerHP <= 0) { this.winner = 'enemy'; break; }
    }
    this.board.player = survivors;
  }

  triggerDeathrattle(card) {
    const { getDeathrattle } = require('./keywords');
    const dr = getDeathrattle(card.id);
    if (!dr || dr.effect === 'cockroach') return null;
    const effects = [];
    switch (dr.effect) {
      case 'curse_killer': if (this.board.enemy.length) { const e = this.board.enemy[0]; e.str = Math.max(0, e.str - 30); effects.push(`${card.name}'s dying curse weakens ${e.name} (-30 STR)`); } break;
      case 'enrage_allies': this.board.player.forEach(c => c.str += 3); effects.push(`${card.name}'s death enrages allies (+3 STR)`); break;
      case 'final_blow': if (this.board.enemy.length) { const e = this.board.enemy[Math.floor(rng()*this.board.enemy.length)]; e.currentHP -= 8; if (e.currentHP<=0) this.board.enemy = this.board.enemy.filter(x=>x!==e); effects.push(`${card.name} strikes ${e.name} for 8 with her last breath`); } break;
      case 'heal_party': this.board.player.forEach(c => c.currentHP = Math.min(c.maxHP, c.currentHP + 15)); effects.push(`${card.name} heals the party 15 with her last breath`); break;
      case 'swan_song': this.board.player.forEach(c => c.str += 2); effects.push(`${card.name}'s final aria: all allies +2 STR`); break;
    }
    if (effects.length) this.log.push({ type: 'deathrattle', card: card.name, effects });
    return effects;
  }

  applyLootItem(item, targetCard = null, opts = {}) {
    const name = item.name || 'item';
    const target = targetCard || (this.board.player.length ? this.board.player.reduce((a, b) => a.currentHP < b.currentHP ? a : b) : null);
    const n = name.toLowerCase();
    const hScale = opts.halfEffect ? 0.5 : 1; // Potion Sickness halves restorative effects

    // === SPECIFIC ITEMS (from user CSV) ===
    if (/potion of bloodlust/i.test(n)) { if (target) { target.str *= 2; target.usedFreeAction = false; applyStatus(target, 'confused_mind'); return `${name}: ${target.name} STR doubled + free action! (but Where-Am-I? sets in next turn)`; } }
    if (/mordecai.*brew|special brew/i.test(n)) { if (target) { target.invincible = 2; return `${name}: ${target.name} is INVINCIBLE for 2 rounds!`; } }
    if (/cosmic buff/i.test(n)) { this.board.player.forEach(c => { c.str += 3; c.int += 3; }); return `${name}: ALL allies +3 STR/INT permanently!`; }
    if (/size.up/i.test(n)) { if (this.board.enemy.length) { const e = this.board.enemy.reduce((a,b)=>(a.str||0)>(b.str||0)?a:b); this.marks.push({target:e}); this.marks.push({target:e}); return `${name}: Found ${e.name}'s weakness! Double damage against it.`; } }
    if (/invisibility/i.test(n)) { if (target) { target.hidden = 2; return `${name}: ${target.name} untargetable for 2 turns!`; } }
    if (/dolores/i.test(n)) { if (target) { target.passive = 'cockroach'; target.cockroachUsed = false; return `${name}: ${target.name} will survive next lethal hit!`; } }
    if (/dinosaur repellent/i.test(n)) { if (target) { target.dinoImmune = true; return `${name}: ${target.name} immune to dinosaur/beast attacks!`; } }
    if (/level.up potion/i.test(n)) { if (target) { target.str += 2; target.int += 2; target.con += 3; target.maxHP += 9; target.currentHP += 9; return `${name}: ${target.name} permanently +2 STR/INT, +3 CON!`; } }
    if (/cheat code/i.test(n)) { const r = Math.floor(rng()*3); if(r===0){this.board.player.forEach(c=>{c.str*=2;c.int*=2;});return`${name}: ALL STATS DOUBLED 1 turn!`;}if(r===1){this.board.player.forEach(c=>c.currentHP=c.maxHP);return`${name}: FULL TEAM HEAL!`;}return`${name}: Extra turn granted!`; }
    if (/hair of the dog/i.test(n)) { if (target) { target.stunned=false; target.smoked=false; this.dots=this.dots.filter(d=>d.target!==target); return `${name}: ${target.name} all debuffs removed!`; } }
    if (/rapid detox/i.test(n)) { this.board.player.forEach(c=>{c.stunned=false;c.smoked=false;}); this.dots=this.dots.filter(d=>!this.board.player.includes(d.target)); return `${name}: All allies cleansed!`; }
    if (/carl.*doomsday/i.test(n)) { const dmg=90; [...this.board.enemy,...this.board.player].forEach(c=>c.currentHP-=dmg); this.board.enemy=this.board.enemy.filter(e=>e.currentHP>0); this.cleanupDead(); return `${name}: 90 DAMAGE TO EVERYONE!`; }
    if (/waffle maker/i.test(n)) { this.board.enemy.forEach(e=>e.currentHP-=30); this.board.enemy=this.board.enemy.filter(e=>e.currentHP>0); return `${name}: 30 to all enemies!`; }
    if (/spider stalker/i.test(n)) { if(this.board.enemy.length){const e=this.board.enemy.reduce((a,b)=>b.str>a.str?b:a);e.currentHP-=28;if(e.currentHP<=0)this.board.enemy=this.board.enemy.filter(x=>x!==e);return`${name}: 28 to ${e.name}!`;} }
    if (/disco ball/i.test(n)) { this.board.enemy.forEach(e=>e.stunned=true); return `${name}: ALL enemies STUNNED!`; }
    if (/celestial grenade/i.test(n)) { const r = this.summonGod(); return r.ok ? `${name}: ${r.god.name} summoned! ${r.god.boonDescription}${r.auraMsg ? ' — ' + r.god.name + ' ' + r.auraMsg : ''}` : `${name}: No deity responded`; }
    if (/laundry day/i.test(n)) { const r = this.castLaundryDay(); return r.ok ? r.message : `${name}: ${r.err}`; }
    if (/wisp armor/i.test(n)) { if (target) { this.shields.push({ target, amount: 15 }); target.magicImmune = 1; return `${name}: ${target.name} shielded 15 + magic immune 1 turn!`; } }
    if (/graupel/i.test(n)) { const d = 60; this.board.enemy.forEach(e => e.currentHP -= d); this.board.enemy = this.board.enemy.filter(e => e.currentHP > 0); return `${name}: Graupel! ${d} damage to ALL enemies!`; }
    if (/profane iron chain/i.test(n)) { const d = 5; this.board.enemy.forEach(e => { e.currentHP -= d; e.stunned = true; }); this.board.enemy = this.board.enemy.filter(e => e.currentHP > 0); return `${name}: ${d} to ALL enemies + STUNNED!`; }
    if (/ink marauder/i.test(n)) { const d = 35; this.board.enemy.forEach(e => e.currentHP -= d); this.board.enemy = this.board.enemy.filter(e => e.currentHP > 0); return `${name}: Living tattoos attack! ${d} to all enemies!`; }
    if (/cloud of exhaust/i.test(n)) { this.board.enemy.forEach(e => e.stunned = true); return `${name}: All enemies knocked out!`; }
    if (/moab|mother of all/i.test(n)) { [...this.board.enemy,...this.board.player].forEach(c=>c.currentHP-=40); this.board.enemy=this.board.enemy.filter(e=>e.currentHP>0); this.cleanupDead(); return `${name}: 40 to ALL units!`; }
    if (/goblin oil/i.test(n)) { this.board.enemy.forEach(e=>{e.fireVuln=3;}); return `${name}: All enemies +25% fire damage for 3 turns!`; }
    // ===== STATUS EFFECT ITEMS (book-accurate) =====
    if (/moonshine|rev-up toilet/i.test(n)) { if (target) { applyStatus(target, 'shit_faced'); return `${name}: ${target.name} is SHIT-FACED — 50% miss chance!`; } }
    if (/immunity smoothie/i.test(n)) { if (target) { applyStatus(target, 'buzzed'); return `${name}: ${target.name} is Buzzed (+CHA, -DEX, immune to disease)`; } }
    if (/skunk|skank/i.test(n)) { this.board.enemy.forEach(e => applyStatus(e, 'skanked')); return `${name}: Enemies SKANKED — they reek and may vomit!`; }
    if (/sepsis|septic/i.test(n)) { this.board.enemy.forEach(e => applyStatus(e, 'sepsis')); return `${name}: Enemies infected with Sepsis!`; }
    if (/taint/i.test(n)) { if (this.board.enemy.length) { applyStatus(this.board.enemy[0], 'the_taint'); return `${name}: ${this.board.enemy[0].name} has The Taint — cannot heal!`; } }
    if (/gurgles|rabies/i.test(n)) { if (this.board.enemy.length) { const e = this.board.enemy[Math.floor(rng()*this.board.enemy.length)]; applyStatus(e, 'the_gurgles'); return `${name}: ${e.name} has THE GURGLES — gone insane, attacks anyone!`; } }
    if (/queasy|nausea/i.test(n)) { this.board.enemy.forEach(e => applyStatus(e, 'queasy')); return `${name}: All enemies Queasy — may skip turns vomiting!`; }
    if (/good rest|great rest|instacot/i.test(n)) { this.board.player.forEach(c => applyStatus(c, 'great_rest')); return `${name}: Team well-rested! +stats this battle`; }
    if (/microwave|biscuit sandwich|warm tummy/i.test(n)) { if (target) { applyStatus(target, 'warm_tummy'); return `${name}: ${target.name} is full! Faster healing.`; } }
    if (/freeball/i.test(n)) { if (target) { applyStatus(target, 'freeballing'); return `${name}: ${target.name} is Freeballing — +100% below-waist damage!`; } }

    // Protective Shell Spell: all allies invincible 1 turn
    if (/protective shell/i.test(n)) { this.board.player.forEach(c=>c.invincible=1); return `${name}: ALL allies invincible 1 turn!`; }
    // Heal Party: 30 HP
    if (/heal party/i.test(n)) { this.board.player.forEach(c=>c.currentHP=Math.min(c.maxHP,c.currentHP+30)); return `${name}: healed all allies 30!`; }
    // Confusing Fog: enemies attack random (including each other)
    if (/confusing fog/i.test(n)) { this.board.enemy.forEach(e=>{e.confused=true;}); return `${name}: All enemies CONFUSED! They may attack each other.`; }
    // Fear Spell: stun strongest enemy
    if (/fear spell/i.test(n)) { if(this.board.enemy.length){const e=this.board.enemy.reduce((a,b)=>b.str>a.str?b:a);e.stunned=true;return`${name}: ${e.name} frozen in FEAR!`;} }
    // Brain Freeze: stun 2 turns
    if (/brain freeze/i.test(n)) { if(this.board.enemy.length){const e=this.board.enemy[0];e.stunned=true;e.frozenTurns=2;return`${name}: ${e.name} FROZEN 2 turns!`;} }
    // Encore: repeat last ability
    if (/encore/i.test(n)) { return `${name}: Last ability repeated (free cast)!`; }
    // Conscription: convert enemy
    if (/conscription/i.test(n)) { if(this.board.enemy.length){const e=this.board.enemy.find(x=>!x.isBoss)||this.board.enemy[0];if(!e.isBoss){this.board.enemy=this.board.enemy.filter(x=>x!==e);this.board.player.push(e);return`${name}: ${e.name} JOINS YOUR TEAM!`;}return`${name}: Boss resisted!`;} }
    // Get Out of Jail: return a card to owner's hand
    if (/get out of jail/i.test(n)) { if(this.board.enemy.length){const e=this.board.enemy.shift();this.hand.enemy.push(e);return`${name}: ${e.name} returned to enemy hand!`;} }

    // === PLUSHIE SUMMONING ===
    if (item.effect === 'summon_temp' || item.effect === 'summon_swarm' || item.effect === 'summon_decoy' || item.effect === 'summon_demon_permanent') {
      const dur = item.effect === 'summon_demon_permanent' ? 99 : (item.duration || 1);
      const summonStr = item.rarity === 'celestial' ? 80 : item.rarity === 'legendary' ? 60 : item.rarity === 'rare' ? 40 : item.rarity === 'uncommon' ? 30 : 20;
      const summonHP = item.rarity === 'celestial' ? 120 : item.rarity === 'legendary' ? 80 : item.rarity === 'rare' ? 50 : 35;
      const summon = { name: item.name.replace('Stuffed ', ''), str: summonStr, con: summonHP, dex: 4, currentHP: summonHP, maxHP: summonHP, cd: {}, instanceId: require('crypto').randomUUID(), summoned: true, turnsLeft: dur };
      if (this.board.player.length < 5) {
        this.board.player.push(summon);
        return `${name}: Summoned ${summon.name}! (${dur === 99 ? 'permanent' : dur + ' turns'})`;
      }
      return `${name}: Board full — can't summon!`;
    }
    if (item.effect === 'explode_on_break') {
      const d = 3; this.board.enemy.forEach(e => e.currentHP -= d); this.board.enemy = this.board.enemy.filter(e => e.currentHP > 0);
      return `${name}: EXPLODES! ${d} to all enemies! "I hate Mondays, Carl"`;
    }

    // === CRAFTED ITEM STRUCTURED EFFECTS ===
    if (item.effects && Array.isArray(item.effects)) {
      const results = [];
      for (const fx of item.effects) {
        const p = fx.params || {};
        switch (fx.type) {
          case 'summon_god': { const r = this.summonGod(); if (r.ok) results.push(`Summoned ${r.god.name}`); break; }
          case 'invincible': if (target) { target.invincible = p.turns || 2; results.push(`${target.name} invincible ${target.invincible} turns`); } break;
          case 'team_invincible': this.board.player.forEach(c => c.invincible = p.turns || 1); results.push(`ALL allies invincible ${p.turns||1} turns`); break;
          case 'hidden': if (target) { target.hidden = p.turns || 2; results.push(`${target.name} hidden ${target.hidden} turns`); } break;
          case 'str_buff': if (target) { target.str += (p.amount||3); results.push(`${target.name} +${p.amount||3} STR${p.permanent?' permanently':''}`); } break;
          case 'int_buff': if (target) { target.int += (p.amount||3); results.push(`${target.name} +${p.amount||3} INT`); } break;
          case 'con_buff': if (target) { target.con += (p.amount||3); target.maxHP += Math.floor((p.amount||3)/2); target.currentHP += Math.floor((p.amount||3)/2); results.push(`${target.name} +${p.amount||3} CON`); } break;
          case 'team_str_buff': this.board.player.forEach(c => c.str += (p.amount||2)); results.push(`ALL allies +${p.amount||2} STR`); break;
          case 'team_int_buff': this.board.player.forEach(c => c.int += (p.amount||2)); results.push(`ALL allies +${p.amount||2} INT`); break;
          case 'heal_target': if (target) { target.currentHP = Math.min(target.maxHP, target.currentHP + (p.amount||8)); results.push(`Healed ${target.name} +${p.amount||8}`); } break;
          case 'heal_team': this.board.player.forEach(c => c.currentHP = Math.min(c.maxHP, c.currentHP + (p.amount||6))); results.push(`Team healed +${p.amount||6}`); break;
          case 'damage_all_enemies': this.board.enemy.forEach(e => e.currentHP -= (p.amount||8)); this.board.enemy = this.board.enemy.filter(e => e.currentHP > 0); results.push(`${p.amount||8} to all enemies`); break;
          case 'damage_single': { const e = this.board.enemy.reduce((a,b)=>b.str>a.str?b:a, this.board.enemy[0]); if(e){e.currentHP-=(p.amount||10);if(e.currentHP<=0)this.board.enemy=this.board.enemy.filter(x=>x!==e);results.push(`${p.amount||10} to ${e.name}`);} break; }
          case 'stun_all': this.board.enemy.forEach(e => e.stunned = true); results.push('ALL enemies stunned'); break;
          case 'stun_strongest': { const e=this.board.enemy.reduce((a,b)=>b.str>a.str?b:a,this.board.enemy[0]); if(e){e.stunned=true;results.push(`${e.name} stunned`);} break; }
          case 'confuse_all': this.board.enemy.forEach(e => e.confused = true); results.push('ALL enemies confused'); break;
          case 'steal_enemy': { const e=this.board.enemy.find(x=>!x.isBoss); if(e){this.board.enemy=this.board.enemy.filter(x=>x!==e);this.board.player.push(e);results.push(`${e.name} joins your team!`);} break; }
          case 'extra_action': if (target) { target.usedFreeAction = false; results.push(`${target.name} gets extra action`); } break;
          case 'mana_restore': this.mana = Math.min(10, this.mana + (p.amount||3)); results.push(`+${p.amount||3} mana`); break;
          case 'double_damage': if (target) { target.doubleDmg = true; results.push(`${target.name} deals 2x damage`); } break;
          case 'damage_reduction': if (target) { target.damageReduction = (p.percent||50); results.push(`${target.name} takes ${p.percent||50}% less damage`); } break;
          case 'revive': if (this.graveyard?.length) { const c = this.graveyard.pop(); c.currentHP = Math.floor(c.maxHP/2); this.board.player.push(c); results.push(`${c.name} revived!`); } break;
          case 'cleanse_all': this.board.player.forEach(c=>{c.stunned=false;c.smoked=false;c.confused=false;}); results.push('Team cleansed'); break;
          case 'intimidate': { const amt=p.amount||30; this.board.enemy.forEach(e=>e.str=Math.max(0,e.str-amt)); results.push(`All enemies -${amt} STR`); break; }
          case 'reflect_damage': if (target) { target.reflectDamage = p.turns||2; results.push(`${target.name} reflects damage ${p.turns||2} turns`); } break;
        }
      }
      return `${name}: ${results.join(' + ') || 'Used'}`;
    }

    // === GENERIC FALLBACKS ===
    if (/heal/i.test(n) && !/oil|weapon/i.test(n)) { if (target) { const amt = Math.round(20 * hScale); target.currentHP = Math.min(target.maxHP, target.currentHP + amt); return `${name}: healed ${target.name} +${amt}`; } }
    if (/bomb|boom|grenade|dynamite|satchel|paste/i.test(n)) { const dmg = item.rarity==='legendary'?40:item.rarity==='epic'?28:16; this.board.enemy.forEach(e=>e.currentHP-=dmg); this.board.enemy=this.board.enemy.filter(e=>e.currentHP>0); return `${name}: ${dmg} to ALL enemies!`; }
    if (/mana/i.test(n)) { const amt = Math.round(3 * hScale); this.mana = Math.min(10, this.mana + amt); return `${name}: +${amt} mana`; }
    if (/iron skin|constitution/i.test(n)) { if(target){target.con+=30;target.maxHP+=15;target.currentHP+=15;return`${name}: ${target.name} +30 CON, +15 HP`;} }
    if (/oil/i.test(n)) { if(target){target.doubleDmg=true;return`${name}: ${target.name} next attack deals double`;} }
    if (/fireball/i.test(n)) { this.board.enemy.forEach(e=>e.currentHP-=28); this.board.enemy=this.board.enemy.filter(e=>e.currentHP>0); return `${name}: Fireball! 28 to all enemies!`; }
    if (/mute/i.test(n)) { if(this.board.enemy.length){this.board.enemy[0].silenced=2;return`${name}: ${this.board.enemy[0].name} SILENCED 2 turns!`;} }
    if (/scroll.*upgrade|upgrade.*scroll|tinker|whetstone/i.test(n)) {
      if (target?.equippedWeapon?.freeAttack) {
        const w = target.equippedWeapon;
        w.freeAttack.baseDamage = Math.round((w.freeAttack.baseDamage || 3) + 3);
        w.freeAttack.scaleFactor = (w.freeAttack.scaleFactor || 5) + 1;
        const RUP = { common: 'uncommon', uncommon: 'rare', rare: 'epic', epic: 'legendary', legendary: 'celestial' };
        w.rarity = RUP[w.rarity || 'common'] || w.rarity || 'rare';
        w.upgraded = (w.upgraded || 0) + 1;
        return `${name}: upgraded ${target.name}'s ${w.name} (+3 base dmg, now ${w.rarity})`;
      }
      if (target?.equippedArmor) {
        target.equippedArmor.flatReduction = (target.equippedArmor.flatReduction || 0) + 5;
        return `${name}: upgraded ${target.name}'s ${target.equippedArmor.name} (+5 armor)`;
      }
      if (target) { target.str += 3; return `${name}: no gear to upgrade — ${target.name} +3 STR instead`; }
    }
    // Default: small STR buff
    if (target) { const b=item.rarity==='legendary'?40:item.rarity==='epic'?25:12; target.str+=b; return `${name}: +${b} STR to ${target.name}`; }
    return name + ' stored';
  }

  useAbility(cardIdx, abilityId, targetIdx) {
    const card = this.board.player[cardIdx];
    if (!card || card.stunned) return { ok: false, err: `${card?.name||'Card'} is stunned — cannot act this turn` };
    // Match ability
    let aId = abilityId;
    if (typeof aId === 'number') aId = (card.abilities || [])[aId]; // support index
    if (!ABILITIES[aId]) {
      aId = Object.keys(ABILITIES).find(k => ABILITIES[k].name.toLowerCase().includes((aId||'').toString().toLowerCase())) || (card.abilities || [])[0];
    }
    const abil = ABILITIES[aId];
    if (!abil) return { ok: false, err: `Unknown ability` };
    if (card.silenced && abil.kind === 'spell') return { ok: false, err: `${card.name} is silenced — cannot cast spells` };
    if (card.cd[aId] > 0) return { ok: false, err: `${abil.name} on cooldown (${card.cd[aId]} turns left)` };

    // SPELL/SKILL action economy:
    // - Each card gets ONE primary action per turn (skill OR spell)
    // - Skills are free; spells cost mana
    if (card.usedAction) return { ok: false, err: `${card.name} already acted this turn` };
    const isSpell = abil.kind === 'spell';
    const manaCost = isSpell ? abil.cost : 0;
    if (isSpell && manaCost > this.mana) return { ok: false, err: `Not enough mana for ${abil.name} (need ${manaCost}, have ${this.mana})` };

    this.mana -= manaCost;
    card.usedAction = true;
    if (abil.cd) card.cd[aId] = abil.cd;
    const results = { ok: true, ability: abil.name, dmgType: abil.type, kind: abil.kind, effects: [] };
    const tgt = targetIdx >= 0 ? this.board.enemy[targetIdx] : this.board.enemy[0];

    if (abil.calc && tgt) {
      let dmg = abil.calc(card);
      if (this.sponsor?.passive?.type === 'damage_boost') dmg = Math.round(dmg * (1 + this.sponsor.passive.value));
      // D'nadia: +10% per 10 favor
      if (this.sponsor?.passive?.type === 'charisma_combat') dmg = Math.round(dmg * (1 + this.sponsor.passive.value * Math.floor(this.favor / 10)));
      if (card.doubleDmg) { dmg *= 2; card.doubleDmg = false; }
      if (this.marks.some(m => m.target === tgt)) { dmg = Math.floor(dmg * 1.5); this.marks = this.marks.filter(m => m.target !== tgt); }

      if (abil.target === 'aoe') {
        // Boss condition: AoE nerf (cramped lair, etc.)
        const aoeMult = this.bossCondition?.aoeNerf || 1;
        for (const e of [...this.board.enemy]) {
          const d = Math.max(1, Math.round(applyDR(dmg, e.con) * aoeMult)); e.currentHP -= d;
          results.effects.push({ target: e.name, dmg: d });
          if (e.currentHP <= 0) this.killEnemy(e, card, results);
        }
      } else if (abil.target === 'multi') {
        for (let i = 0; i < (abil.hits || 3) && this.board.enemy.length > 0; i++) {
          const t = this.board.enemy[i % this.board.enemy.length];
          const d = applyDR(dmg, t.con); t.currentHP -= d;
          results.effects.push({ target: t.name, dmg: d });
          if (t.currentHP <= 0) this.killEnemy(t, card, results);
        }
      } else if (abil.target === 'overcharge' && tgt) {
        // Main missile at full power
        const mainDmg = applyDR(dmg, tgt.con);
        tgt.currentHP -= mainDmg;
        results.effects.push({ target: tgt.name, dmg: mainDmg });
        if (tgt.currentHP <= 0) this.killEnemy(tgt, card, results);
        // Extra mana spent beyond base cost fires extra missiles at 50% power
        const extraMana = Math.min(abil.maxExtra || 2, this.extraManaCost || 0);
        for (let i = 0; i < extraMana && this.board.enemy.length > 0; i++) {
          const extraTgt = this.board.enemy[Math.min(i + 1, this.board.enemy.length - 1)];
          const halfDmg = applyDR(Math.floor(dmg * 0.5), extraTgt.con);
          extraTgt.currentHP -= halfDmg;
          results.effects.push({ target: extraTgt.name, dmg: halfDmg, extra: true });
          if (extraTgt.currentHP <= 0) this.killEnemy(extraTgt, card, results);
        }
      } else if (abil.target === 'cleave' && tgt) {
        const d = applyDR(dmg, tgt.con); tgt.currentHP -= d;
        results.effects.push({ target: tgt.name, dmg: d });
        if (tgt.currentHP <= 0) this.killEnemy(tgt, card, results);
        const idx2 = this.board.enemy.indexOf(tgt);
        for (const adj of [this.board.enemy[idx2-1], this.board.enemy[idx2+1]].filter(Boolean)) {
          const sd = applyDR(abil.splash ? abil.splash(card) : 20, adj.con); adj.currentHP -= sd;
          results.effects.push({ target: adj.name, dmg: sd, splash: true });
          if (adj.currentHP <= 0) this.killEnemy(adj, card, results);
        }
        if (abil.dot && tgt.currentHP > 0) this.dots.push({ target: tgt, dmg: abil.dot, turnsLeft: 2 });
      } else if (tgt) {
        // Apply special ability mechanics that modify damage
        if (abil.lowHpBonus) { const missing = 1 - (card.currentHP / card.maxHP); dmg = Math.round(dmg * (1 + missing)); } // berserker: more dmg the more hurt
        if (abil.fullHpBonus && tgt.currentHP >= tgt.maxHP) dmg = Math.round(dmg * 1.6); // assassin opener
        if (abil.executeBonus && tgt.currentHP <= tgt.maxHP * 0.35) dmg = Math.round(dmg * 2.2); // execute low HP
        if (abil.fromStealth && card.hidden) dmg = Math.round(dmg * 2); // stealth strike
        if (abil.finisher) { const lowest = this.board.enemy.reduce((a,b)=>a.currentHP<b.currentHP?a:b, tgt); if (lowest === tgt) dmg = Math.round(dmg * 1.4); }
        let finalDmg = abil.ignoreArmor ? dmg : applyDR(dmg, tgt.con); // precision: ignore DR
        const hits = abil.multiHit || 1;
        for (let h = 0; h < hits; h++) {
          if (tgt.currentHP <= 0) break;
          const per = hits > 1 ? Math.ceil(finalDmg / hits) : finalDmg;
          let { dmg: critDmg, crit } = applyCrit(per, card.dex);
          // Boss signature mechanic — resistance / weakness gate
          const bm = this.applyBossMechanicDamage(tgt, critDmg, { dmgType: abil.type, crit, source: card });
          critDmg = bm.dmg;
          tgt.currentHP -= critDmg;
          results.effects.push({ target: tgt.name, dmg: critDmg, crit, hit: hits > 1 ? h + 1 : undefined, bossNote: bm.note, bossFx: bm.fx });
          if (bm.reflect) { card.currentHP -= bm.reflect; results.effects.push({ reflect: card.name, dmg: bm.reflect }); }
        }
        if (abil.stun) { tgt.stunned = true; results.effects.push({ stun: tgt.name }); }
        if (abil.selfBuff) { card.str += abil.selfBuff; results.effects.push({ buff: `${card.name} +${abil.selfBuff} STR permanently` }); }
        if (abil.dodgeBuff) { card.dodgeChance = 0.4; results.effects.push({ buff: `${card.name} gains evasion` }); }
        if (abil.exhausts) { card.exhausted = true; }
        if (abil.lifesteal) { const heal = Math.floor(finalDmg * 0.5); card.currentHP = Math.min(card.maxHP, card.currentHP + heal); results.effects.push({ heal: heal }); }
        if (tgt.currentHP <= 0) this.killEnemy(tgt, card, results);
      }
    } else if (abil.type === 'buff') {
      // CANON: Intelligence extends spell/buff duration (and crowd-control effectiveness)
      const intDur = (abil.kind === 'spell' && (card.int || 0) >= 6) ? 1 : 0;
      for (const ally of this.board.player) { this.buffs.push({ target: ally, stat: abil.stat, amount: abil.buff, turnsLeft: abil.duration + intDur }); ally[abil.stat] += abil.buff; }
      results.effects.push({ buff: `+${abil.buff} ${abil.stat} all` });
    } else if (abil.type === 'heal') {
      for (const ally of this.board.player) ally.currentHP = Math.min(ally.maxHP, ally.currentHP + (abil.healAmt || 30));
      results.effects.push({ heal: abil.healAmt || 30 });
    } else if (abil.type === 'shield') {
      const allyTgt = this.board.player.reduce((a, b) => a.currentHP < b.currentHP ? a : b);
      this.shields.push({ target: allyTgt, amount: abil.shield });
      results.effects.push({ shield: allyTgt.name, amount: abil.shield });
    } else if (abil.mark && tgt) {
      this.marks.push({ target: tgt }); results.effects.push({ mark: tgt.name });
    } else if (abil.doubleDmg || abil.selfBuff) {
      if (abil.selfBuff) { card.str += abil.selfBuff; results.effects.push({ buff: `${card.name} +${abil.selfBuff} STR permanently` }); }
      if (abil.doubleDmg) card.doubleDmg = true;
      card.currentHP -= (abil.selfDmg || 0);
      if (abil.resetAction) { card.usedAction = false; results.effects.push({ buff: `${card.name} gets another action!` }); }
      results.effects.push({ rage: card.name, selfDmg: abil.selfDmg });
    } else if (abil.type === 'execute' && tgt && tgt.currentHP / tgt.maxHP < abil.threshold) {
      this.killEnemy(tgt, card, results);
      card.currentHP = Math.min(card.maxHP, card.currentHP + abil.heal);
      results.effects.push({ devour: tgt.name });
    } else if (abil.type === 'taunt') {
      card.taunting = true; card.con += (abil.conBuff || 0);
      this.buffs.push({ target: card, stat: 'con', amount: abil.conBuff || 0, turnsLeft: 1 });
      results.effects.push({ taunt: card.name });
    } else if (abil.type === 'debuff' && tgt) {
      // Confuse / Suppress / Debuff Stack — apply a visible debuff to the target enemy
      if (abil.stun) { tgt.stunned = true; applyStatus(tgt, 'confused_mind'); }
      if (abil.reduceDmg) {
        const amt = abil.reduceDmg;
        tgt.str = Math.max(0, (tgt.str || 0) - amt);
        this.buffs.push({ target: tgt, stat: 'str', amount: -amt, turnsLeft: abil.duration || 2 });
        applyStatus(tgt, 'weakened');
      }
      if (!abil.stun && !abil.reduceDmg) applyStatus(tgt, 'confused_mind');
      results.effects.push({ debuff: tgt.name, ability: abil.name });
    } else if (abil.effect === 'steal_enemy') {
      // Samantha "Conscript & Fly": steal a non-boss enemy to your side; she flies off (sacrifice)
      const stealable = this.board.enemy.filter(e => !e.isBoss);
      if (!stealable.length) {
        results.effects.push({ fizzle: 'No conscriptable enemy (bosses resist)' });
      } else if (this.board.player.length >= 5 && !abil.sacrifice) {
        results.effects.push({ fizzle: 'Your board is full' });
      } else {
        // Grab the strongest non-boss enemy currently ON THE BOARD
        const target = stealable.reduce((a, b) => (b.str || 0) > (a.str || 0) ? b : a);
        this.board.enemy = this.board.enemy.filter(e => e !== target);
        // Convert to a usable ally: heal, reset, and give it a real ability so it isn't a dead card
        target.currentHP = target.maxHP;
        target.cd = {}; target.usedAction = false; target.conscripted = true;
        target.abilities = (target.abilities || []).filter(a => ABILITIES[a]); // keep only valid abilities
        if (!target.abilities.length) target.abilities = ['war_gauntlet']; // basic strike so it can fight
        if (abil.sacrifice) {
          // Samantha sacrifices herself, flying away with the conscript (she's indestructible/expendable)
          this.board.player = this.board.player.filter(c => c !== card);
          if (!this.graveyard.includes(card)) this.graveyard.push(card);
        }
        this.board.player.push(target);
        results.effects.push({ conscripted: target.name, sacrificed: abil.sacrifice ? card.name : null });
      }
    }
    return results;
  }

  // Apply a boss's signature damage modifier (resistance / weakness). Returns {dmg, note, fx, reflect}.
  applyBossMechanicDamage(target, dmg, ctx = {}) {
    if (!target || !target.isBoss || !target.bossMechanic) return { dmg, note: null };
    const { getBossMechanic } = require('./boss-mechanics');
    const mech = getBossMechanic(target.bossMechanic);
    if (!mech || !mech.modifyIncomingDamage) return { dmg, note: null };
    const r = mech.modifyIncomingDamage(target, dmg, { ...ctx, engine: this }) || {};
    return { dmg: r.dmg == null ? dmg : r.dmg, note: r.note || null, fx: r.fx || null, reflect: r.reflect || 0 };
  }

  killEnemy(enemy, killer, results) {
    this.board.enemy = this.board.enemy.filter(c => c !== enemy);
    killer.killCount++;
    this.favor = Math.min(100, (this.favor || 0) + 5);
    if (this.sponsor?.passive?.type === 'lifesteal') this.playerHP += this.sponsor.passive.value;
    // Boss minion-death trigger (e.g., Hoarder chokes when her swarm dies)
    const boss = this.board.enemy.find(e => e.isBoss && e.bossMechanic);
    if (boss && enemy !== boss) {
      const { getBossMechanic } = require('./boss-mechanics');
      const mech = getBossMechanic(boss.bossMechanic);
      if (mech && mech.onMinionDeath) {
        const r = mech.onMinionDeath(boss, enemy, this);
        if (r) {
          results.effects = results.effects || [];
          results.effects.push({ bossTrigger: r.text, bossFx: r.fx, big: r.big });
          if (boss.currentHP <= 0) this.killEnemy(boss, killer, results);
        }
      }
    }
    // Contextual loot box based on what was killed
    const { rollContextualBox } = require('./progression');
    const context = enemy.isBoss ? 'boss' : enemy.isElite ? 'elite' : 'mob';
    const box = rollContextualBox(context);
    box.killedBy = killer.name;
    this.pendingLoot = this.pendingLoot || [];
    this.pendingLoot.push(box);
    results.effects.push({ kill: enemy.name, by: killer.name, loot: box.boxName });
  }

  useIntervention() {
    const iv = this.sponsor?.intervention;
    if (!iv || this.favor < iv.cost) return { ok: false, err: `Need ${iv?.cost || 30} favor (have ${this.favor})` };
    this.favor -= iv.cost;
    const effects = [];
    switch (iv.effect) {
      case 'gain_mana': this.mana = Math.min(10, this.mana + iv.value); effects.push(`+${iv.value} mana`); break;
      case 'full_heal_one': {
        if (this.board.player.length) { const t = this.board.player.reduce((a,b)=>a.currentHP<b.currentHP?a:b); t.currentHP = t.maxHP; effects.push(`${t.name} fully healed`); }
        break;
      }
      case 'team_double_act': this.board.player.forEach(c => c.doubleDmg = true); effects.push('All allies: next attack doubled'); break;
      case 'revive': {
        if (this.graveyard.length) { const r = this.graveyard.pop(); r.currentHP = Math.floor(r.maxHP/2); this.board.player.push(r); effects.push(`${r.name} revived`); }
        else effects.push('No one to revive');
        break;
      }
      case 'destroy_strongest': {
        if (this.board.enemy.length) { const t = this.board.enemy.reduce((a,b)=>(a.str||0)>(b.str||0)?a:b); t.str = Math.floor(t.str/2); t.currentHP = Math.floor(t.currentHP/2); effects.push(`${t.name} weakened 50%`); }
        break;
      }
      case 'random_legendary': {
        this.lootInventory = this.lootInventory || [];
        this.lootInventory.push({ name: 'Legendary Brand Deal Item', rarity: 'legendary', slot: 'weapon', statBonus: { str: 5 } });
        effects.push('Gained a Legendary item');
        break;
      }
      case 'erase': {
        const nonBoss = this.board.enemy.find(e => !e.isBoss);
        if (nonBoss) { this.board.enemy = this.board.enemy.filter(e => e !== nonBoss); effects.push(`${nonBoss.name} ERASED`); }
        else if (this.board.enemy[0]) { this.board.enemy[0].currentHP = Math.floor(this.board.enemy[0].currentHP/2); effects.push(`Boss halved`); }
        break;
      }
      case 'sacrifice_heal': {
        if (this.board.player.length > 1) { const sac = this.board.player.shift(); this.graveyard.push(sac); this.board.player.forEach(c => { c.currentHP = c.maxHP; c.str += 3; }); effects.push(`Sacrificed ${sac.name}, healed + buffed rest`); }
        break;
      }
    }
    this.log.push({ type: 'intervention', name: iv.name, effects });
    return { ok: true, name: iv.name, effects };
  }

  endTurn() {
    this.currentTurn = 'enemy';
    return this.doEnemyTurn();
  }

  rollInstabilityEvent() {
    const inst = this.instability || 0;
    // Chance of an event scales with instability; none early
    const chance = inst < 4 ? 0 : inst < 8 ? 0.25 : inst < 12 ? 0.45 : 0.65;
    if (rng() > chance) return null;

    // At higher instability, events increasingly favor the player (AI losing control)
    const glitchy = inst >= 8;
    const events = glitchy ? [
      () => { // AI accidentally buffs player
        if (this.board.player.length) { const t = this.board.player[Math.floor(rng()*this.board.player.length)]; t.str += 4; return { type: 'chaos', text: `SYSTEM ERROR: ${t.name} gained +4 STR (the AI didn't mean to do that)` }; }
      },
      () => { // AI damages its own minion
        if (this.board.enemy.length) { const t = this.board.enemy[Math.floor(rng()*this.board.enemy.length)]; t.currentHP -= 8; if (t.currentHP<=0) this.board.enemy = this.board.enemy.filter(x=>x!==t); return { type: 'chaos', text: `GLITCH: the dungeon misfired and hit its own ${t.name} for 8` }; }
      },
      () => { // Free mana
        this.mana = Math.min(10, this.mana + 3); return { type: 'chaos', text: 'REALITY HICCUP: you gained 3 mana from the static' };
      },
      () => { // Heal player
        this.playerHP += 2; return { type: 'chaos', text: 'The AI sobs and accidentally heals you for 8' };
      },
    ] : [
      () => { // Minor enemy buff
        if (this.board.enemy.length) { const t = this.board.enemy[Math.floor(rng()*this.board.enemy.length)]; t.str += 2; return { type: 'chaos', text: `RATINGS BOOST: ${t.name} gains +2 STR for the crowd` }; }
      },
      () => { // DoT on a player card
        if (this.board.player.length) { const t = this.board.player[Math.floor(rng()*this.board.player.length)]; this.dots.push({ target: t, dmg: 6, turnsLeft: 2 }); return { type: 'chaos', text: `FLOOR HAZARD: ${t.name} is bleeding (6/turn)` }; }
      },
      () => ({ type: 'chaos', text: 'COMMERCIAL BREAK: nothing happens, but the ads are deafening' }),
    ];
    const ev = events[Math.floor(rng() * events.length)]();
    return ev || null;
  }

  resolveEnemyAbility(enemy, abilId) {
    if (!this.board.player.length) return null;
    const target = this.board.player.reduce((a, b) => a.currentHP < b.currentHP ? a : b);
    const dmgBase = (enemy.str || 3);
    const intBase = (enemy.int || 2);
    // 30% chance to use ability per turn
    if (rng() > 0.3) return null;

    switch (abilId) {
      // Floor 3 mob abilities
      case 'frenzy': { const d = dmgBase + 5; target.currentHP -= d; return { type: 'enemy_ability', card: enemy, name: 'Frenzy', target: target.name, dmg: d }; }
      case 'cleave': { const d = dmgBase; this.board.player.forEach(c => c.currentHP -= Math.floor(d * 0.6)); return { type: 'enemy_ability', card: enemy, name: 'Cleave', target: 'all', dmg: Math.floor(d * 0.6) }; }
      case 'poison_spit': { this.dots.push({ target, dmg: 8, turnsLeft: 3 }); return { type: 'enemy_ability', card: enemy, name: 'Poison Spit', target: target.name, effect: 'poisoned 3 turns' }; }
      case 'shadow_strike': { const d = Math.floor((enemy.dex || 60) / 2); target.currentHP -= d; return { type: 'enemy_ability', card: enemy, name: 'Shadow Strike', target: target.name, dmg: d }; }
      case 'rally_cry': { this.board.enemy.forEach(e => e.str = (e.str || 3) + 1); return { type: 'enemy_ability', card: enemy, name: 'Rally Cry', effect: 'all enemies +10 STR' }; }
      case 'stomp': { const d = Math.floor(dmgBase * 0.7); this.board.player.forEach(c => c.currentHP -= d); return { type: 'enemy_ability', card: enemy, name: 'Stomp', target: 'all', dmg: d }; }
      // Floor 3 elite abilities
      case 'acid_spray': { const d = intBase + 2; this.board.player.forEach(c => c.currentHP -= d); return { type: 'enemy_ability', card: enemy, name: 'Acid Spray', target: 'all', dmg: d }; }
      case 'regenerate': { enemy.currentHP = Math.min(enemy.maxHP, enemy.currentHP + 2); return { type: 'enemy_ability', card: enemy, name: 'Regenerate', effect: '+10 HP' }; }
      case 'charge': { const d = Math.floor((enemy.dex || 60) * 0.6); target.currentHP -= d; return { type: 'enemy_ability', card: enemy, name: 'Charge', target: target.name, dmg: d }; }
      case 'gore': { const d = dmgBase + 15; target.currentHP -= d; if (target.currentHP <= 0) { /* let main loop handle death */ } return { type: 'enemy_ability', card: enemy, name: 'Gore', target: target.name, dmg: d }; }
      case 'maul': { const d = Math.floor(enemy.str / 2); target.currentHP -= d; return { type: 'enemy_ability', card: enemy, name: 'Maul', target: target.name, dmg: d }; }
      case 'roar': { this.board.player.forEach(c => c.str = Math.max(0, (c.str || 3) - 1)); return { type: 'enemy_ability', card: enemy, name: 'Roar', effect: 'all allies -10 STR' }; }
      case 'drain_life': { const d = intBase + 2; target.currentHP -= d; enemy.currentHP = Math.min(enemy.maxHP, enemy.currentHP + Math.floor(d / 2)); return { type: 'enemy_ability', card: enemy, name: 'Drain Life', target: target.name, dmg: d, heal: Math.floor(d / 2) }; }
      case 'mirror_image': { enemy.dodgeChance = 0.3; return { type: 'enemy_ability', card: enemy, name: 'Mirror Image', effect: '30% dodge' }; }
      case 'confuse': { const t = this.board.player[Math.floor(rng() * this.board.player.length)]; t.confused = true; return { type: 'enemy_ability', card: enemy, name: 'Confuse', target: t.name }; }
      case 'shapeshift': return { type: 'enemy_ability', card: enemy, name: 'Shapeshift', effect: 'form changed' };
      // Floor 3 boss
      case 'crushing_coil': { const d = Math.floor(enemy.str * 0.4); target.currentHP -= d; target.stunned = true; return { type: 'enemy_ability', card: enemy, name: 'Crushing Coil', target: target.name, dmg: d, effect: 'stunned' }; }
      case 'venom_spray': { this.board.player.forEach(c => this.dots.push({ target: c, dmg: 6, turnsLeft: 2 })); return { type: 'enemy_ability', card: enemy, name: 'Venom Spray', effect: 'all poisoned' }; }
      case 'burrow': { enemy.hidden = 1; return { type: 'enemy_ability', card: enemy, name: 'Burrow', effect: 'untargetable 1 turn' }; }
      // Floor 6 hunter abilities
      case 'precision_shot': { const d = Math.floor((enemy.dex || 5) * 0.5) + 1; target.currentHP -= d; return { type: 'enemy_ability', card: enemy, name: 'Precision Shot', target: target.name, dmg: d }; }
      case 'net_trap': { if (target.passive === 'mind_balance') return { type: 'enemy_ability', card: enemy, name: 'Net Trap', target: target.name, effect: 'RESISTED (Mind Balance)' }; target.stunned = true; return { type: 'enemy_ability', card: enemy, name: 'Net Trap', target: target.name, effect: 'stunned' }; }
      case 'shock_lance': { const d = dmgBase + 2; target.currentHP -= d; return { type: 'enemy_ability', card: enemy, name: 'Shock Lance', target: target.name, dmg: d }; }
      case 'deploy_drones': { this.dots.push({ target, dmg: 3, turnsLeft: 3 }); return { type: 'enemy_ability', card: enemy, name: 'Deploy Drones', target: target.name, effect: '3 dmg/turn' }; }
      case 'psychic_drain': { const d = intBase + 2; target.currentHP -= d; enemy.currentHP = Math.min(enemy.maxHP, enemy.currentHP + d); return { type: 'enemy_ability', card: enemy, name: 'Psychic Drain', target: target.name, dmg: d }; }
      case 'fear_pulse': { this.board.player.forEach(c => c.str = Math.max(0, (c.str || 3) - 1)); return { type: 'enemy_ability', card: enemy, name: 'Fear Pulse', effect: 'all -15 STR' }; }
      case 'bone_cleave': { const d = Math.floor(enemy.str * 0.45); target.currentHP -= d; return { type: 'enemy_ability', card: enemy, name: 'Bone Cleave', target: target.name, dmg: d }; }
      case 'mount_trophy': { enemy.str += 1; return { type: 'enemy_ability', card: enemy, name: 'Mount Trophy', effect: '+1 STR (kill trophy)' }; }
      case 'primal_charge': { const d = Math.floor(enemy.str * 0.5); target.currentHP -= d; return { type: 'enemy_ability', card: enemy, name: 'Primal Charge', target: target.name, dmg: d }; }
      case 'grapple': { target.stunned = true; target.currentHP -= 3; return { type: 'enemy_ability', card: enemy, name: 'Grapple', target: target.name, dmg: 3, effect: 'stunned' }; }
      case 'mark_prey': { this.marks.push({ target }); return { type: 'enemy_ability', card: enemy, name: 'Mark Prey', target: target.name, effect: 'marked' }; }
      case 'swarm_strike': { const d = intBase + 10; target.currentHP -= d; return { type: 'enemy_ability', card: enemy, name: 'Swarm Strike', target: target.name, dmg: d }; }
      // Floor 9 commander abilities
      case 'tidal_command': { const d = intBase + 2; this.board.player.forEach(c => c.currentHP -= d); return { type: 'enemy_ability', card: enemy, name: 'Tidal Command', target: 'all', dmg: d }; }
      case 'depth_charge': { const d = 3; target.currentHP -= d; return { type: 'enemy_ability', card: enemy, name: 'Depth Charge', target: target.name, dmg: d }; }
      case 'rally_fleet': { this.board.enemy.forEach(e => e.str = (e.str || 3) + 2); return { type: 'enemy_ability', card: enemy, name: 'Rally Fleet', effect: 'all enemies +20 STR' }; }
      case 'bombardment': { const d = 3; this.board.player.forEach(c => c.currentHP -= d); return { type: 'enemy_ability', card: enemy, name: 'Bombardment', target: 'all', dmg: d }; }
      case 'fortify': { enemy.damageReduction = 30; return { type: 'enemy_ability', card: enemy, name: 'Fortify', effect: '-30% dmg taken' }; }
      case 'conscript': { if (this.board.enemy.length < 5) { this.board.enemy.push({ name: 'Conscript', str: 5, con: 4, dex: 4, currentHP: 16, maxHP: 16, cd: {}, instanceId: crypto.randomUUID() }); return { type: 'enemy_ability', card: enemy, name: 'Conscript', effect: 'spawned minion' }; } return null; }
      case 'mind_shatter': { const d = Math.floor(enemy.int * 0.4); target.currentHP -= d; target.int = Math.max(0, (target.int || 2) - 2); return { type: 'enemy_ability', card: enemy, name: 'Mind Shatter', target: target.name, dmg: d }; }
      case 'puppeteer': { const t = this.board.player[Math.floor(rng() * this.board.player.length)]; t.confused = true; return { type: 'enemy_ability', card: enemy, name: 'Puppeteer', target: t.name, effect: 'confused' }; }
      case 'mass_confusion': { this.board.player.forEach(c => c.confused = true); return { type: 'enemy_ability', card: enemy, name: 'Mass Confusion', effect: 'all confused' }; }
      case 'death_strike': { const d = Math.floor(enemy.str * 0.5); target.currentHP -= d; return { type: 'enemy_ability', card: enemy, name: 'Death Strike', target: target.name, dmg: d }; }
      case 'raise_dead': { if (this.board.enemy.length < 5) { this.board.enemy.push({ name: 'Zombie', str: 4, con: 4, currentHP: 14, maxHP: 14, cd: {}, instanceId: crypto.randomUUID() }); return { type: 'enemy_ability', card: enemy, name: 'Raise Dead', effect: 'zombie spawned' }; } return null; }
      case 'bone_wall': { this.board.enemy.forEach(e => e.con = (e.con || 3) + 1); return { type: 'enemy_ability', card: enemy, name: 'Bone Wall', effect: 'all +15 CON' }; }
      case 'berserker_slam': { const d = Math.floor(enemy.str * 0.55); target.currentHP -= d; return { type: 'enemy_ability', card: enemy, name: 'Berserker Slam', target: target.name, dmg: d }; }
      case 'war_cry': { this.board.enemy.forEach(e => e.str = (e.str || 3) + 1); return { type: 'enemy_ability', card: enemy, name: 'War Cry', effect: '+10 STR all' }; }
      case 'blood_frenzy': { enemy.str += 1; enemy.currentHP -= 3; return { type: 'enemy_ability', card: enemy, name: 'Blood Frenzy', effect: '+1 STR, -3 HP' }; }
      case 'spawn_swarm': { if (this.board.enemy.length < 5) { this.board.enemy.push({ name: 'Swarmling', str: 3, con: 2, currentHP: 8, maxHP: 8, cd: {}, instanceId: crypto.randomUUID() }); return { type: 'enemy_ability', card: enemy, name: 'Spawn Swarm', effect: 'swarmling spawned' }; } return null; }
      case 'adaptive_armor': { enemy.con = (enemy.con || 50) + 20; return { type: 'enemy_ability', card: enemy, name: 'Adaptive Armor', effect: '+20 CON' }; }
      case 'neural_link': { this.board.enemy.forEach(e => e.currentHP = Math.min(e.maxHP, e.currentHP + 10)); return { type: 'enemy_ability', card: enemy, name: 'Neural Link', effect: 'all healed 10' }; }
      // Floor 12 boss abilities
      case 'divine_flood': { const d = 4; this.board.player.forEach(c => c.currentHP -= d); return { type: 'enemy_ability', card: enemy, name: 'Divine Flood', target: 'all', dmg: d }; }
      case 'crush_will': { target.str = Math.floor((target.str || 50) * 0.6); return { type: 'enemy_ability', card: enemy, name: 'Crush Will', target: target.name, effect: 'STR reduced 40%' }; }
      case 'ocean_prison': { target.stunned = true; target.currentHP -= 3; return { type: 'enemy_ability', card: enemy, name: 'Ocean Prison', target: target.name, dmg: 3, effect: 'stunned' }; }
      case 'godly_regenerate': { enemy.currentHP = Math.min(enemy.maxHP, enemy.currentHP + 3); return { type: 'enemy_ability', card: enemy, name: 'Godly Regeneration', effect: '+20 HP' }; }
      case 'swarm_of_gods': { const d = 3; this.board.player.forEach(c => c.currentHP -= d); return { type: 'enemy_ability', card: enemy, name: 'Swarm of Gods', target: 'all', dmg: d }; }
      case 'divine_protocol': { enemy.invincible = 1; return { type: 'enemy_ability', card: enemy, name: 'Divine Protocol', effect: 'invincible 1 turn' }; }
      case 'absolute_order': { this.board.player.forEach(c => c.stunned = true); return { type: 'enemy_ability', card: enemy, name: 'Absolute Order', effect: 'all stunned' }; }
      case 'smite': { const d = 6; target.currentHP -= d; return { type: 'enemy_ability', card: enemy, name: 'Smite', target: target.name, dmg: d }; }
      case 'nightmare_realm': { this.board.player.forEach(c => c.int = Math.max(0, (c.int || 3) - 2)); return { type: 'enemy_ability', card: enemy, name: 'Nightmare Realm', effect: 'all -25 INT' }; }
      case 'soul_siphon': { const d = Math.floor(enemy.int * 0.35); target.currentHP -= d; enemy.currentHP = Math.min(enemy.maxHP, enemy.currentHP + d); return { type: 'enemy_ability', card: enemy, name: 'Soul Siphon', target: target.name, dmg: d }; }
      case 'rewrite_reality': { const t = this.board.player[Math.floor(rng() * this.board.player.length)]; const s = t.str; t.str = t.con; t.con = s; return { type: 'enemy_ability', card: enemy, name: 'Rewrite Reality', target: t.name, effect: 'STR/CON swapped' }; }
      case 'psychic_storm': { const d = Math.floor(enemy.int * 0.3); this.board.player.forEach(c => c.currentHP -= d); return { type: 'enemy_ability', card: enemy, name: 'Psychic Storm', target: 'all', dmg: d }; }
      case 'death_sentence': { if (target.currentHP < target.maxHP * 0.3) { target.currentHP = 0; return { type: 'enemy_ability', card: enemy, name: 'Death Sentence', target: target.name, effect: 'EXECUTED' }; } return null; }
      case 'corpse_explosion': { const dead = this.graveyard.length; const d = dead * 3; if (d > 0) { this.board.player.forEach(c => c.currentHP -= d); return { type: 'enemy_ability', card: enemy, name: 'Corpse Explosion', target: 'all', dmg: d }; } return null; }
      case 'bone_throne': { enemy.str += 2; enemy.con += 2; return { type: 'enemy_ability', card: enemy, name: 'Bone Throne', effect: '+2 STR/CON' }; }
      case 'reap': { const d = Math.floor(enemy.str * 0.6); target.currentHP -= d; return { type: 'enemy_ability', card: enemy, name: 'Reap', target: target.name, dmg: d }; }
      case 'world_smash': { const d = 5; this.board.player.forEach(c => c.currentHP -= d); return { type: 'enemy_ability', card: enemy, name: 'World Smash', target: 'all', dmg: d }; }
      case 'primal_roar': { this.board.player.forEach(c => { c.str = Math.max(0, (c.str || 3) - 2); }); return { type: 'enemy_ability', card: enemy, name: 'Primal Roar', effect: 'all -20 STR' }; }
      case 'earthquake': { const d = 3; [...this.board.player, ...this.board.enemy].forEach(c => c.currentHP -= d); return { type: 'enemy_ability', card: enemy, name: 'Earthquake', target: 'everyone', dmg: d }; }
      case 'devour_god': { const d = Math.floor(enemy.str * 0.7); target.currentHP -= d; enemy.currentHP = Math.min(enemy.maxHP, enemy.currentHP + d); return { type: 'enemy_ability', card: enemy, name: 'Devour God', target: target.name, dmg: d }; }
      case 'spawn_divine_swarm': { for (let i = 0; i < 2 && this.board.enemy.length < 5; i++) { this.board.enemy.push({ name: 'Divine Drone', str: 5, con: 4, currentHP: 16, maxHP: 16, cd: {}, instanceId: crypto.randomUUID() }); } return { type: 'enemy_ability', card: enemy, name: 'Spawn Divine Swarm', effect: '2 drones spawned' }; }
      case 'assimilate': { const t = this.board.player[Math.floor(rng() * this.board.player.length)]; const stolen = Math.floor(1); t.str -= stolen; enemy.str += stolen; return { type: 'enemy_ability', card: enemy, name: 'Assimilate', target: t.name, effect: `stole ${stolen} STR` }; }
      case 'hive_storm': { const d = Math.floor(enemy.int * 0.3); this.board.player.forEach(c => c.currentHP -= d); return { type: 'enemy_ability', card: enemy, name: 'Hive Storm', target: 'all', dmg: d }; }
      case 'evolve': { enemy.str += 1; enemy.con += 1; enemy.maxHP += 3; enemy.currentHP += 3; return { type: 'enemy_ability', card: enemy, name: 'Evolve', effect: '+1 STR/CON, +3 HP' }; }
      default: return null;
    }
  }

  // SMART AI: evaluate enemy abilities by value — pick the best one for this turn's situation
  pickBestEnemyAbility(enemy) {
    const abils = enemy.abilities || [];
    if (!abils.length) return null;
    const board = this.board.player;
    if (!board.length) return abils[0]; // no targets, just pick something
    const scores = abils.map(id => {
      let score = 1;
      // AoE vs single: AoE is better with more player cards
      const isAoE = /storm|swarm|flood|quake|bombardment|roar|smash/.test(id);
      if (isAoE) score += board.length * 1.5;
      // Healing abilities: value when hurt
      if (/heal|regen|devour|siphon|drain/.test(id)) score += enemy.currentHP < enemy.maxHP * 0.5 ? 5 : 0;
      // Spawning: value when board is thin
      if (/spawn|swarm_of|raise_dead|conscript/.test(id)) score += this.board.enemy.length < 3 ? 4 : 0;
      // Buff: value early in the fight
      if (/buff|frenzy|evolve|throne/.test(id)) score += this.turn < 4 ? 3 : 1;
      // Stun/CC: target high-value player cards
      if (/stun|prison|grapple|bind/.test(id)) score += board.some(c => c.isProtagonist || c.str >= 6) ? 4 : 1;
      // Direct damage: prioritize when target is low
      if (/strike|charge|lance|cleave|shot|slam|smite|reap/.test(id)) {
        const lowest = board.reduce((a, b) => a.currentHP < b.currentHP ? a : b);
        if (lowest.currentHP <= (enemy.str || 3) * 1.5) score += 6; // lethal range
        else score += 2;
      }
      return { id, score };
    });
    scores.sort((a, b) => b.score - a.score);
    return scores[0]?.id || abils[0];
  }

  doEnemyTurn() {
    const actions = [];
    // Tick status effects on enemies
    for (const e of [...this.board.enemy]) {
      const msgs = tickStatuses(e, this);
      for (const m of msgs) actions.push({ type: 'status_tick', text: m });
    }
    this.board.enemy = this.board.enemy.filter(c => c.currentHP > 0);
    // Boss signature mechanic — runs each enemy turn (swarm, charge, surge, etc.)
    const bossCard = this.board.enemy.find(e => e.isBoss && e.bossMechanic);
    if (bossCard) {
      const { getBossMechanic } = require('./boss-mechanics');
      const mech = getBossMechanic(bossCard.bossMechanic);
      if (mech && mech.onBossTurn) {
        const fx = mech.onBossTurn(bossCard, this) || [];
        for (const a of fx) actions.push(a);
        this.board.enemy = this.board.enemy.filter(c => c.currentHP > 0);
      }
    }
    // Instability-driven chaos event (Dungeon AI glitching as it loses control)
    const chaos = this.rollInstabilityEvent();
    if (chaos) actions.push(chaos);
    // Play cards using mana (same rules as player — starts at same mana)
    // SMART DEPLOYMENT: play highest-impact cards first (bosses > elites > highest STR)
    let enemyMana = this.maxMana + 3;
    const enemyBoardMax = this.battleType === 'boss' ? 6 : 8;
    const deployCap = this.battleType === 'boss' ? 2 : 4;
    const handSorted = [...this.hand.enemy].sort((a, b) => ((b.isBoss ? 100 : b.isElite ? 50 : 0) + (b.str || 0)) - ((a.isBoss ? 100 : a.isElite ? 50 : 0) + (a.str || 0)));
    let played = 0;
    for (const c of handSorted) {
      if (played >= deployCap || this.board.enemy.length >= enemyBoardMax) break;
      const cost = c.cost || 1;
      if (cost > enemyMana) continue;
      enemyMana -= cost;
      this.hand.enemy = this.hand.enemy.filter(x => x !== c);
      c.justPlayed = true;
      this.board.enemy.push(c);
      actions.push({ type: 'enemy_play', card: c });
      played++;
    }
    this.draw('enemy');

    // SMART ABILITY SELECTION: pick the best ability each elite/boss can use this turn
    // Aggression scales with floor (deeper = smarter choices, earlier = sometimes random)
    const smartChance = Math.min(0.95, 0.5 + this.floor * 0.05); // floor 1=55%, floor 9=95%
    for (const m of [...this.board.enemy]) {
      if (m.stunned || !m.abilities || !m.abilities.length) continue;
      if (!m.isElite && !m.isBoss) continue;
      // Sometimes (on easy floors) pick randomly to give the player breathing room
      if (rng() > smartChance) {
        const abil = m.abilities[Math.floor(rng() * m.abilities.length)];
        const fx = this.resolveEnemyAbility(m, abil);
        if (fx) actions.push(fx);
        continue;
      }
      // SMART: evaluate each ability and pick the highest-value one
      const bestAbil = this.pickBestEnemyAbility(m);
      if (bestAbil) { const fx = this.resolveEnemyAbility(m, bestAbil); if (fx) actions.push(fx); }
    }
    // Attack
    for (const m of [...this.board.enemy]) {
      if (m.justPlayed) { m.justPlayed = false; continue; } // summoning sickness
      if (m.stunned) { m.stunned = false; actions.push({ type: 'enemy_stunned', card: m }); continue; }
      // Status: skip-action effects (queasy, bonked, ouch, exhausted, skanked)
      if (m.statuses) {
        const skipStatus = Object.values(m.statuses).find(s => s.turnsLeft > 0 && s.skipChance && rng() < s.skipChance);
        if (skipStatus) { actions.push({ type: 'status_tick', text: `${m.name} loses its action (${skipStatus.name})` }); continue; }
        // Confused/insane: attack a random enemy of its own
        const confusedStatus = Object.values(m.statuses).find(s => s.turnsLeft > 0 && s.confused);
        if (confusedStatus && this.board.enemy.length > 1 && rng() < 0.5) {
          const others = this.board.enemy.filter(e => e !== m);
          const victim = others[Math.floor(rng() * others.length)];
          const d = 1 + (m.str || 3);
          victim.currentHP -= d;
          actions.push({ type: 'status_tick', text: `${m.name} (${confusedStatus.name}) attacks its own ally ${victim.name} for ${d}!` });
          if (victim.currentHP <= 0) this.board.enemy = this.board.enemy.filter(e => e !== victim);
          continue;
        }
      }
      const dmgBase = 1 + (m.str || 3);
      if (this.board.player.length === 0) {
        this.playerHP -= dmgBase;
        actions.push({ type: 'face_hit', card: m, dmg: dmgBase });
        if (this.playerHP <= 0) {
          if (!this.donutCockroachUsed) { this.playerHP = 1; this.donutCockroachUsed = true; actions.push({ type: 'cockroach_donut' }); }
          else { this.winner = 'enemy'; return actions; }
        }
        continue;
      }
      // SMART TARGETING: taunt first, then biggest threat (highest STR = most damage potential),
      // but on shallow floors sometimes just hit whoever's closest (random-ish) for feel.
      const tauntTarget = this.board.player.find(c => c.taunting);
      let target;
      if (tauntTarget) { target = tauntTarget; }
      else {
        const nonProtag = this.board.player.filter(c => !c.isProtagonist);
        const pool = nonProtag.length ? nonProtag : this.board.player;
        // Smart: focus biggest threat — either highest kill-count (carrying) or highest STR
        if (rng() < (0.4 + this.floor * 0.06)) {
          const byThreat = [...pool].sort((a, b) => ((b.killCount || 0) + (b.str || 0)) - ((a.killCount || 0) + (a.str || 0)));
          target = byThreat[0];
        } else {
          target = pool.reduce((a, b) => a.currentHP < b.currentHP ? a : b);
        }
      }
      let dmg = applyDR(dmgBase, target.con);
      const shield = this.shields.find(s => s.target === target);
      if (shield) { const abs = Math.min(shield.amount, dmg); dmg -= abs; shield.amount -= abs; if (shield.amount <= 0) this.shields = this.shields.filter(s => s !== shield); }
      // Armor damage reduction
      const { applyArmorReduction } = require('./armor');
      dmg = applyArmorReduction(dmg, target);
      // Thorns: attacker takes damage
      if (target.equippedArmor?.special === 'thorns') m.currentHP -= (target.equippedArmor.thornsDmg || 15);
      target.currentHP -= dmg;
      actions.push({ type: 'enemy_attack', card: m, target, dmg });
      if (target.currentHP <= 0) {
        if (target.indestructible) {
          target.currentHP = 1; // sentient weapons can't die
          actions.push({ type: 'enemy_attack', card: m, target, dmg, blocked: true });
          continue;
        } else if (target.isProtagonist && !target.crawlersGritUsed) {
          target.crawlersGritUsed = true; target.currentHP = 1;
          actions.push({ type: 'crawlers_grit', card: target });
        } else if (target.passive === 'cockroach' && !target.cockroachUsed) {
          target.currentHP = 1; target.cockroachUsed = true;
          actions.push({ type: 'cockroach', card: target });
        } else {
          if (target.isProtagonist) { this.winner = 'enemy'; this.protagonistFell = target.name; }
          this.board.player = this.board.player.filter(c => c !== target);
          this.graveyard.push(target);
          this.playerHP -= 2;
          const drEffects = this.triggerDeathrattle(target);
          actions.push({ type: 'card_died', card: target, deathrattle: drEffects });
          if (this.winner === 'enemy') return actions;
          if (this.playerHP <= 0) { this.winner = 'enemy'; return actions; }
        }
      }
    }
    // Reset taunt
    for (const c of this.board.player) c.taunting = false;
    // Check win
    if (this.board.enemy.length === 0 && this.hand.enemy.length === 0 && this.deck.enemy.length === 0) this.winner = 'player';
    if (!this.winner) this.startTurn(); // set up next player turn (mana, draw, effects)
    return actions;
  }

  getState() {
    // Compute ability previews for each board card (actual numbers)
    const withPreviews = (cards, isPlayer) => cards.map(c => {
      if (!isPlayer || !c.abilities) return c;
      const abilityInfo = c.abilities.map(aId => {
        const ab = ABILITIES[aId];
        if (!ab) return { id: aId, name: aId };
        const info = { id: aId, name: ab.name, kind: ab.kind, cost: ab.kind === 'spell' ? ab.cost : 0, cd: ab.cd || 0, currentCd: c.cd?.[aId] || 0, type: ab.type, target: ab.target };
        if (ab.calc) {
          let dmg = ab.calc(c);
          if (c.doubleDmg) dmg *= 2;
          info.damage = dmg;
          info.preview = ab.target === 'aoe' ? `${dmg} to ALL` : ab.target === 'cleave' ? `${dmg} + ${ab.splash ? ab.splash(c) : 0} splash` : ab.target === 'multi' ? `${dmg} × ${ab.hits || 3} targets` : `${dmg} damage`;
        } else if (ab.type === 'heal') {
          info.preview = `Heal team ${ab.healAmt || 30}`;
        } else if (ab.type === 'buff') {
          info.preview = `+${ab.buff} ${ab.stat} to team (${ab.duration}t)`;
        } else if (ab.type === 'shield') {
          info.preview = `Shield ${ab.shield} dmg`;
        } else if (ab.mark) {
          info.preview = `Mark: next hit +50%`;
        } else if (ab.type === 'execute') {
          info.preview = `Kill if <30% HP, heal ${ab.heal}`;
        } else if (ab.type === 'self_buff') {
          info.preview = `2× next attack (-${ab.selfDmg} HP)`;
        } else if (ab.type === 'taunt') {
          info.preview = `Taunt + ${ab.conBuff} CON`;
        } else if (ab.type === 'debuff') {
          info.preview = ab.reduceDmg ? `-${ab.reduceDmg} enemy STR` : 'Weaken enemy';
        }
        return info;
      });
      return { ...c, abilityInfo, statusList: getStatusList(c) };
    });

    return {
      floor: this.floor, turn: this.turn, mana: this.mana, maxMana: this.maxMana, environment: this.environment, battleType: this.battleType,
      playerHP: this.playerHP, winner: this.winner, currentTurn: this.currentTurn,
      player: { board: withPreviews(this.board.player, true), hand: withPreviews(this.hand.player, true), deckSize: this.deck.player.length, lootDeckSize: this.deck.loot?.length || 0 },
      enemy: { board: this.board.enemy.map(c => ({ ...c, statusList: getStatusList(c) })), hand: this.hand.enemy.map(c => ({ id: c.id, cost: c.cost })), deckSize: this.deck.enemy.length },
      pendingDraw: this.pendingDraw || false,
      battleInventory: this.battleInventory || [],
      godZone: this.godZone ? { name: this.godZone.name, title: this.godZone.title, domain: this.godZone.domain, turnsRemaining: this.godZone.turnsRemaining, boonDescription: this.godZone.boonDescription, chaosRevealed: this.godZone.chaosRevealed, chaosEffect: this.godZone.chaosRevealed ? this.godZone.chaosEffect : null, laundryDayProtected: this.godZone.laundryDayProtected } : null,
      lastGodEffects: this.lastGodEffects || null,
      sponsor: this.sponsor ? { name: this.sponsor.name, emoji: this.sponsor.emoji, passive: this.sponsor.passive.desc, intervention: this.sponsor.intervention, heroPower: this.sponsor.heroPower } : null,
      heroPowerUsed: this.heroPowerUsed || false,
      donutMissileUsed: this.donutMissileUsed || false,
      donutLaundryCd: this.donutLaundryCd || 0,
      favor: this.favor || 0,
      instability: this.instability || 0,
      pendingLoot: this.pendingLoot || [],
      abilities: Object.fromEntries(Object.entries(ABILITIES).map(([k, v]) => [k, { name: v.name, cost: v.cost, type: v.type, target: v.target, cd: v.cd || 0 }])),
    };
  }
}

function shuffle(arr) { for (let i = arr.length-1; i > 0; i--) { const j = Math.floor(rng()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }

module.exports = { BattleEngine, ABILITIES, hp, dr, applyDR, shuffle };
