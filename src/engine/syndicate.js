// Syndicate Enemy Library — Alien species that rule the galaxy
// Floors 6, 9, 12 feature these as opponents instead of dungeon mobs

// Floor 3: The Over City — dungeon mobs + elite quest creatures
const FLOOR_3_MOBS = [
  { name: 'Feral Crawler', str: 3, int: 1, con: 4, dex: 4, hp: 12, abilities: ['frenzy'], desc: 'Former human gone mad.' },
  { name: 'Vorpal Construct', str: 4, int: 1, con: 4, dex: 3, hp: 14, abilities: ['cleave'], desc: 'Whirring blade-machine.' },
  { name: 'Odious Creeper', str: 2, int: 2, con: 5, dex: 2, hp: 16, abilities: ['poison_spit'], desc: 'Slow but tanky. Applies poison.' },
  { name: 'Shade Gnoll', str: 3, int: 2, con: 3, dex: 5, hp: 10, abilities: ['shadow_strike'], desc: 'Fast shadow gnoll.' },
  { name: 'Hobgoblin Sergeant', str: 3, int: 2, con: 4, dex: 3, hp: 12, abilities: ['rally_cry'], desc: 'Buffs nearby mobs.' },
  { name: 'Ball of Swine', str: 2, int: 1, con: 6, dex: 1, hp: 18, abilities: ['stomp'], desc: 'Revolting but durable.' },
];

const FLOOR_3_ELITES = [
  { name: 'Claude Sludgington IV', str: 4, int: 3, con: 5, dex: 3, hp: 22, abilities: ['acid_spray', 'regenerate'], passive: 'sludge_armor', desc: 'Regens 2 HP/turn.', isElite: true },
  { name: 'Rude-Dolph', str: 4, int: 2, con: 4, dex: 5, hp: 18, abilities: ['charge', 'gore'], passive: 'blood_frenzy', desc: '+2 STR below 50% HP.', isElite: true },
  { name: 'Heather the Bear', str: 5, int: 1, con: 6, dex: 2, hp: 24, abilities: ['maul', 'roar'], passive: 'thick_hide', desc: '-20% physical damage.', isElite: true },
  { name: 'Juicer', str: 4, int: 3, con: 4, dex: 4, hp: 18, abilities: ['drain_life', 'frenzy'], passive: 'vampiric', desc: 'Heals 50% of damage dealt.', isElite: true },
  { name: 'Grimaldi', str: 3, int: 4, con: 3, dex: 4, hp: 15, abilities: ['magic_missile', 'mirror_image'], passive: 'illusionist', desc: '30% dodge.', isElite: true },
  { name: 'The Pooka', str: 2, int: 5, con: 2, dex: 6, hp: 12, abilities: ['shapeshift', 'confuse'], passive: 'trickster', desc: 'Copies abilities.', isElite: true },
];

const FLOOR_3_BOSS = { name: 'Scolopendra', str: 5, int: 2, con: 7, dex: 4, hp: 35, abilities: ['crushing_coil', 'venom_spray', 'burrow'], passive: 'segmented', desc: 'Splits at 50% HP.', isBoss: true };

const SYNDICATE_SPECIES = {
  kua_tin: { name: 'Kua-Tin', desc: 'Aquatic slavers with tentacles and superiority complexes', color: '#4488aa' },
  bopca_protectorate: { name: "Bopca Protectorate", desc: 'Militaristic insectoids who love bureaucracy', color: '#88aa44' },
  skull_empire: { name: 'Skull Empire', desc: 'Skeletal conquerors obsessed with death aesthetics', color: '#aa4488' },
  valtay: { name: 'Valtay', desc: 'Psychic lizardfolk who eat emotions', color: '#aa8844' },
  hive_mind: { name: 'Hive Mind Collective', desc: 'Shared consciousness bugs — kill one, others adapt', color: '#44aa88' },
  primal: { name: 'Primal', desc: 'Ancient ape-like beings who believe in survival of fittest', color: '#cc6633' },
};

