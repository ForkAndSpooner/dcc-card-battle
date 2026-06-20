// Boss Battle System — recreates iconic DCC boss encounters
// Each boss is a powerful card with themed minions and a unique mechanic.
// Boss battles trigger a cinematic intro sequence.

const BOSSES = {
  the_hoarder: {
    name: 'The Hoarder', floor: 1, threat: 3,
    str: 4, int: 2, con: 8, dex: 1, hp: 45,
    visual: 'A towering garbage-troll giantess, half her face burned, broken dog leash around neck, surrounded by a labyrinth of stinking trash bags.',
    voice: 'Tragic, sobbing, desperate. Cries in Spanish about not wanting to go to hell.',
    mechanic: 'choking_swarm', mechanicDesc: 'Vomits cockroach swarms. Attacking them as they emerge causes her to choke (take double damage).',
    intro: '"Lo siento si fui una mala persona... ¡No quiero estar en el infierno!"',
    minions: ['Scatterer Brood Guardian', 'Scatterer Brood Guardian'],
    reward: 'Neighborhood Map + "Boss Babe" achievement',
    abilities: ['stomp', 'frenzy'], emoji: '🗑️',
  },
  krakaren_clone: {
    name: 'Krakaren Clone', floor: 2, threat: 5,
    str: 5, int: 3, con: 7, dex: 3, hp: 50,
    visual: 'Massive 15-foot pink tentacles covered in frisbee-sized human-shaped mouths with red lips and sharp teeth.',
    voice: 'An ear-splitting cacophony of shrieking voices saying absolutely nothing—pure rage.',
    mechanic: 'hydra_reach', mechanicDesc: 'Birthing: every turn it survives, spawns a new tentacle minion.',
    intro: '*An ear-splitting, multi-mouthed shriek of pure rage shakes the walls*',
    minions: ['Clurichaun Consultant', 'Brindle Grub', 'Clurichaun Consultant'],
    reward: 'Rev-Up Toilet-Grade Moonshine',
    abilities: ['chain_attack', 'stomp'], emoji: '🐙',
  },
  heather_bear: {
    name: 'Heather the Roller-Skating Bear', floor: 3, threat: 6,
    str: 6, int: 1, con: 7, dex: 6, hp: 55,
    visual: 'A black bear in a pink tutu with writhing worms for claws and roller skates fused to her back feet.',
    voice: 'Silent, relentless, tragic. Brief flashes of lucidity remembering she hated the circus anyway.',
    mechanic: 'skating_charge', mechanicDesc: 'Uses momentum to charge — first attack each turn hits for double and cannot be blocked by taunt.',
    intro: '"Good. I\'ve always hated all you assholes, anyway."',
    minions: ['Mold Lion', 'Mold Lion'],
    reward: 'Neighborhood Map + Heather\'s Blood (summoning reagent)',
    abilities: ['charge', 'maul'], emoji: '🐻',
  },
  ringmaster_grimaldi: {
    name: 'Ringmaster Grimaldi', floor: 3, threat: 8, isCityBoss: true,
    str: 5, int: 8, con: 9, dex: 2, hp: 70,
    visual: 'A towering plant monster as tall as a circus tent, writhing vines and parasitic worms pulsing from a central stalk.',
    voice: 'The ultimate corrupted patriarch. Loves his circus "family", uses mind-control spores.',
    mechanic: 'parasitic_spores', mechanicDesc: 'Buffs all minions +2 STR each turn. Healing spells on him disrupt his mechanic (deal bonus damage).',
    intro: '"When the cataclysm came, I remained center stage. And I will remain here forever."',
    minions: ['Mind-Controlled Clown', 'Blood and Ink Elemental', 'Mind-Controlled Clown'],
    reward: 'Massive XP payout',
    abilities: ['mass_buff', 'poison_spit'], emoji: '🎪',
  },
  mimic_rex: {
    name: 'The Mimic Rex', floor: 4, threat: 10, isCityBoss: true,
    str: 9, int: 4, con: 10, dex: 2, hp: 90,
    visual: 'A railway building that yawns open into a 300-foot-wide mouth with person-sized jagged teeth and a train-sized red tongue.',
    voice: 'The silent, ravenous apex predator. Views crawlers as crunchy snacks.',
    mechanic: 'chomp_split', mechanicDesc: 'When damaged, spawns a severed-piece minion that heals it. Must burst it fast.',
    intro: '*The sound of grinding concrete and screeching steel as an entire building unfolds into a fleshy maw*',
    minions: ['Severed Mouth', 'Severed Mouth'],
    reward: 'Iron Tangle Route Map',
    abilities: ['devour', 'crushing_coil'], emoji: '🏛️',
  },
  lusca: {
    name: 'Lusca, Octo-Shark Brood Mother', floor: 5, threat: 9, isCityBoss: true,
    str: 9, int: 3, con: 9, dex: 6, hp: 85,
    visual: 'A colossal Sharktopus — half great white shark, half giant octopus — mouth lined with surfboard-sized teeth.',
    voice: 'An enraged primal force of nature defending her territory.',
    mechanic: 'soft_vore', mechanicDesc: 'Swallows a random ally whole each turn (they cannot act until she takes 15 damage).',
    intro: '*A deafening underwater roar shakes the ocean floor, followed by the rush of millions of gallons of water*',
    minions: ['Concierge Shark', 'Concierge Shark', 'Concierge Shark'],
    reward: 'Platinum Spicy Box',
    abilities: ['devour', 'chain_attack'], emoji: '🦈',
  },
  queen_imogen: {
    name: 'Queen Imogen', floor: 6, threat: 10, isCountryBoss: true,
    str: 6, int: 10, con: 9, dex: 8, hp: 100,
    visual: 'A breathtakingly beautiful High Elf Cleric Sorceress in regal flowing attire. Turns intangible like dandelion seeds.',
    voice: 'Cold, arrogant, manipulative. Views crawlers as insects in her court.',
    mechanic: 'intangibility', mechanicDesc: 'Immune to magic (reflects fire) and poison. Only blunt physical attacks land. Phases out 50% of the time.',
    intro: '"My castle is besieged. You\'re trying to ruin my spell... You are nothing but insects in my court."',
    minions: ['High Elf Guard', 'Ice Elf', 'Castle Defense'],
    reward: 'Treasure Map + High Elf Vault access',
    abilities: ['magic_missile', 'mind_shatter', 'fortify'], emoji: '👑',
  },
  reminiscence_hydra: {
    name: 'Reminiscence Hydra of Malicious Compliance', floor: 8, threat: 10, isCityBoss: true,
    str: 8, int: 7, con: 10, dex: 4, hp: 95,
    visual: 'A building-sized hydra where each of nine heads is a human face from Carl\'s memories. Fleshy, near-indestructible body.',
    voice: 'Screaming constantly. Each head embodies different insecurities and insults — psychological warfare.',
    mechanic: 'adaptive_heads', mechanicDesc: 'Each turn gains a random resistance. Heads regenerate unless hit hard enough to "cauterize".',
    intro: '"I\'m gonna get to you in a minute, Lesser Carl. We gotta have a talk about how you treat family. We\'re gonna have some fist therapy."',
    minions: ['Alpha Male Carl', 'Leveled-Up Frank', 'King Croissant'],
    reward: 'Memory Ghost Totem Cards',
    abilities: ['psychic_storm', 'mind_shatter', 'fear_pulse'], emoji: '🐉',
  },
  shi_maria: {
    name: 'Shi Maria, The Bedlam Bride', floor: 8, threat: 11, isDemiGod: true,
    str: 8, int: 9, con: 11, dex: 7, hp: 110,
    visual: 'A Reaper Spider demi-god with a bulbous spider body and long horrifying legs that snap metal. Hides her face behind a coy facade.',
    voice: 'Cunning, manipulative. Hides behind a shy "MaeMae" persona but derives pleasure from extreme violence.',
    mechanic: 'bedlam_cockroach', mechanicDesc: 'Has Cockroach (survives first death, heals fully). Attacks inflict Permanent Insanity & Blindness.',
    intro: '"Injure me just enough to cast the card magic. Do not attempt to slay me. Many have tried. All have failed. Be a friend to me, and I will be a friend to you."',
    minions: [],
    reward: 'Shi Maria Mythic Totem Card',
    abilities: ['nightmare_realm', 'soul_siphon', 'mind_shatter'], emoji: '🕷️',
  },

  // ===== Additional canon bosses (from Compendium) =====
  ball_of_swine: {
    name: 'The Ball of Swine', floor: 1, threat: 4, isBoroughBoss: true,
    str: 7, int: 1, con: 9, dex: 5, hp: 60,
    visual: 'A massive, screaming ball of compressed tuskling flesh — a Tuskling Knight and Courtesan fused at the core — rolling through a tight labyrinthine arena.',
    voice: 'A deafening chorus of squealing, screaming pigs crushed together into one rolling horror.',
    mechanic: 'rolling_formation', mechanicDesc: 'Rolling charge — gains +2 STR each turn it keeps moving. Stunning it resets the momentum.',
    intro: '*A wall of screaming, compressed pig-flesh comes barreling around the corner, gaining speed*',
    minions: ['Tuskling Squealer', 'Tuskling Squealer'],
    reward: 'Borough Map + Bacon (rare crafting reagent)',
    abilities: ['smash', 'frenzy'], emoji: '🐗',
  },
  the_juicer: {
    name: 'The Juicer', floor: 2, threat: 5,
    str: 8, int: 1, con: 8, dex: 3, hp: 58,
    visual: 'A grotesquely swollen, steroid-infused humanoid with veins bulging like fire hoses, one pulsing dangerously in his neck.',
    voice: 'Roaring, aggressive gym-bro bravado. All rage, no thought.',
    mechanic: 'pressure_vein', mechanicDesc: 'Takes little damage normally — but a CRIT to the neck vein deals 3× damage. Build DEX to land it.',
    intro: '"You even lift, crawler?!"',
    minions: ['Brindle Grub', 'Brindle Grub'],
    reward: 'Silver Box + Pre-Workout (STR buff item)',
    abilities: ['smash', 'rage_strike'], emoji: '💪',
  },
  gore_gore: {
    name: 'Gore-Gore the Mantaur', floor: 4, threat: 7,
    str: 8, int: 2, con: 8, dex: 6, hp: 65,
    visual: 'A berserker minotaur-centaur engineer fused to the controls of a roaring high-speed train along the Ochre line.',
    voice: 'Bellowing rage mixed with the scream of train brakes and grinding steel.',
    mechanic: 'train_charge', mechanicDesc: 'Every 2nd turn the train surges — a massive unblockable AoE to your whole board. Burst him before the next surge.',
    intro: '*The Ochre line train screams around the bend, Gore-Gore bellowing at the throttle*',
    minions: ['Hobgoblin Mechanic', 'Hobgoblin Mechanic'],
    reward: 'Ochre Line Route Map',
    abilities: ['charge', 'smash'], emoji: '🚄',
  },
  ghazi: {
    name: 'Ghazi the Mad Dune Mage', floor: 5, threat: 8, isQuadrantBoss: true,
    str: 4, int: 9, con: 7, dex: 6, hp: 70,
    visual: 'A sand-wreathed mage atop a sprawling sandcastle of shifting, electrified translucent glass hallways.',
    voice: 'Cackling, paranoid, endlessly rearranging his maze and muttering about intruders.',
    mechanic: 'glass_maze', mechanicDesc: 'Each turn shuffles your board positions (lanes scrambled). Electrified — melee attackers take 3 recoil damage.',
    intro: '"You will never find the center of my castle. No one ever does."',
    minions: ['Dirigible Gnome', 'Night Fright'],
    reward: 'Quadrant Key + Sand Sapphire',
    abilities: ['graupel', 'magic_missile'], emoji: '🏜️',
  },
  odious_creepers: {
    name: 'The Odious Creepers', floor: 6, threat: 9, isCityBoss: true,
    str: 6, int: 3, con: 9, dex: 4, hp: 75,
    visual: 'A writhing mass of plant-like abominations, sluggish by day but combining at night into a massive, rapidly-replicating horror.',
    voice: 'Wet, rustling, chittering — a chorus of vines that grows louder as they merge.',
    mechanic: 'night_combine', mechanicDesc: 'Spawns 2 Creeper minions each turn. If 3+ minions are alive, they fuse into a buffed mega-Creeper. Kill fast or get swarmed.',
    intro: '*In the dark, the vines begin to crawl toward one another, and the whole jungle seems to inhale*',
    minions: ['Odious Creeper', 'Odious Creeper'],
    reward: 'Hunting Grounds Map + Creeper Sap',
    abilities: ['chain_attack', 'frenzy'], emoji: '🌿',
  },
  blood_sultanate: {
    name: 'The Blood Sultanate', floor: 9, threat: 11, isCountryBoss: true,
    str: 9, int: 8, con: 11, dex: 7, hp: 115,
    visual: 'The Sultana of the Blood Sultanate flanked by Naga royal guards, throne built atop the bones of fallen claimants in war-torn Larracos.',
    voice: 'Imperious, ancient, utterly certain of her bloodline\'s supremacy.',
    mechanic: 'royal_succession', mechanicDesc: 'Surrounded by the royal family — every royal minion alive grants her +2 STR & damage shielding. ALL must die before she falls.',
    intro: '"You wear the Crown of the Sepsis Whore now, crawler. You are family. And family does not leave this floor alive."',
    minions: ['Blood Naga Prince', 'Blood Naga Princess', 'Sultanate Vizier'],
    reward: 'Crown of the Sepsis Whore + Celestial Box',
    abilities: ['decree', 'magic_missile', 'chain_attack'], emoji: '🩸',
  },
};

