// Quest/Trial System - special battle conditions with bonus rewards
const QUESTS = [
  {
    id: 'survive_5',
    name: 'Endurance Trial',
    description: 'Survive 5 turns without losing a card',
    condition: (state, log) => {
      return state.turnNumber >= 5 && state.player.graveyard?.length === 0;
    },
    reward: { boxType: 'Survivor\'s Box', goldBonus: 30 },
  },
  {
    id: 'voice_only',
    name: 'Commander\'s Trial',
    description: 'Win using only voice commands (no click attacks)',
    condition: (state, log) => {
      // Track in eventLog if any manual attacks happened
      return state.gameOver && state.winner === 'player' && !log.some(e => e.type === 'manual_attack');
    },
    reward: { boxType: 'Talk of the Town Box', goldBonus: 50 },
  },
  {
    id: 'expose_changeling',
    name: 'Identity Crisis',
    description: 'Expose the changeling before turn 4',
    condition: (state, log) => {
      return log.some(e => e.type === 'changeling_exposed' && e.turn < 4);
    },
    reward: { boxType: 'Stranger Danger Box', goldBonus: 40 },
  },
  {
    id: 'no_damage',
    name: 'Flawless Victory',
    description: 'Win without taking any face damage',
    condition: (state, log) => {
      return state.gameOver && state.winner === 'player' && state.player.health >= 30;
    },
    reward: { boxType: 'Lucky Bastard Box', goldBonus: 60 },
  },
  {
    id: 'protect_donut',
    name: 'Royal Guard',
    description: 'Keep Princess Donut alive through the entire battle',
    condition: (state, log) => {
      return state.gameOver && state.winner === 'player' &&
        state.player.board.some(c => c.id?.includes('donut'));
    },
    reward: { boxType: 'Grrl Power Box', goldBonus: 35 },
  },
  {
    id: 'overkill',
    name: 'Excessive Force',
    description: 'Deal 20+ damage in a single turn',
    condition: (state, log) => {
      const turnDmg = {};
      for (const e of log) {
        if (e.type === 'attack' || e.type === 'attack_face') {
          turnDmg[e.turn] = (turnDmg[e.turn] || 0) + (e.dmg || 0);
        }
      }
      return Object.values(turnDmg).some(d => d >= 20);
    },
    reward: { boxType: 'Savage Box', goldBonus: 40 },
  },
  {
    id: 'max_rapport',
    name: 'Best Friends',
    description: 'Reach 80+ rapport with any card during battle',
    condition: (state, log) => {
      return log.some(e => e.type === 'rapport_high');
    },
    reward: { boxType: 'Fan Box', goldBonus: 25 },
  },
  {
    id: 'use_explosives',
    name: 'Boom!',
    description: 'Use 3 explosives in one battle',
    condition: (state, log) => {
      return log.filter(e => e.type === 'use_explosive').length >= 3;
    },
    reward: { boxType: 'Explosives Box', goldBonus: 35 },
  },
];

function getQuestForFloor(floor) {
  // Pick 1 random quest appropriate for the floor
  const available = QUESTS.filter((_, i) => i % 5 <= floor);
  return available[Math.floor(Math.random() * available.length)];
}

function checkQuestComplete(quest, state, eventLog) {
  if (!quest) return false;
  try {
    return quest.condition(state, eventLog);
  } catch { return false; }
}

module.exports = { QUESTS, getQuestForFloor, checkQuestComplete };
