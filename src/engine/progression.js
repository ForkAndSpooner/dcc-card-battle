// Progression: leveling + loot boxes for v4 engine
const { random: rng } = require('./rng');
const itemData = require('../../data/items.json');

const XP_THRESHOLDS = [0, 20, 50, 100, 160, 230, 310, 400, 500, 620];

function xpForLevel(level) { return XP_THRESHOLDS[Math.min(level - 1, XP_THRESHOLDS.length - 1)]; }
function levelForXP(xp) {
  let lvl = 1;
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) { lvl = i + 1; break; }
  }
  return lvl;
}

// Calculate post-battle XP and level-ups
function calcProgression(battle, saveData) {
  const { shouldEvolve } = require('./evolution');
  const results = { xpGains: [], levelUps: [], evolutions: [], deaths: [] };
  const survivors = [...battle.board.player, ...battle.hand.player, ...battle.deck.player];

  for (const card of survivors) {
    const baseId = (card.id || '').split(/[-_]/)[0];
    if (!baseId) continue;
    // XP: participation bonus + kill bonus, but capped per battle to prevent snowballing
    const rawXP = 8 + (card.killCount || 0) * 4;
    const maxXPPerBattle = 20 + battle.floor * 5; // floor 1: cap 25, floor 9: cap 65
    const xp = Math.min(rawXP, maxXPPerBattle);
    if (!saveData.cardXP) saveData.cardXP = {};
    const oldXP = saveData.cardXP[baseId] || 0;
    const newXP = oldXP + xp;
    saveData.cardXP[baseId] = newXP;
    results.xpGains.push({ id: baseId, name: card.name, xp });

    const oldLvl = levelForXP(oldXP);
    const newLvl = levelForXP(newXP);
    if (newLvl > oldLvl) {
      if (!saveData.cardLevels) saveData.cardLevels = {};
      saveData.cardLevels[baseId] = newLvl;
      results.levelUps.push({ id: baseId, name: card.name, from: oldLvl, to: newLvl });
      // Ability unlock at level 3 and 5
      const { ABILITIES } = require('./battle');
      const cardAbilities = card.abilities || [];
      if (newLvl === 3 && cardAbilities.length >= 2) {
        // Unlock a bonus ability: first unused ability from a related pool
        const bonusAbilityPools = {
          carl: 'fear_spell', donut: 'clockwork_triplicate', mongo: 'devour',
          hekla: 'shadow_strike', katia: 'crowd_blast', imani: 'shield_wall',
          mordecai: 'mordecai_brew', bautista: 'plushie_swarm', li_jun: 'flying_kick',
          li_na: 'chain_attack', florin: 'headshot', louis: 'cloud_of_exhaust',
        };
        const bonus = bonusAbilityPools[baseId];
        if (bonus && ABILITIES[bonus] && !cardAbilities.includes(bonus)) {
          if (!saveData.unlockedAbilities) saveData.unlockedAbilities = {};
          if (!saveData.unlockedAbilities[baseId]) saveData.unlockedAbilities[baseId] = [];
          if (!saveData.unlockedAbilities[baseId].includes(bonus)) {
            saveData.unlockedAbilities[baseId].push(bonus);
            results.abilityUnlocks = results.abilityUnlocks || [];
            results.abilityUnlocks.push({ id: baseId, name: card.name, ability: ABILITIES[bonus].name, level: 3 });
          }
        }
      }
      if (newLvl === 5) {
        // Unlock a stat boost ability
        if (!saveData.unlockedAbilities) saveData.unlockedAbilities = {};
        if (!saveData.unlockedAbilities[baseId]) saveData.unlockedAbilities[baseId] = [];
        const statBoost = 'berserker_rage';
        if (!saveData.unlockedAbilities[baseId].includes(statBoost) && !cardAbilities.includes(statBoost)) {
          saveData.unlockedAbilities[baseId].push(statBoost);
          results.abilityUnlocks = results.abilityUnlocks || [];
          results.abilityUnlocks.push({ id: baseId, name: card.name, ability: 'Power Surge', level: 5 });
        }
      }
      // Check for evolution
      if (shouldEvolve(card, newLvl)) {
        const { getEvolution } = require('./evolution');
        const ev = getEvolution(card.id);
        if (!saveData.evolutions) saveData.evolutions = [];
        if (!saveData.evolutions.includes(baseId)) {
          saveData.evolutions.push(baseId);
          results.evolutions.push({ id: baseId, name: card.name, evolvedId: ev.evolvesTo, announcement: ev.announcement });
        }
      }
    }
  }

  // Dead cards lose a level
  for (const card of battle.graveyard) {
    const baseId = (card.id || '').split(/[-_]/)[0];
    if (!saveData.cardLevels) saveData.cardLevels = {};
    const cur = saveData.cardLevels[baseId] || 1;
    if (cur > 1) { saveData.cardLevels[baseId] = cur - 1; results.deaths = results.deaths || []; results.deaths.push({ id: baseId, name: card.name }); }
  }

  return results;
}