// Which boss appears on a given floor (for boss battles)
function getBossForFloor(floor) {
  const matches = Object.entries(BOSSES).filter(([_, b]) => b.floor === floor);
  if (matches.length) return matches[Math.floor(Math.random() * matches.length)];
  // No dedicated boss for this floor — pick the nearest lower-floor boss as a stand-in
  const all = Object.entries(BOSSES).sort((a, b) => a[1].floor - b[1].floor);
  const below = all.filter(([_, b]) => b.floor <= floor);
  const pick = (below.length ? below : all);
  return pick[pick.length - 1] || null;
}

function makeBossCard(bossId) {
  const b = BOSSES[bossId];
  if (!b) return null;
  // Bosses get a big HP pool so the fight is a real event (and mechanics have room to matter).
  // The Hoarder needs an especially huge pool since direct damage is mostly resisted.
  const HP_SCALE = b.mechanic === 'choking_swarm' ? 4.5 : 3;
  const maxHP = Math.round(b.hp * HP_SCALE);
  return {
    id: 'boss_' + bossId,
    name: b.name, str: b.str, int: b.int, con: b.con, dex: b.dex,
    currentHP: maxHP, maxHP, cd: {}, abilities: b.abilities,
    isBoss: true, bossMechanic: b.mechanic, emoji: b.emoji,
    weakness: b.mechanic,
    instanceId: require('crypto').randomUUID(),
  };
}

function makeMinionCard(name, floor) {
  const tier = Math.max(2, Math.floor(floor / 2));
  return {
    id: 'minion_' + name.toLowerCase().replace(/\s/g, '_'),
    name, str: tier, int: 1, con: tier + 1, dex: 2,
    currentHP: 8 + tier * 2, maxHP: 8 + tier * 2, cd: {},
    emoji: '👿', instanceId: require('crypto').randomUUID(),
  };
}

module.exports = { BOSSES, getBossForFloor, makeBossCard, makeMinionCard };
