// God Cards - Timed summons with intended + random chaos effects
const { random: rng } = require('./rng');
const mobData = require('../../data/mobs.json');

const GODS = mobData.gods;

const CHAOS_EFFECTS = [
  { name: 'Friendly Fire', effect: 'damage_random_ally_3', description: 'A random ally takes 3 damage' },
  { name: 'Gift of Pain', effect: 'damage_all_2', description: 'ALL units take 2 damage' },
  { name: 'Shuffle', effect: 'randomize_board', description: 'All board positions randomized' },
  { name: 'Tax', effect: 'lose_mana_2', description: 'You lose 2 mana next turn' },
  { name: 'Blessing in Disguise', effect: 'heal_enemy_5', description: 'Enemy heals 5 HP' },
  { name: 'Divine Whim', effect: 'swap_random_stats', description: 'A random card swaps ATK/HP' },
  { name: 'Temporal Hiccup', effect: 'skip_draw', description: 'You skip your next draw' },
  { name: 'Bounty', effect: 'enemy_draws_2', description: 'Enemy draws 2 extra cards' },
];

function createGodCard(godName) {
  const god = GODS.find(g => g.name === godName);
  if (!god) return null;

  const chaosEffect = CHAOS_EFFECTS[Math.floor(rng() * CHAOS_EFFECTS.length)];

  return {
    id: `god_${god.name.toLowerCase().replace(/\s/g, '_')}`,
    name: god.name,
    title: `God of ${god.domain}`,
    type: 'god',
    cost: 5,
    turnsRemaining: 3,
    emoji: '⚡',
    domain: god.domain,
    boon: god.boon,
    boonDescription: describeBoon(god.boon),
    chaosEffect,
    chaosRevealed: false,
    canBeEjected: true, // via Laundry Day
    personality: `You are ${god.name}, a god of ${god.domain} sponsoring a dungeon crawler. You are capricious, powerful, and mildly amused by mortals. You speak in 1 grandiose sentence. Reference your domain.`,
  };
}

function describeBoon(boon) {
  const map = {
    fire_damage_buff: 'All allies deal +2 fire damage',
    attack_buff_all: 'All allies gain +2 attack',
    revive_one: 'Revive one dead ally at 1 HP',
    gold_bonus: 'Double gold from this battle',
    bind_strongest_enemy: 'Strongest enemy cannot attack for 2 turns',
    armor_all: 'All allies gain +3 health',
    heal_all_5: 'Heal all allies for 5',
    extra_turn: 'You get an extra turn immediately',
  };
  return map[boon] || boon;
}

function applyBoon(boon, battleState) {
  const effects = [];
  switch (boon) {
    case 'fire_damage_buff':
      battleState.player.board.forEach(c => { c.str += 2; effects.push(`${c.name} +2 ATK`); });
      break;
    case 'attack_buff_all':
      battleState.player.board.forEach(c => { c.str += 2; effects.push(`${c.name} +2 ATK`); });
      break;
    case 'armor_all':
      battleState.player.board.forEach(c => { c.currentHP = Math.min(c.maxHP, c.currentHP + 3); c.maxHP += 3; effects.push(`${c.name} +3 HP`); });
      break;
    case 'heal_all_5':
      battleState.player.board.forEach(c => { c.currentHP = Math.min(c.maxHP, c.currentHP + 5); effects.push(`${c.name} healed`); });
      break;
    case 'bind_strongest_enemy':
      const strongest = [...battleState.enemy.board].sort((a, b) => (b.str||0) - (a.str||0))[0];
      if (strongest) { strongest.canAttack = false; strongest.bound = 2; effects.push(`${strongest.name} bound`); }
      break;
    case 'extra_turn':
      effects.push('Extra turn granted!');
      break;
    case 'gold_bonus':
      effects.push('Gold doubled this battle');
      break;
    case 'revive_one':
      if (battleState.player.graveyard.length > 0) {
        const revived = battleState.player.graveyard.pop();
        revived.currentHP = 1;
        revived.canAttack = false;
        battleState.player.board.push(revived);
        effects.push(`${revived.name} revived!`);
      }
      break;
  }
  return effects;
}

function applyChaos(chaosEffect, battleState) {
  const effects = [];
  switch (chaosEffect.effect) {
    case 'damage_random_ally_3':
      if (battleState.player.board.length) {
        const t = battleState.player.board[Math.floor(rng() * battleState.player.board.length)];
        t.currentHP -= 3; effects.push(`${t.name} took 3 chaos damage!`);
      }
      break;
    case 'damage_all_2':
      [...battleState.player.board, ...battleState.enemy.board].forEach(c => { c.currentHP -= 2; });
      effects.push('All units take 2 damage!');
      break;
    case 'heal_enemy_5':
      battleState.enemy.board.forEach(e => { e.currentHP = Math.min(e.maxHP, e.currentHP + 5); }); effects.push('Enemies healed 5!');
      break;
    case 'swap_random_stats':
      const all = [...battleState.player.board, ...battleState.enemy.board];
      if (all.length) { const c = all[Math.floor(rng() * all.length)]; [c.str, c.currentHP] = [c.currentHP, c.str]; effects.push(`${c.name} stats swapped!`); }
      break;
    case 'lose_mana_2':
      battleState.player.mana = Math.max(0, battleState.player.mana - 2); effects.push('Lost 2 mana!');
      break;
    case 'enemy_draws_2':
      effects.push('Enemy draws 2 extra!');
      break;
    default:
      effects.push(chaosEffect.description);
  }
  return effects;
}

function ejectGodSponsor(godCard) {
  godCard.chaosEffect = null;
  godCard.canBeEjected = false;
  return `${godCard.name}'s sponsor ejected! Chaos effect removed.`;
}

module.exports = { createGodCard, applyBoon, applyChaos, ejectGodSponsor, GODS };