// Loot box generation
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'celestial'];
// Canon box tiers (ascending): Bronze → Silver → Gold → Platinum → Legendary → Celestial
const TIER_MIN_RARITY = { bronze: 0, silver: 0, gold: 1, platinum: 2, legendary: 3, celestial: 4 };
const TIER_ITEMS = { bronze: 2, silver: 3, gold: 3, platinum: 4, legendary: 4, celestial: 5 };
const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'legendary', 'celestial'];

function rollLootBox(tier = 'silver') {
  const minR = TIER_MIN_RARITY[tier] ?? 0;
  const numItems = TIER_ITEMS[tier] ?? 2;
  
  // Load master items database
  const master = require('../../data/items-master.json');
  const pools = { common: [], uncommon: [], rare: [], epic: [], legendary: [], celestial: [] };
  
  // Pool all non-exclusive items from master DB
  const allItems = [...master.weapons, ...master.potions, ...master.scrolls_tomes, ...master.plushies, ...master.tools, ...master.food_drugs, ...master.materials]
    .filter(i => !i.exclusive_to); // Don't drop character-exclusive items randomly
  for (const item of allItems) {
    const r = item.rarity || 'common';
    if (pools[r]) pools[r].push({ ...item, effect: item.effect || item.lore });
  }
  // Also include old items for backward compat
  for (const w of itemData.weapons.filter(w => !allItems.find(m => m.name === w.name))) pools[w.rarity]?.push({ ...w, slot: 'weapon' });
  for (const p of itemData.potions.filter(p => !allItems.find(m => m.name === p.name))) pools[p.rarity]?.push({ ...p, slot: 'consumable' });
  for (const e of (itemData.explosives||[]).filter(x => !allItems.find(m => m.name === x.name))) pools[e.rarity]?.push({ ...e, slot: 'consumable' });

  const items = [];
  for (let i = 0; i < numItems; i++) {
    const rIdx = Math.min(RARITY_ORDER.length - 1, minR + Math.floor(rng() * 2));
    const pool = pools[RARITY_ORDER[rIdx]];
    if (pool && pool.length) items.push(pool[Math.floor(rng() * pool.length)]);
  }

  // Box type from master data
  const BOX_NAMES = {
    boss_kill: 'Boss Box', quest_complete: 'Quest Box', leveling: 'Adventurer Box',
    viewer_milestones: 'Fan Box', sponsor_favor: 'Benefactor Box',
    pet_actions: 'Pet Box', foot_kills: 'Spicy Box', being_a_jerk: "Asshole's Box"
  };
  const boxName = BOX_NAMES[tier] || ({
    celestial: 'Celestial Box', legendary: 'Legendary Box', platinum: 'Platinum Box',
    gold: 'Gold Box', silver: 'Silver Box', bronze: 'Bronze Box',
  }[tier] || 'Bronze Box');
  return { tier, boxName, items };
}

// Contextual box roller — determines box type from game events
function rollContextualBox(context) {
  if (context === 'boss') return rollLootBox(rng() < 0.25 ? 'celestial' : 'legendary');
  if (context === 'elite') return rollLootBox(rng() < 0.3 ? 'platinum' : 'gold');
  if (context === 'mob') return rollLootBox(rng() < 0.3 ? 'silver' : 'bronze');
  if (context === 'quest') return rollLootBox(rng() < 0.3 ? 'legendary' : 'platinum');
  if (context === 'viewer') return rollLootBox(rng() < 0.15 ? 'platinum' : 'gold');
  if (context === 'sponsor') return rollLootBox('platinum');
  return rollLootBox('silver');
}

function tierForFloor(floor, isBoss) {
  if (isBoss) {
    if (floor >= 9) return 'celestial';
    if (floor >= 6) return rng() < 0.4 ? 'celestial' : 'legendary';
    if (floor >= 4) return 'legendary';
    if (floor >= 2) return 'platinum';
    return 'gold';
  }
  if (floor >= 7) return 'platinum';
  if (floor >= 4) return 'gold';
  if (floor >= 2) return 'silver';
  return 'bronze';
}

module.exports = { calcProgression, rollLootBox, rollContextualBox, tierForFloor, levelForXP, xpForLevel, XP_THRESHOLDS, TIER_ORDER };
