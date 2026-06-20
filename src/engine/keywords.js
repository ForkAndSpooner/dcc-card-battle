// Keyword ability system - reusable mechanics (MTG/Hearthstone inspired)
// Keywords are attached to cards and trigger at defined moments.

const KEYWORDS = {
  taunt:       { icon: '🛡️', name: 'Taunt', desc: 'Enemies must attack this card first' },
  stealth:     { icon: '🌫️', name: 'Stealth', desc: 'Cannot be targeted until it attacks' },
  lifesteal:   { icon: '🩸', name: 'Lifesteal', desc: 'Damage dealt heals your party' },
  cleave:      { icon: '↔️', name: 'Cleave', desc: 'Also hits adjacent enemies' },
  deathrattle: { icon: '💀', name: 'Deathrattle', desc: 'Triggers an effect when it dies' },
  battlecry:   { icon: '📢', name: 'Battlecry', desc: 'Triggers an effect when played' },
  regenerate:  { icon: '💚', name: 'Regenerate', desc: 'Heals a little each turn' },
  first_strike:{ icon: '⚡', name: 'First Strike', desc: 'Strikes before the enemy can react' },
  thorns:      { icon: '🌵', name: 'Thorns', desc: 'Attackers take damage when they hit it' },
};

// Battlecry effects (on play)
const BATTLECRIES = {
  carl:      { effect: 'shield_ally', desc: 'Shields the lowest-HP ally for 30' },
  mongo:     { effect: 'gain_taunt', desc: 'Gains Taunt — protects the party' },
  mordecai:  { effect: 'mark_enemy', desc: 'Marks an enemy (+50% damage taken)' },
  imani:     { effect: 'shield_all', desc: 'Shields all allies for 15' },
  donut:     { effect: 'taunt_self', desc: 'Demands all attention (Taunt + draws aggro)' },
  hekla:     { effect: 'self_rage', desc: 'Enters enraged (+20 STR)' },
  bautista:  { effect: 'weaken_enemy', desc: 'Suppresses an enemy (-20 STR)' },
};

// Deathrattle effects (on death)
const DEATHRATTLES = {
  carl:      { effect: 'cockroach', desc: 'Survives once at 1 HP (handled by passive)' },
  donut:     { effect: 'curse_killer', desc: 'Curses her killer (-30 STR)' },
  mongo:     { effect: 'enrage_allies', desc: 'Allies gain +20 STR in fury' },
  hekla:     { effect: 'final_blow', desc: 'Deals 20 damage to a random enemy' },
  bea:       { effect: 'heal_party', desc: 'Heals the party 15 with her last breath' },
  prepotente:{ effect: 'swan_song', desc: 'All allies gain +15 STR (a final aria)' },
};

// Per-character keyword assignments
const CARD_KEYWORDS = {
  carl:      ['battlecry', 'deathrattle'],
  donut:     ['battlecry', 'deathrattle'],
  mongo:     ['battlecry', 'deathrattle', 'taunt'],
  mordecai:  ['battlecry'],
  imani:     ['battlecry', 'taunt'],
  hekla:     ['battlecry', 'deathrattle', 'first_strike'],
  bautista:  ['battlecry'],
  bea:       ['deathrattle', 'regenerate'],
  prepotente:['deathrattle'],
  odette:    ['cleave', 'stealth'],
  katia:     ['stealth', 'first_strike'],
  lucia_mar: ['stealth', 'first_strike'],
};

function getKeywords(cardId) {
  const baseId = (cardId || '').split(/[-_]/)[0];
  return CARD_KEYWORDS[baseId] || [];
}

function getBattlecry(cardId) {
  const baseId = (cardId || '').split(/[-_]/)[0];
  return BATTLECRIES[baseId] || null;
}

function getDeathrattle(cardId) {
  const baseId = (cardId || '').split(/[-_]/)[0];
  return DEATHRATTLES[baseId] || null;
}

module.exports = { KEYWORDS, BATTLECRIES, DEATHRATTLES, CARD_KEYWORDS, getKeywords, getBattlecry, getDeathrattle };
