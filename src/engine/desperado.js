// The Desperado Club — between-floor sanctuary (canon: opens on floor 3+).
// Vending machine, weapons/item shop (CHA discounts), and the Wheel of Fortune casino.
const { rollLootBox } = require('./progression');

// Saferoom vending machine — cheap restoratives (canon items)
const VENDING = [
  { id: 'hoop_cola',  name: 'Hoop Cola',  emoji: '🥤', price: 20,  effect: 'heal',      value: 25, desc: 'Fizzy dungeon soda — restores 25 HP to a card.' },
  { id: 'water',      name: 'Bottled Water', emoji: '💧', price: 10, effect: 'heal',     value: 12, desc: 'Just water. Restores 12 HP.' },
  { id: 'warka',      name: 'Warka',      emoji: '🍺', price: 30,  effect: 'buff_str',  value: 2,  desc: 'Dungeon beer — +2 STR to a card this battle (also a little reckless).' },
  { id: 'mana_toast', name: 'Mana Toast', emoji: '🍞', price: 25,  effect: 'mana',      value: 4,  desc: 'A burnt triangle of bread that refills 4 mana. Exclusively mana.' },
  { id: 'crawler_biscuit', name: 'Crawler Biscuit', emoji: '🍪', price: 15, effect: 'heal', value: 15, desc: 'Pet treat. Heals 15 HP and tastes faintly of cardboard.' },
];

// Wheel of Fortune — canon casino (10,000g per spin in books; scaled to game economy).
// Weighted outcomes from jackpot to disaster.
const WHEEL_COST = 250;
const WHEEL_OUTCOMES = [
  { id: 'celestial', weight: 2,  label: '✨ CELESTIAL BOX!',  type: 'box', tier: 'celestial' },
  { id: 'legendary', weight: 6,  label: '🟧 Legendary Box',   type: 'box', tier: 'legendary' },
  { id: 'platinum',  weight: 12, label: '⬜ Platinum Box',     type: 'box', tier: 'platinum' },
  { id: 'gold_coins',weight: 22, label: '💰 500 Gold!',        type: 'gold', value: 500 },
  { id: 'gold',      weight: 18, label: '🟨 Gold Box',         type: 'box', tier: 'gold' },
  { id: 'small_gold',weight: 18, label: '🪙 100 Gold',         type: 'gold', value: 100 },
  { id: 'nothing',   weight: 16, label: '😐 Nothing. House wins.', type: 'nothing' },
  { id: 'death',     weight: 6,  label: '💀 INSTANT DEATH (the wheel is cruel)', type: 'curse' },
];

function listShop(charismaDiscount = 0) {
  // CANON: high Charisma grants shop discounts. discount is a 0..0.5 fraction.
  const disc = Math.max(0, Math.min(0.5, charismaDiscount));
  const apply = (p) => Math.max(1, Math.round(p * (1 - disc)));
  const master = require('../../data/items-master.json');
  const all = [...master.weapons, ...master.potions, ...master.tools, ...master.food_drugs]
    .filter(i => !i.exclusive_to);
  const PRICE_BY_RARITY = { common: 40, uncommon: 90, rare: 200, epic: 450, legendary: 1000, celestial: 3000 };
  // Rotating stock of 6 items
  const stock = [];
  const shuffled = [...all].sort(() => Math.random() - 0.5).slice(0, 6);
  for (const it of shuffled) {
    const base = PRICE_BY_RARITY[it.rarity] || 50;
    stock.push({ id: it.name, name: it.name, rarity: it.rarity || 'common', slot: it.slot, price: apply(base), basePrice: base, lore: it.lore });
  }
  return {
    vending: VENDING.map(v => ({ ...v, price: apply(v.price) })),
    shop: stock,
    wheel: { cost: apply(WHEEL_COST) },
    discountPct: Math.round(disc * 100),
  };
}

// charismaDiscount: best CHA across the player's deck → discount fraction
function chaDiscount(deckCards) {
  const maxCha = Math.max(0, ...(deckCards || []).map(c => c.cha || c.charisma || 0));
  // CHA 1-10 scale: each point above 3 gives ~4% discount, cap 40%
  return Math.max(0, Math.min(0.4, (maxCha - 3) * 0.04));
}

function spinWheel() {
  const total = WHEEL_OUTCOMES.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of WHEEL_OUTCOMES) { if ((r -= o.weight) <= 0) return o; }
  return WHEEL_OUTCOMES[WHEEL_OUTCOMES.length - 1];
}

module.exports = { VENDING, WHEEL_COST, WHEEL_OUTCOMES, listShop, chaDiscount, spinWheel };
