// Dungeon Environments — maps floors to locations with background prompts and enemy themes
// Each location has preferred mobs (70% chance) and the full floor pool fills the rest
const ENVIRONMENTS = [
  // Floor 3: The Over City
  { floor: 3, name: 'The Over City', desc: 'Medieval village over a dormant volcano', bg: 'floor_overcity', enemies: 'mobs_elites',
    preferred: ['Feral Crawler', 'Shade Gnoll', 'Hobgoblin Sergeant', 'Juicer', 'Claude Sludgington IV'] },
  { floor: 3, name: "Grimaldi's Circus", desc: 'Menacing circus with mutated clowns and mold lions', bg: 'floor_circus', enemies: 'mobs_elites',
    preferred: ['Odious Creeper', 'Grimaldi', 'The Pooka', 'Ball of Swine'] },
  { floor: 3, name: 'Goblin Workshop', desc: 'Grimy underground workshop with steam engines', bg: 'floor_workshop', enemies: 'mobs_elites',
    preferred: ['Vorpal Construct', 'Ball of Swine', 'Hobgoblin Sergeant', 'Heather the Bear'] },
  // Floor 6: The Hunting Grounds
  { floor: 6, name: 'The Sugar Cube Castle', desc: 'White elf fortress — the Butcher\'s Masquerade', bg: 'floor_castle', enemies: 'hunters',
    preferred: ['Kua-Tin Safari Lord', 'Skull Empire Collector', 'Hive Scout Stalker'] },
  { floor: 6, name: 'Zockau', desc: '1950s American downtown with alien hunters', bg: 'floor_zockau', enemies: 'hunters',
    preferred: ['Primal Trophy Hunter', 'Bopca Game Warden', 'Kua-Tin Safari Lord'] },
  { floor: 6, name: 'Fort Freedom', desc: 'Glittering river palace under siege', bg: 'floor_fort', enemies: 'hunters',
    preferred: ['Valtay Emotion Eater', 'Hive Scout Stalker', 'Bopca Game Warden'] },
  // Floor 9: Faction Wars
  { floor: 9, name: 'Larracos', desc: 'Inverted cone city with gothic architecture and lava falls', bg: 'floor_larracos', enemies: 'commanders',
    preferred: ['Valtay Mindlord', 'Skull Warlord', 'Hive Overmind'] },
  { floor: 9, name: 'The FUPA', desc: 'Fortified trench castle — Princess Posse HQ', bg: 'floor_fupa', enemies: 'commanders',
    preferred: ['Bopca General', 'Kua-Tin Admiral', 'Primal Warchief'] },
  { floor: 9, name: 'Reaver Castle', desc: 'Plastic playset fortress with honeycomb tunnels', bg: 'floor_reaver', enemies: 'commanders',
    preferred: ['Skull Warlord', 'Bopca General', 'Valtay Mindlord'] },
  // Floor 12: Ascendency Game
  { floor: 12, name: 'El Capitol', desc: 'Shattered Havana capitol under dark storm skies', bg: 'floor_capitol', enemies: 'ascended',
    preferred: ['Kua-Tin God-Emperor', 'Skull God of Death'] },
  { floor: 12, name: 'La Iglesia', desc: 'Rotting octagonal church with Orisha shrines', bg: 'floor_church', enemies: 'ascended',
    preferred: ['Valtay Dream-Eater', 'Hive God-Nexus'] },
  { floor: 12, name: 'The Necropolis', desc: 'Colossal carved mountain tomb in the desert', bg: 'floor_necropolis', enemies: 'ascended',
    preferred: ['Skull God of Death', 'Primal World-Breaker'] },
];

const BG_PROMPTS = {
  floor_overcity: 'Medieval village with moss-covered stone buildings and wooden slat streets. Sulfurous smoke rises from gaps. Fake colorful nebula starry sky with crimson sun above. Dark dungeon game battlefield.',
  floor_circus: 'Three massive glowing circus tents surrounded by barbed wire in a dark ruined city at night. Fires and spotlights sweep the area. Dark fantasy game battlefield.',
  floor_workshop: 'Dark grimy underground workshop. Heavy iron cogs, greasy tools, massive steam engine with copper pipes. Spiked steam-powered vehicles. Industrial dungeon battlefield.',
  floor_castle: 'Massive perfectly square stark white castle with four thin towers at corners, in a forest clearing against rocky cliff. Elegant but menacing. Game battlefield.',
  floor_zockau: '1950s American downtown at night. Vintage brick buildings, yellow streetlamps, green park. Subtly alien and dangerous. Game battlefield.',
  floor_fort: 'Glittering stone fortress on muddy slope beside dark wide river at night. Magical traps glow. Folded-paper monsters emerge from water. Game battlefield.',
  floor_larracos: 'Massive subterranean city as inverted cone deep into earth. Gothic architecture tiers, college towers, glowing lava river cascading down rings. Epic game battlefield.',
  floor_fupa: 'Fortified medieval castle on flat plain. Muddy trenches, scaffolding, glowing magical shields, concrete bunkers. War-torn game battlefield.',
  floor_reaver: 'Blocky plastic-looking fortress like 1980s villain playset. Honeycomb tunnels visible inside. Heavily bombed. Sci-fi dungeon battlefield.',
  floor_capitol: 'Historic Capitol building under dark stormy sky. Shattered glass on grand stairs. Magical fire and green lightning from entrance. Epic game battlefield.',
  floor_church: 'Interior of rotting octagonal yellow church. Moss floors, moonlight through hole in roof. Seven rubble shrine piles. Mystical game battlefield.',
  floor_necropolis: 'Colossal ancient stone mountain carved with ominous reliefs. Peak touches dome-like forcefield sky. Desert dunes surround it. Epic game battlefield.',
};

function getEnvironment(floor) {
  const options = ENVIRONMENTS.filter(e => e.floor === floor);
  if (options.length) return options[Math.floor(Math.random() * options.length)];
  // Fallback for floors without specific environments
  if (floor <= 2) return { floor, name: 'The Belly-Rubbed Pug', desc: 'A fast-food safe room turned dungeon', bg: 'floor1', enemies: 'mobs_elites' };
  return { floor, name: 'The Dungeon', desc: 'A dark dungeon corridor', bg: 'floor1', enemies: 'mobs_elites' };
}

function getBgPrompt(bgId) { return BG_PROMPTS[bgId] || ''; }

module.exports = { ENVIRONMENTS, BG_PROMPTS, getEnvironment, getBgPrompt };