// Floor 6: The Hunting Grounds — rich alien tourists hunting crawlers for sport
const FLOOR_6_HUNTERS = [
  { name: 'Kua-Tin Safari Lord', species: 'kua_tin', str: 2, int: 1, con: 2, dex: 4, hp: 17, abilities: ['precision_shot', 'net_trap'], passive: 'trophy_hunter', desc: 'Collects crawler heads. Gets +15 STR per kill.' },
  { name: 'Bopca Game Warden', species: 'bopca_protectorate', str: 3, int: 2, con: 3, dex: 2, hp: 20, abilities: ['shock_lance', 'deploy_drones'], passive: 'squad_tactics', desc: 'Never hunts alone. Drones deal 10 dmg/turn.' },
  { name: "Valtay Emotion Eater", species: 'valtay', str: 1, int: 4, con: 2, dex: 3, hp: 14, abilities: ['psychic_drain', 'fear_pulse'], passive: 'empathic_leech', desc: 'Heals when you take damage.' },
  { name: 'Skull Empire Collector', species: 'skull_empire', str: 3, int: 1, con: 3, dex: 2, hp: 19, abilities: ['bone_cleave', 'mount_trophy'], passive: 'death_display', desc: 'Displays kills to intimidate. -5 STR to all opponents per kill.' },
  { name: 'Primal Trophy Hunter', species: 'primal', str: 4, int: 1, con: 3, dex: 3, hp: 22, abilities: ['primal_charge', 'grapple'], passive: 'apex_predator', desc: 'Deals 2x to targets below 50% HP.' },
  { name: 'Hive Scout Stalker', species: 'hive_mind', str: 2, int: 3, con: 2, dex: 4, hp: 12, abilities: ['mark_prey', 'swarm_strike'], passive: 'shared_sight', desc: 'When one sees you, all see you. Cannot be hidden from.' },
];

// Floor 9: Faction Wars — trained military leaders
const FLOOR_9_COMMANDERS = [
  { name: 'Kua-Tin Admiral', species: 'kua_tin', str: 2, int: 3, con: 4, dex: 2, hp: 28, abilities: ['tidal_command', 'depth_charge', 'rally_fleet'], passive: 'naval_supremacy', desc: 'Buffs all allies +20 STR while alive.' },
  { name: 'Bopca General', species: 'bopca_protectorate', str: 3, int: 3, con: 4, dex: 2, hp: 32, abilities: ['bombardment', 'fortify', 'conscript'], passive: 'bureaucratic_shield', desc: 'Takes 30% less damage from first attack each turn.' },
  { name: 'Valtay Mindlord', species: 'valtay', str: 1, int: 5, con: 2, dex: 3, hp: 20, abilities: ['mind_shatter', 'puppeteer', 'mass_confusion'], passive: 'telepathic_field', desc: 'Can turn your cards against you for 1 turn.' },
  { name: 'Skull Warlord', species: 'skull_empire', str: 5, int: 2, con: 4, dex: 3, hp: 30, abilities: ['death_strike', 'raise_dead', 'bone_wall'], passive: 'undying_legion', desc: 'Killed minions return as 50% HP zombies.' },
  { name: 'Primal Warchief', species: 'primal', str: 5, int: 1, con: 5, dex: 3, hp: 34, abilities: ['berserker_slam', 'war_cry', 'blood_frenzy'], passive: 'rage_escalation', desc: 'Gains +10 STR every turn.' },
  { name: 'Hive Overmind', species: 'hive_mind', str: 2, int: 5, con: 3, dex: 2, hp: 24, abilities: ['spawn_swarm', 'adaptive_armor', 'neural_link'], passive: 'adaptation', desc: 'Immune to the same ability used twice in a row.' },
];

