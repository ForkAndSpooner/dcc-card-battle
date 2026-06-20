// Status Effects Registry — book-accurate buffs, debuffs, and diseases
// Each effect: type, duration, per-turn hook, stat mods, flavor message
// Applied via applyStatus(card, effectId), ticked in tickStatuses(card), checked via hasStatus(card, id)

const STATUS_EFFECTS = {
  // ===== BUFFS =====
  weakened: { name: 'Weakened', type: 'debuff', icon: '📉', desc: 'Strength reduced — deals less damage', duration: 3 },
  potion_sickness: { name: 'Potion Sickness', type: 'debuff', icon: '🤢', desc: 'CON too low to chain potions — restorative effects halved and DEX reduced', duration: 2, statMod: { dex: -2 } },
  freeballing: { name: 'Freeballing', type: 'buff', icon: '🩲', desc: '+100% damage from below-waist attacks, but only 1 armor slot', dmgMult: 2.0, permanent: true },
  cockroach: { name: 'Cockroach', type: 'buff', icon: '🪳', desc: 'Survives the first fatal blow at 1 HP', permanent: true },
  magical_fervor: { name: 'Magical Fervor', type: 'buff', icon: '🔵', desc: 'Triple mana, +STR, immune to Fear', duration: 3, statMod: { str: 2 }, fearImmune: true },
  unbreakable: { name: 'Unbreakable', type: 'buff', icon: '🦴', desc: 'Foot bones cannot break, trap alarms delayed', duration: 5 },
  good_rest: { name: 'Good Rest', type: 'buff', icon: '😴', desc: '+10% to all base stats', duration: 4, statMod: { str: 1, int: 1, con: 1, dex: 1 } },
  great_rest: { name: 'Great Rest', type: 'buff', icon: '🛌', desc: '+15% to all base stats & XP', duration: 4, statMod: { str: 2, int: 2, con: 1, dex: 1 } },
  warm_tummy: { name: 'You are full!', type: 'buff', icon: '🍔', desc: '+5% healing, -5% debuff time, -5% indirect damage', duration: 5, healBonus: 1 },
  titivated: { name: 'Titivated', type: 'buff', icon: '✨', desc: 'Reduced projectile damage', duration: 3, projResist: 0.3 },
  soothed: { name: 'Soothed!', type: 'buff', icon: '💆', desc: 'Less pain, debuffs 10% less effective', duration: 3 },
  juiced: { name: 'Juiced!', type: 'buff', icon: '💪', desc: '+10% strength', duration: 2, statMod: { str: 1 } },
  shrouded: { name: 'Shrouded!', type: 'buff', icon: '🛡️', desc: '10% damage reduction', duration: 2, dmgReduction: 10 },
  trolled: { name: 'Trolled!', type: 'buff', icon: '💚', desc: '+25% healing speed', duration: 2, healBonus: 2 },
  limbered: { name: 'Limbered!', type: 'buff', icon: '🤸', desc: '+50% dexterity', duration: 2, statMod: { dex: 3 } },
  immortal: { name: 'Immortal', type: 'buff', icon: '👑', desc: 'Cannot die (still feels pain)', duration: 2, invincible: true },
  shining_charisma: { name: 'Shining Charisma', type: 'buff', icon: '🌟', desc: 'Allies gain 20% of your charisma', duration: 3 },
  speedster: { name: 'Speedster', type: 'buff', icon: '💨', desc: 'Extra movement / extra action', duration: 2, extraAction: true },
  closed_off: { name: 'Closed Off!', type: 'buff', icon: '🚫', desc: 'Immune to all auras (good and bad)', duration: 3, auraImmune: true },

  // ===== DEBUFFS =====
  shit_faced: { name: 'Shit-Faced', type: 'debuff', icon: '🥴', desc: '50% chance to miss attacks (drunk & uncoordinated)', duration: 3, missChance: 0.5 },
  buzzed: { name: 'Buzzed', type: 'debuff', icon: '🍺', desc: '+3 CHA, -1 DEX, woozy and dizzy', duration: 3, statMod: { cha: 1, dex: -1 } },
  sepsis: { name: 'Sepsis', type: 'debuff', icon: '🦠', desc: 'Damage over time, does not stack, heals normally', duration: 3, dot: 2 },
  poisoned: { name: 'Poisoned', type: 'debuff', icon: '🤢', desc: 'Rapid HP loss', duration: 3, dot: 3 },
  the_taint: { name: 'The Taint', type: 'disease', icon: '☠️', desc: 'Cannot heal by any method', duration: 4, noHeal: true },
  queasy: { name: 'Queasy', type: 'debuff', icon: '🤮', desc: '40% chance to skip action (vomiting)', duration: 2, skipChance: 0.4 },
  confused_mind: { name: 'Where Am I?', type: 'debuff', icon: '😵', desc: 'Forgets target, attacks randomly', duration: 2, confused: true },
  despondent: { name: 'Despondent', type: 'debuff', icon: '😔', desc: '-15% all stats, +10% damage taken', duration: 3, statMod: { str: -1, int: -1, con: -1, dex: -1 }, dmgTakenMult: 1.1 },
  soul_poisoning: { name: 'Soul Poisoning', type: 'debuff', icon: '🔥', desc: 'Burning pain, may knock unconscious', duration: 2, dot: 2 },
  deshrouded: { name: 'Deshrouded', type: 'debuff', icon: '👁️', desc: 'All protections and stealth stripped', duration: 1, stripStealth: true },
  skanked: { name: 'Skanked', type: 'debuff', icon: '🦨', desc: '-70% CHA, stinks, occasional vomiting', duration: 3, statMod: { cha: -7 }, skipChance: 0.3, spreads: true },
  distraction: { name: 'Distracted', type: 'debuff', icon: '💭', desc: 'Mind clouded with doubt — may lose action', duration: 2, skipChance: 0.3 },
  fragile: { name: 'Fragile', type: 'debuff', icon: '💔', desc: 'Set to 1 HP — any damage is lethal', duration: 2, setHP1: true },
  cursed_light_walker: { name: 'Cursed Light Walker', type: 'disease', icon: '🌑', desc: 'HP seeps away in darkness', duration: 3, dot: 1 },
  left_to_fester: { name: 'Left to Fester!', type: 'debuff', icon: '🩸', desc: 'Cannot heal until target is killed', duration: 4, noHeal: true },
  sore_as_shit: { name: 'Sore as Shit', type: 'debuff', icon: '😣', desc: 'Generalized pain (no stat effect)', duration: 2 },
  blood_trail: { name: 'Blood Trail', type: 'debuff', icon: '🩸', desc: 'HP seeps, can be tracked', duration: 3, dot: 1 },
  bonked: { name: 'Bonked', type: 'debuff', icon: '💫', desc: 'Staggered — lose next action', duration: 1, skipChance: 1.0 },
  under_orders: { name: 'Under Orders', type: 'debuff', icon: '🎭', desc: 'Compelled to obey — fights for the caster', duration: 3, mindControl: true },
  the_gurgles: { name: 'The Gurgles', type: 'disease', icon: '🤪', desc: 'Driven insane — attacks anyone, including allies', duration: 3, confused: true, contagious: true },
  shunned: { name: 'Shunned', type: 'debuff', icon: '⚡', desc: 'Doubled tithing, imminent divine smite', duration: 2, dot: 2 },
  mute: { name: 'Mute', type: 'debuff', icon: '🔇', desc: 'Cannot cast spells/abilities', duration: 2, silenced: true },
  shelved: { name: 'Shelved', type: 'debuff', icon: '🧊', desc: 'Frozen in place', duration: 2, stunned: true },
  ouch: { name: 'Ouch', type: 'debuff', icon: '🥵', desc: 'Staggered (groin shot)', duration: 1, skipChance: 0.7 },
  unsettled: { name: 'Unsettled', type: 'debuff', icon: '😬', desc: 'Disoriented and uncomfortable', duration: 2, statMod: { dex: -1 } },
  exhausted: { name: 'Exhaust-ed', type: 'debuff', icon: '😴', desc: 'Unconscious until damaged', duration: 2, stunned: true },
  meatus_curse: { name: "Meatus's Threat", type: 'debuff', icon: '🍆', desc: 'A highly specific and terrifying anatomical threat', duration: 2, statMod: { str: -1 } },
  vinegar: { name: 'Vinegar', type: 'debuff', icon: '🫗', desc: 'Potions turn to vinegar', duration: 2, potionsFail: true },
  disoriented: { name: 'Disoriented', type: 'debuff', icon: '🌀', desc: 'Tumbling and dizzy', duration: 2, missChance: 0.3 },
  immortalized: { name: 'Immortalized', type: 'debuff', icon: '🧛', desc: 'Half STR/mana, no heal in sunlight (buff in moonlight)', duration: 3, statMod: { str: -2 } },
  enraged_berserk: { name: 'Enraged', type: 'debuff', icon: '😡', desc: 'Berserk — viciously attacks own allies', duration: 2, confused: true },
};

