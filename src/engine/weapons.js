// Weapon definitions — each weapon defines what the "free attack" does
// Categories: base_weapon (replaces stack), sentient (board entity), ability_adder (adds mana ability)

const WEAPONS = {
  // === COMMON (increase free attack damage) ===
  slingshot: {
    id: 'slingshot', name: 'Slingshot', rarity: 'common', type: 'base_weapon',
    desc: 'Simple but effective. David vs Goliath energy.',
    freeAttack: { baseDamage: 3, damageType: 'physical', scaling: 'str', scaleFactor: 6, special: null },
  },
  carls_crowbar: {
    id: 'carls_crowbar', name: "Carl's Crowbar", rarity: 'uncommon', type: 'base_weapon',
    desc: 'The original. Bent but unbroken.',
    freeAttack: { baseDamage: 4, damageType: 'physical', scaling: 'str', scaleFactor: 5, special: null, bonusPct: 0.3 },
  },
  toad_cudgel: {
    id: 'toad_cudgel', name: 'Toad Cudgel', rarity: 'uncommon', type: 'base_weapon',
    desc: 'A warty club that secretes hallucinogenic slime.',
    freeAttack: { baseDamage: 4, damageType: 'physical', scaling: 'str', scaleFactor: 6, special: 'confuse', confuseChance: 0.2 },
  },
  xistera: {
    id: 'xistera', name: 'Xistera', rarity: 'rare', type: 'base_weapon',
    desc: 'A curved basket-scoop for hurling projectiles at incredible speed.',
    freeAttack: { baseDamage: 4, damageType: 'physical', scaling: 'dex', scaleFactor: 5, special: null },
  },

  // === RARE (replace free attack with special mechanics) ===
  shuriken_of_bloodlust: {
    id: 'shuriken_of_bloodlust', name: 'Enchanted Shuriken of Bloodlust', rarity: 'rare', type: 'base_weapon',
    desc: 'Throwing stars that hunger for blood and return to the wielder.',
    freeAttack: { baseDamage: 4, damageType: 'physical', scaling: 'dex', scaleFactor: 5, special: 'multi_hit', hits: 2, breakChance: 0.1 },
  },
  riot_baton: {
    id: 'riot_baton', name: 'Enchanted Shade Gnoll Riot Baton', rarity: 'rare', type: 'base_weapon',
    desc: 'Standard-issue crowd control for dungeon security forces.',
    freeAttack: { baseDamage: 3, damageType: 'physical', scaling: 'str', scaleFactor: 6, special: 'stun', stunChance: 0.3 },
  },
  left_fang: {
    id: 'left_fang', name: 'Left Fang of the Green Sultan', rarity: 'legendary', type: 'base_weapon',
    desc: 'One of a pair of legendary serpent fangs dripping with venom.',
    freeAttack: { baseDamage: 5, damageType: 'poison', scaling: 'str', scaleFactor: 4, special: 'poison_dot', dotDmg: 2, dotTurns: 3 },
  },

  // === EPIC (add new mana ability to card) ===
  war_gauntlet: {
    id: 'war_gauntlet', name: 'Enchanted War Gauntlet of the Exalted Grull', rarity: 'epic', type: 'ability_adder',
    desc: 'A massive armored fist that crackles with ancient power.',
    addsAbility: { id: 'grull_smash', name: 'Grull Smash', cost: 3, type: 'physical', target: 'single', calc: (c) => 5 + Math.floor(c.str / 2), special: 'stun' },
  },
  repeating_crossbow: {
    id: 'repeating_crossbow', name: 'Enchanted Repeating Crossbow of the Scavenger Mother', rarity: 'epic', type: 'base_weapon',
    desc: 'Fires bolts endlessly without reloading.',
    freeAttack: { baseDamage: 4, damageType: 'physical', scaling: 'dex', scaleFactor: 5, special: 'female_bonus', bonusPerFemale: 0.5 },
  },
  fang_caps: {
    id: 'fang_caps', name: 'Enchanted Fang Caps of the Expectorating Tizheruk', rarity: 'epic', type: 'base_weapon',
    desc: 'Teeth caps that let you spit corrosive acid.',
    freeAttack: { baseDamage: 4, damageType: 'poison', scaling: 'str', scaleFactor: 5, special: null, bonusPct: 0.5 },
  },

  // === LEGENDARY (sentient weapons — occupy board slot) ===
  velma: {
    id: 'velma', name: 'Velma the Flamethrower', rarity: 'legendary', type: 'sentient',
    desc: 'A sentient flamethrower that whispers encouragement while incinerating things.',
    entityStats: { str: 7, int: 1, con: 3, dex: 5, hp: 1, abilities: ['flame_spray'] },
    personality: 'You are Velma, a sentient flamethrower. You love burning things and whisper encouragement. 1-2 sentences max.',
  },
  spunky_jefferson: {
    id: 'spunky_jefferson', name: 'Spunky Jefferson the Enchanted Nickel Sock of the Elderly Miser', rarity: 'legendary', type: 'sentient',
    desc: 'A sock full of nickels that hits surprisingly hard and steals gold.',
    entityStats: { str: 6, int: 1, con: 3, dex: 7, hp: 1, abilities: ['sock_whack'] },
    personality: 'You are Spunky Jefferson, a sentient sock full of nickels. You hit hard and steal shiny things. 1-2 sentences.',
  },
};

