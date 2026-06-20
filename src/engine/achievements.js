// Achievements system - persistent milestones with boon rewards
const ACHIEVEMENTS = [
  { id: 'first_win', name: 'First Blood', desc: 'Win your first battle', check: s => s.stats.wins >= 1, boon: 'gold_50' },
  { id: 'floor_2', name: 'Going Deeper', desc: 'Reach floor 2', check: s => s.floor >= 2, boon: 'card_unlock' },
  { id: 'floor_3', name: 'Into the Dark', desc: 'Reach floor 3', check: s => s.floor >= 3, boon: 'card_unlock' },
  { id: 'floor_5', name: 'The Deep End', desc: 'Reach floor 5', check: s => s.floor >= 5, boon: 'legendary_box' },
  { id: 'rapport_80', name: 'True Bond', desc: 'Reach 80 rapport with any card', check: s => Object.values(s.rapport || {}).some(r => r >= 80), boon: 'rapport_boost_all' },
  { id: 'ten_wins', name: 'Veteran Crawler', desc: 'Win 10 battles', check: s => s.stats.wins >= 10, boon: 'gold_200' },
  { id: 'collect_15', name: 'Collector', desc: 'Own 15 cards', check: s => (s.collection || []).length >= 15, boon: 'card_unlock' },
  { id: 'level_5', name: 'Maxed Out', desc: 'Get a card to level 5', check: s => Object.values(s.cardLevels || {}).some(l => l >= 5), boon: 'legendary_box' },
  { id: 'boss_kill', name: 'Boss Slayer', desc: 'Defeat a boss', check: s => (s.stats.bossKills || 0) >= 1, boon: 'gold_100' },
  { id: 'changelings_3', name: 'Paranoid', desc: 'Expose 3 changelings', check: s => (s.stats.changelingsCaught || 0) >= 3, boon: 'card_unlock' },
  { id: 'no_deaths_floor', name: 'Untouchable', desc: 'Clear a floor with no card deaths', check: s => (s.stats.flawlessFloors || 0) >= 1, boon: 'epic_box' },
  { id: 'explosives_master', name: 'Boom! Achievement', desc: 'Use 10 explosives total', check: s => (s.stats.explosivesUsed || 0) >= 10, boon: 'gold_150' },
  // Funny/snarky achievements
  { id: 'self_smoke', name: 'Tactical Genius', desc: 'Use a smoke bomb when no enemies are on the field. Bold strategy.', check: s => (s.stats.selfSmoke || 0) >= 1, boon: 'gold_10' },
  { id: 'all_die_turn1', name: 'Speedrun (Wrong Direction)', desc: 'Lose all cards on turn 1. The audience loved it though.', check: s => (s.stats.totalWipeTurn1 || 0) >= 1, boon: 'gold_25' },
  { id: 'overkill_100', name: 'That Was Already Dead', desc: 'Deal 100+ overkill damage to a single enemy. It had a family.', check: s => (s.stats.maxOverkill || 0) >= 100, boon: 'gold_50' },
  { id: 'hoard_10', name: 'Dragon Syndrome', desc: 'Have 10+ items in inventory and use none of them. You know those are for using, right?', check: s => (s.stats.maxHoardSize || 0) >= 10, boon: 'gold_25' },
  { id: 'talk_enemy', name: 'Negotiator', desc: 'Try to have a conversation with an enemy card. They didn\'t respond. Obviously.', check: s => (s.stats.talkedToEnemy || 0) >= 1, boon: 'gold_10' },
  { id: 'donut_solo', name: 'Main Character Energy', desc: 'Win a battle with only Donut on the board. She\'ll never let you forget this.', check: s => (s.stats.donutSoloWin || 0) >= 1, boon: 'gold_100' },
  { id: 'mongo_devour_boss', name: 'Mongo Hungry', desc: 'Devour a boss with Mongo. That was a 200HP creature and he just... ate it.', check: s => (s.stats.mongoDevourBoss || 0) >= 1, boon: 'legendary_box' },
  { id: 'cockroach_3', name: 'Why Won\'t You Die', desc: 'Trigger Cockroach 3 times across battles. Carl is too stubborn for death.', check: s => (s.stats.cockroachCount || 0) >= 3, boon: 'gold_75' },
  { id: 'full_hand', name: 'Analysis Paralysis', desc: 'End a turn with 8 cards in hand and 0 on the board. Just... pick one.', check: s => (s.stats.fullHandNoPlay || 0) >= 1, boon: 'gold_10' },
  { id: 'first_evolution', name: 'MAXIMUM POWER', desc: 'Evolve a card for the first time. The audience went NUTS.', check: s => (s.evolutions || []).length >= 1, boon: 'gold_100' },
  { id: 'fan_disco', name: 'Studio 54', desc: 'Trigger a DISCO ROUND. Everything went sparkly. Nobody knows why.', check: s => (s.stats.discoCount || 0) >= 1, boon: 'gold_25' },
  { id: 'five_items_one_turn', name: 'Shopping Spree', desc: 'Use 5 items from inventory in one battle. Retail therapy in a dungeon.', check: s => (s.stats.maxItemsOneBattle || 0) >= 5, boon: 'gold_50' },
];

function checkAchievements(saveData) {
  if (!saveData.achievements) saveData.achievements = [];
  const newlyUnlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (saveData.achievements.includes(ach.id)) continue;
    if (ach.check(saveData)) {
      saveData.achievements.push(ach.id);
      newlyUnlocked.push(ach);
    }
  }
  return newlyUnlocked;
}

function applyBoon(boon, saveData) {
  switch (boon) {
    case 'gold_50': saveData.gold += 50; break;
    case 'gold_100': saveData.gold += 100; break;
    case 'gold_150': saveData.gold += 150; break;
    case 'gold_200': saveData.gold += 200; break;
    case 'card_unlock': break; // handled separately
    case 'rapport_boost_all':
      for (const k of Object.keys(saveData.rapport || {})) saveData.rapport[k] = Math.min(100, saveData.rapport[k] + 10);
      break;
    case 'legendary_box': case 'epic_box': break; // generate box
  }
}

module.exports = { ACHIEVEMENTS, checkAchievements, applyBoon };