function applyStatus(card, effectId) {
  if (!card) return null;
  const def = STATUS_EFFECTS[effectId];
  if (!def) return null;
  card.statuses = card.statuses || {};
  card.statuses[effectId] = { ...def, turnsLeft: def.permanent ? 999 : (def.duration || 2) };
  // Apply immediate stat mods
  if (def.statMod) {
    for (const [stat, val] of Object.entries(def.statMod)) {
      card[stat] = Math.max(0, (card[stat] || 0) + val);
    }
  }
  if (def.setHP1) card.currentHP = 1;
  if (def.invincible) card.invincible = Math.max(card.invincible || 0, def.duration || 2);
  if (def.stunned) card.stunned = true;
  if (def.confused) card.confused = true;
  if (def.silenced) card.silenced = (def.duration || 2);
  return def;
}

function hasStatus(card, effectId) {
  return card?.statuses?.[effectId]?.turnsLeft > 0;
}

// Tick all statuses on a card at turn start. Returns array of effect messages.
function tickStatuses(card, battle) {
  if (!card?.statuses) return [];
  const msgs = [];
  for (const [id, st] of Object.entries(card.statuses)) {
    if (st.turnsLeft <= 0) continue;
    // DoT
    if (st.dot && !card.invincible) {
      card.currentHP -= st.dot;
      msgs.push(`${card.name} takes ${st.dot} from ${st.name}`);
    }
    st.turnsLeft--;
    if (st.turnsLeft <= 0) {
      // Remove stat mods on expiry
      if (st.statMod) {
        for (const [stat, val] of Object.entries(st.statMod)) {
          card[stat] = Math.max(0, (card[stat] || 0) - val);
        }
      }
      delete card.statuses[id];
      msgs.push(`${card.name}'s ${st.name} wore off`);
    }
  }
  return msgs;
}

function cleanseStatuses(card, typesToRemove = ['debuff', 'disease']) {
  if (!card?.statuses) return;
  for (const [id, st] of Object.entries(card.statuses)) {
    if (typesToRemove.includes(st.type)) {
      if (st.statMod) for (const [stat, val] of Object.entries(st.statMod)) card[stat] = Math.max(0, (card[stat]||0) - val);
      delete card.statuses[id];
    }
  }
}

// Get active status list for display
function getStatusList(card) {
  if (!card?.statuses) return [];
  return Object.values(card.statuses).filter(s => s.turnsLeft > 0).map(s => ({ name: s.name, icon: s.icon, type: s.type, desc: s.desc, turnsLeft: s.turnsLeft }));
}

module.exports = { STATUS_EFFECTS, applyStatus, hasStatus, tickStatuses, cleanseStatuses, getStatusList };
