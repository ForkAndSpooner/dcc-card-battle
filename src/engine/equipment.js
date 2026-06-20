// Equipment system - equip weapons/armor/accessories to cards
function equipItem(card, item) {
  if (!card.equipment) card.equipment = {};
  const slot = item.slot === 'weapon' ? 'weapon' : item.slot === 'armor' ? 'armor' : 'accessory';
  const old = card.equipment[slot];
  card.equipment[slot] = item;

  // Apply stat changes
  if (slot === 'weapon') card.attack += (item.attackBonus || 0) - (old?.attackBonus || 0);
  if (slot === 'armor') { card.health += (item.healthBonus || 0) - (old?.healthBonus || 0); card.maxHealth = card.health; }

  return old; // return unequipped item (goes back to inventory)
}

function unequipItem(card, slot) {
  if (!card.equipment?.[slot]) return null;
  const item = card.equipment[slot];
  delete card.equipment[slot];
  if (slot === 'weapon') card.attack -= (item.attackBonus || 0);
  if (slot === 'armor') { card.health -= (item.healthBonus || 0); card.maxHealth = card.health; }
  return item;
}

function getEquipmentSummary(card) {
  if (!card.equipment) return '';
  const parts = [];
  if (card.equipment.weapon) parts.push(`⚔️ ${card.equipment.weapon.name}`);
  if (card.equipment.armor) parts.push(`🛡️ ${card.equipment.armor.name}`);
  if (card.equipment.accessory) parts.push(`💍 ${card.equipment.accessory.name}`);
  return parts.join(' | ');
}

module.exports = { equipItem, unequipItem, getEquipmentSummary };