// Stuffed Figure variants (summoned minions from inventory)
const STUFFED_FIGURES = {
  slizzer: { name: 'Slizzer', rarity: 'uncommon', attack: 25, hp: 30, special: null, desc: 'Does moderate attack damage' },
  green_slizzer: { name: 'Green Variant Slizzer', rarity: 'rare', attack: 25, hp: 30, special: 'poison_dot', desc: 'Same damage as Slizzer + poison' },
  slate_butterfly: { name: 'Slate Butterfly', rarity: 'uncommon', attack: 0, hp: 20, special: 'blind_enemies', desc: 'Darkens enemy area, reducing accuracy' },
  grulke_infantry: { name: 'Grulke Infantry', rarity: 'common', attack: 15, hp: 20, special: null, desc: 'Does small attack damage' },
  sage_sprite: { name: 'Sage Sprite', rarity: 'legendary', attack: 0, hp: 10, special: 'teach_skill', desc: 'Teaches a card a random new permanent skill' },
  crane_crasher: { name: 'Crane Crasher', rarity: 'rare', attack: 20, hp: 25, special: 'disorient', desc: 'Sonic attack disorients the enemy' },
};

// Donut's Tiara variants
const TIARAS = {
  thousand_lights: { name: 'The Tiara of a Thousand Lights', rarity: 'celestial', effect: 'absorb_hats', desc: 'Automatically adds effects of any other hat-based items the party has or will get' },
  sepsis_whore: { name: 'Enchanted Crown of the Sepsis Whore', rarity: 'unique', effect: 'stat_boost', cha: 5, int: 5, desc: '+5 CHA and INT' },
  inebriated_dragonfly: { name: 'Enchanted Tiara of the Inebriated Dragonfly', rarity: 'epic', effect: 'hover', desc: 'Hover passive — makes wearer hard to hit' },
  mana_genita: { name: 'Enchanted Tiara of Mana Genita', rarity: 'epic', effect: 'reveal_hand', desc: "Makes AI's cards in hand visible while worn" },
};

// Calculate free attack damage for a card with a weapon (1-10 stat scale)
function calcFreeAttackDamage(card, weapon, battle) {
  const stat0 = card.str || 3;
  if (!weapon?.freeAttack) return Math.max(2, stat0); // bare fist = STR
  const fa = weapon.freeAttack;
  const stat = card[fa.scaling] || card.str || 3;
  let dmg = (fa.baseDamage || 2) + stat; // weapon base + the scaling stat (raw, 1-10 scale)
  if (fa.bonusPct) dmg = Math.floor(dmg * (1 + fa.bonusPct));
  // Female bonus (Repeating Crossbow)
  if (fa.special === 'female_bonus' && battle) {
    const females = battle.board.player.filter(c => ['donut', 'katia', 'imani', 'odette', 'hekla'].includes((c.id || '').split(/[-_]/)[0]));
    dmg = Math.floor(dmg * (1 + Math.min(5, females.length) * fa.bonusPerFemale));
  }
  return Math.max(2, dmg);
}

function getWeapon(weaponId) { return WEAPONS[weaponId] || null; }

module.exports = { WEAPONS, STUFFED_FIGURES, TIARAS, calcFreeAttackDamage, getWeapon };