// Floor 12: The Ascendency Game — alien leaders who stole god bodies
const FLOOR_12_ASCENDED = [
  { name: 'Kua-Tin God-Emperor', species: 'kua_tin', str: 4, int: 5, con: 5, dex: 3, hp: 50, abilities: ['divine_flood', 'crush_will', 'ocean_prison', 'godly_regenerate'], passive: 'stolen_divinity', desc: 'Heals 20 HP per turn. Immune to stun.', isBoss: true },
  { name: "Bopca Hive-God", species: 'bopca_protectorate', str: 4, int: 4, con: 6, dex: 3, hp: 56, abilities: ['swarm_of_gods', 'divine_protocol', 'absolute_order', 'smite'], passive: 'divine_bureaucracy', desc: 'Cannot be damaged for 1 turn after taking >50 dmg.', isBoss: true },
  { name: 'Valtay Dream-Eater', species: 'valtay', str: 3, int: 7, con: 4, dex: 4, hp: 40, abilities: ['nightmare_realm', 'soul_siphon', 'rewrite_reality', 'psychic_storm'], passive: 'reality_warp', desc: 'Randomly swaps one of your card stats each turn.', isBoss: true },
  { name: 'Skull God of Death', species: 'skull_empire', str: 6, int: 3, con: 5, dex: 3, hp: 52, abilities: ['death_sentence', 'corpse_explosion', 'bone_throne', 'reap'], passive: 'death_aura', desc: 'All your cards lose 5 HP per turn.', isBoss: true },
  { name: 'Primal World-Breaker', species: 'primal', str: 7, int: 1, con: 7, dex: 3, hp: 60, abilities: ['world_smash', 'primal_roar', 'earthquake', 'devour_god'], passive: 'unstoppable', desc: 'Cannot be stunned, confused, or debuffed.', isBoss: true },
  { name: 'Hive God-Nexus', species: 'hive_mind', str: 3, int: 6, con: 5, dex: 4, hp: 48, abilities: ['spawn_divine_swarm', 'assimilate', 'hive_storm', 'evolve'], passive: 'infinite_adaptation', desc: 'Gains immunity to last damage type received.', isBoss: true },
];

function getSyndicateEnemies(floor) {
  if (floor === 3) return { mobs: FLOOR_3_MOBS, elites: FLOOR_3_ELITES, boss: FLOOR_3_BOSS };
  if (floor === 6) return FLOOR_6_HUNTERS;
  if (floor === 9) return FLOOR_9_COMMANDERS;
  if (floor === 12) return FLOOR_12_ASCENDED;
  return null;
}

function makeEnemyCard(template, floor = 3) {
  // Deeper floors make their enemies tougher so leveled crawlers don't faceroll them.
  // Kept moderate so the deepest floors stay hard-but-winnable (not a wall).
  const strBonus = Math.min(4, Math.floor(floor / 3));   // +1 by floor 3, +2 by 6, +3 by 9, +4 by 12
  const hpBonus = Math.round((template.hp || 12) * (floor >= 9 ? 0.3 : floor >= 6 ? 0.25 : 0.1));
  return {
    name: template.name,
    species: template.species,
    str: (template.str || 2) + strBonus,
    int: template.int || 2,
    con: (template.con || 3) + Math.floor(floor / 4),
    dex: template.dex || 3,
    currentHP: (template.hp || 12) + hpBonus,
    maxHP: (template.hp || 12) + hpBonus,
    abilities: template.abilities,
    passive: template.passive,
    desc: template.desc,
    isBoss: template.isBoss || false,
    isElite: template.isElite || false,
    cost: template.isBoss ? 5 : template.isElite ? 4 : 2,
  };
}

module.exports = { SYNDICATE_SPECIES, FLOOR_3_MOBS, FLOOR_3_ELITES, FLOOR_3_BOSS, FLOOR_6_HUNTERS, FLOOR_9_COMMANDERS, FLOOR_12_ASCENDED, getSyndicateEnemies, makeEnemyCard };
