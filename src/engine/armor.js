// Armor definitions — provides damage reduction, not stat buffs

const ARMOR = {
  goblin_chainmail: { id: 'goblin_chainmail', name: 'Goblin Chainmail', rarity: 'common', flatReduction: 2, special: null, desc: 'Rusty but functional.' },
  bugbear_hide_vest: { id: 'bugbear_hide_vest', name: 'Bugbear Hide Vest', rarity: 'uncommon', flatReduction: 3, special: null, desc: 'Thick and smelly but protective.' },
  hobgoblin_shield: { id: 'hobgoblin_shield', name: 'Hobgoblin Shield', rarity: 'uncommon', flatReduction: 4, special: null, desc: 'Standard-issue dungeon shield.' },
  shade_gnoll_cloak: { id: 'shade_gnoll_cloak', name: 'Shade Gnoll Cloak', rarity: 'rare', flatReduction: 2, special: 'dodge', dodgeChance: 0.2, dexBonus: 2, desc: 'Dark cloak — 20% dodge.' },
  patch_of_thorns: { id: 'patch_of_thorns', name: 'Patch of Thorns', rarity: 'rare', flatReduction: 2, special: 'thorns', thornsDmg: 4, desc: 'Attackers take 4 damage.' },
  ring_of_lifesteal: { id: 'ring_of_lifesteal', name: 'Ring of Lifesteal', rarity: 'epic', flatReduction: 0, special: 'lifesteal', lifestealPct: 0.5, desc: 'Heals 50% of damage dealt.' },
  velvet_slippers: { id: 'velvet_slippers', name: 'Velvet Slippers of the Dancer', rarity: 'epic', flatReduction: 0, special: 'first_strike', dexBonus: 4, desc: '+40 DEX + first strike.' },
  ring_of_mana: { id: 'ring_of_mana', name: 'Ring of Mana Regen', rarity: 'uncommon', flatReduction: 0, special: 'mana_regen', manaPerTurn: 1, desc: '+1 mana per turn.' },
  crawlers_charm: { id: 'crawlers_charm', name: "Crawler's Lucky Charm", rarity: 'common', flatReduction: 0, special: 'loot_quality', lootBonus: 0.1, desc: '+10% loot quality.' },
  amulet_audience: { id: 'amulet_audience', name: 'Amulet of the Audience', rarity: 'rare', flatReduction: 0, special: 'favor_double', chaBonus: 3, desc: '+30 CHA + double favor gains.' },
  anarchists_cookbook: { id: 'anarchists_cookbook', name: "Dungeon Anarchist's Cookbook", rarity: 'celestial', flatReduction: 0, special: 'crafting', desc: 'Enables crafting: combine 2 items each turn.' },
  borant_badge: { id: 'borant_badge', name: 'Borant Corp Employee Badge', rarity: 'common', flatReduction: 0, special: 'undo', desc: 'Adds Undo button — reverses AI last action once.' },
};

function getArmor(armorId) { return ARMOR[armorId] || null; }

// Apply armor damage reduction to incoming damage
function applyArmorReduction(damage, card) {
  const armor = card.equippedArmor;
  if (!armor) return damage;
  // Dodge check
  if (armor.special === 'dodge' && Math.random() < (armor.dodgeChance || 0)) return 0;
  // Flat reduction
  return Math.max(1, damage - (armor.flatReduction || 0));
}

module.exports = { ARMOR, getArmor, applyArmorReduction };
