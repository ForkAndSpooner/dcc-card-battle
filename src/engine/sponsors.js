// Sponsor system - alien corporations that buff the player + favor track
const SPONSORS = {
  borant: {
    id: 'borant', name: 'Borant Corporation', emoji: '🏢',
    tagline: 'Your suffering, our profit.',
    passive: { type: 'mana_regen', value: 1, desc: '+1 mana each turn' },
    intervention: { name: 'Budget Increase', cost: 30, effect: 'gain_mana', value: 5, desc: 'Gain 5 mana this turn' },
    heroPower: { name: 'Overtime', cost: 1, desc: 'Draw 1 card', effect: 'draw' },
  },
  phlegmaxx: {
    id: 'phlegmaxx', name: 'Phlegmaxx Industries', emoji: '🧪',
    tagline: 'Galactic pharmaceuticals from the finest mucus.',
    passive: { type: 'potion_boost', value: 8, desc: 'Healing effects +8 HP' },
    intervention: { name: 'Clinical Trial', cost: 30, effect: 'full_heal_one', desc: 'Fully heal your lowest-HP ally' },
    heroPower: { name: 'Dose', cost: 1, desc: 'Heal lowest ally 12 HP', effect: 'heal_lowest', value: 12 },
  },
  glubglub: {
    id: 'glubglub', name: 'GlubGlub Galaxy Beverages', emoji: '🥤',
    tagline: 'The soda that drinks YOU.',
    passive: { type: 'con_aura', value: 2, desc: 'All allies +2 CON on play' },
    intervention: { name: 'Sugar Rush', cost: 30, effect: 'team_double_act', desc: 'All allies deal ×2 damage this turn, then stunned' },
    heroPower: { name: 'Fizz Blast', cost: 1, desc: 'Deal 8 to random enemy', effect: 'ping', value: 8 },
  },
  gridlock: {
    id: 'gridlock', name: 'Grid-Lock Mortuary Services', emoji: '⚰️',
    tagline: 'Death is just a paperwork problem.',
    passive: { type: 'death_loot', desc: 'Dead cards keep their kill-loot boxes' },
    intervention: { name: 'Recall to Sender', cost: 30, effect: 'revive', desc: 'Revive one dead ally at 50% HP' },
    heroPower: { name: 'Embalm', cost: 1, desc: '+3 CON to lowest ally', effect: 'buff_con', value: 3 },
  },
  taxavoid: {
    id: 'taxavoid', name: 'Tax Avoidance Corp', emoji: '📊',
    tagline: 'We make your liabilities disappear.',
    passive: { type: 'enemy_loot_down', desc: 'Enemy kill-loot drops one tier worse' },
    intervention: { name: 'Hostile Audit', cost: 30, effect: 'destroy_strongest', desc: "Halve the strongest enemy's STR and HP" },
    heroPower: { name: 'Audit', cost: 1, desc: '-8 STR from strongest enemy', effect: 'weaken', value: 8 },
  },
  dnadia: {
    id: 'dnadia', name: "Princess D'nadia", emoji: '👸',
    tagline: 'Adored across seventeen galaxies.',
    passive: { type: 'charisma_combat', value: 0.1, desc: '+10% damage per 10 favor (scales with performance)' },
    intervention: { name: 'Brand Deal', cost: 30, effect: 'random_legendary', desc: 'Gain a random Legendary item immediately' },
    heroPower: { name: 'Charm', cost: 1, desc: '+2 STR to all allies', effect: 'team_str', value: 2 },
  },
  void: {
    id: 'void', name: 'Screaming Void LLC', emoji: '🕳️',
    tagline: 'Embrace the inevitable.',
    passive: { type: 'damage_boost', value: 0.10, desc: 'All damage +10%' },
    intervention: { name: 'Void Touched', cost: 30, effect: 'erase', desc: 'Erase one non-boss enemy (instakill)' },
    heroPower: { name: 'Void Bolt', cost: 1, desc: '12 damage to random enemy', effect: 'ping', value: 12 },
  },
  yumyum: {
    id: 'yumyum', name: 'YumYum Meat Processing', emoji: '🍖',
    tagline: 'Everything is content. Everything is meat.',
    passive: { type: 'lifesteal', value: 3, desc: 'Every kill heals you 3 HP' },
    intervention: { name: 'Value Meal', cost: 30, effect: 'sacrifice_heal', desc: 'Sacrifice 1 ally, fully heal + buff all others' },
    heroPower: { name: 'Tenderize', cost: 1, desc: 'Mark random enemy (+50% dmg)', effect: 'mark', value: 1 },
  },

  // ===== Canon DCC sponsors (from Compendium) =====
  valtay: {
    id: 'valtay', name: 'The Valtay Corporation', emoji: '🛸', canon: true,
    tagline: 'High-tech wetware for the discerning crawler. (Sponsored Carl.)',
    passive: { type: 'mana_regen', value: 1, desc: 'Neural Enhancers: +1 mana each turn (HUD upgrade)' },
    intervention: { name: 'Subspace Resupply', cost: 30, effect: 'random_legendary', desc: 'Beam in a random Legendary-tier item' },
    heroPower: { name: 'HUD Targeting', cost: 1, desc: '+15% crit to all allies this turn', effect: 'team_crit', value: 0.15 },
  },
  apothecary: {
    id: 'apothecary', name: 'The Apothecary', emoji: '⚗️', canon: true,
    tagline: 'Krakaren alchemists. Cosmic Buff potions. (Sponsored Donut, Katia, Prepotente.)',
    passive: { type: 'potion_boost', value: 10, desc: 'All healing +10 HP (potent alchemy)' },
    intervention: { name: 'Cosmic Buff', cost: 30, effect: 'team_all_stats', desc: 'All allies +3 to every stat this battle' },
    heroPower: { name: 'Dose', cost: 1, desc: 'Heal lowest ally 14 HP', effect: 'heal_lowest', value: 14 },
  },
  oipan: {
    id: 'oipan', name: 'Open Intellect Pacifist Action Network', emoji: '☮️', canon: true,
    tagline: 'Non-violence, sponsored. (Sponsored Carl & Theia.)',
    passive: { type: 'shield_aura', value: 10, desc: 'Allies enter play with a 10-point shield' },
    intervention: { name: 'Mediation', cost: 30, effect: 'pacify_all', desc: 'Stun all enemies for 1 turn (no harm done... yet)' },
    heroPower: { name: 'Ward', cost: 1, desc: 'Shield lowest ally 15', effect: 'shield_lowest', value: 15 },
  },
  jaxbrin: {
    id: 'jaxbrin', name: 'Jaxbrin Amusements', emoji: '🧸', canon: true,
    tagline: 'Pull the tag, summon the monster. (Sponsored Bautista.)',
    passive: { type: 'summon_boost', desc: 'Summoned plushies/allies enter with +2 STR' },
    intervention: { name: 'Plushie Drop', cost: 30, effect: 'summon_plushie', desc: 'Summon a random plushie monster ally' },
    heroPower: { name: 'Tag Pull', cost: 1, desc: 'Summon a 1-turn plushie striker', effect: 'summon_striker', value: 1 },
  },
  dictum: {
    id: 'dictum', name: 'Dictum Waystation Controls', emoji: '🧭', canon: true,
    tagline: 'Navigation gear. Reads the fine print so you don\'t. (Sponsored Everly.)',
    passive: { type: 'loot_up', desc: 'Kill-loot drops one tier better (Gordon\'s Compass finds the good stuff)' },
    intervention: { name: 'Optimal Route', cost: 30, effect: 'extra_mana_next', desc: '+3 max mana for the rest of the battle' },
    heroPower: { name: 'Scout', cost: 1, desc: 'Reveal + mark the strongest enemy', effect: 'mark_strongest', value: 1 },
  },
};

function getSponsor(id) { return SPONSORS[id] || SPONSORS.borant; }
function listSponsors() { return Object.values(SPONSORS); }

const FAVOR = { kill: 5, overkill: 3, quest: 15, ability_use: 1, high_rapport: 5 };

module.exports = { SPONSORS, getSponsor, listSponsors, FAVOR };
