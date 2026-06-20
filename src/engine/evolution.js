// Evolution system — cards transform when they reach a level threshold
// Inspired by Pokemon TCG: the evolved form is a new, stronger card
// with different art, higher stats, and new/upgraded abilities

const EVOLUTIONS = {
  // donut → donut_chonk (already have art + stats)
  donut: {
    evolvesAt: 3,  // level 3+
    evolvesTo: 'donut_chonk',
    announcement: 'Princess Donut reaches MAXIMUM CHONK.',
  },
  // carl → carl_primal (battle-hardened, darker version)
  carl: {
    evolvesAt: 4,
    evolvesTo: 'carl_primal',
    announcement: 'Carl unlocks his Primal class. The crowd goes silent.',
  },
  // mongo → mongo_giant (enormous, almost boss-sized)
  mongo: {
    evolvesAt: 3,
    evolvesTo: 'mongo_giant',
    announcement: 'Mongo has grown. Mongo is VERY BIG NOW.',
  },
  // hekla → hekla_berserker (maxed-out rage)
  hekla: {
    evolvesAt: 4,
    evolvesTo: 'hekla_berserker',
    announcement: 'Hekla enters TRUE Berserker form. The skalds weep.',
  },
};

// Evolved forms — full stat blocks and abilities
const EVOLVED_FORMS = {
  donut_chonk: {
    id: 'donut_chonk', name: 'Donut, Maximum Chonk', emoji: '👑',
    str: 5, int: 9, con: 8, dex: 6, cha: 10, cost: 7,
    abilities: ['magic_missile', 'overcharge', 'decree'],
    keywords: ['battlecry', 'deathrattle', 'taunt'],
    personality: `You are Princess Donut at MAXIMUM POWER. Every sentence is a thunderous declaration. You have reached your true form and the universe knows it.`,
  },
  carl_primal: {
    id: 'carl_primal', name: 'Carl, Primal Crawler', emoji: '⚡',
    str: 8, int: 5, con: 9, dex: 7, cha: 4, cost: 6,
    abilities: ['crowbar_strike', 'jug_o_boom', 'protective_shell'],
    keywords: ['battlecry', 'deathrattle', 'first_strike'],
    personality: `You are Carl with his Primal class fully unlocked. Deadpan but devastating. You've stopped pretending to be a software salesman.`,
  },
  mongo_giant: {
    id: 'mongo_giant', name: 'Mongo, the Mountain', emoji: '🦖',
    str: 10, int: 1, con: 9, dex: 3, cha: 2, cost: 6,
    abilities: ['stomp', 'smash', 'devour'],
    keywords: ['taunt', 'deathrattle'],
    growlOnly: true,
    creatureSounds: { on_play: 'a massive triumphant roar that shakes the entire dungeon', on_attack: 'earth-shattering impact', on_damage: 'a bellow of pure rage', on_death: 'a long, mournful dinosaur cry' },
  },
  hekla_berserker: {
    id: 'hekla_berserker', name: 'Hekla, True Berserker', emoji: '🪓',
    str: 9, int: 2, con: 8, dex: 6, cha: 4, cost: 6,
    abilities: ['frenzy', 'berserker_rage'],
    keywords: ['battlecry', 'deathrattle', 'first_strike', 'cleave'],
    personality: `You are Hekla at maximum power, a true berserker. Each word is shouted. Every enemy is an offering to the gods. You are joy.`,
  },
};

function getEvolution(cardId) {
  const baseId = (cardId || '').split(/[-_]/)[0];
  return EVOLUTIONS[baseId] || null;
}

function getEvolvedForm(evolvedId) {
  return EVOLVED_FORMS[evolvedId] || null;
}

function shouldEvolve(card, newLevel) {
  const ev = getEvolution(card.id);
  return ev && newLevel >= ev.evolvesAt && !card.evolved;
}

module.exports = { EVOLUTIONS, EVOLVED_FORMS, getEvolution, getEvolvedForm, shouldEvolve };
