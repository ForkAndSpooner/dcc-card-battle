// Dungeon floor progression — sequential 1 → 18.
// Floors 1-9 are sourced from canon (DCC "Levels and Floor Mechanics" + "System Mechanics" resources).
// Floors 10-18 are placeholders awaiting book data (the series, as captured, details through floor 9).
// `env` points to an ENVIRONMENTS floor key (3/6/9/12) to reuse backgrounds/enemy pools until dedicated art exists.
// `rule` is the signature System rule for that floor (drives flavor + future mechanics).
const FLOORS = {
  1: {
    name: 'The First Floor', subtitle: 'Garbage Dump Neighborhood',
    desc: 'A condensed underground maze of the surface city — brick walls glowing with green lichen, tight cobblestone alleys, and abandoned buildings. The survival tutorial.',
    theme: 'ruined neighborhood labyrinth', boss: 'The Hoarder',
    rule: 'No live viewers yet — the galaxy only sees an edited highlight reel.',
    ready: true, env: 3,
  },
  2: {
    name: 'The Second Floor', subtitle: 'White Labyrinth',
    desc: 'Stark white floors and orange-lichen cinderblock walls. Janitor mobs swarm the dead — leave a corpse and the dungeon spawns thousands of Brindle Grubs to consume it.',
    theme: 'white maze + janitor swarms', boss: 'The Krakaren Clone',
    rule: 'Live broadcast goes active — you can now earn views, followers, and sponsorships.',
    ready: true, env: 3,
  },
  3: {
    name: 'The Over City', subtitle: 'Volcano World',
    desc: 'A sprawling medieval city built over a dormant volcano, wooden streets venting sulfur under a painted crimson sun. Scripted NPC dramas and plot-armored Elites. Day/night cycle — the ruins turn deadly after dark.',
    theme: 'medieval city over a volcano', boss: 'Ringmaster Grimaldi / Heather',
    rule: 'Pick your permanent Race and Class on entry. The Desperado Club opens.',
    ready: true, env: 3,
  },
  4: {
    name: 'The Iron Tangle', subtitle: 'The Subway Floor',
    desc: 'An industrial snarl of subway tunnels, trainyards, and multi-level transfer stations over bottomless chasms. A confusing spirograph of color-coded train lines you must navigate to escape.',
    theme: 'living train labyrinth', boss: 'The Mimic Rex',
    rule: 'Stairwells (only at stations 12/24/36/48/72) unlock just 6 hours before the floor collapses.',
    ready: true, env: 3,
  },
  5: {
    name: 'The Bubbles', subtitle: 'Isolated Biomes',
    desc: '1,172 dome-enclosed bubbles, each split into four quadrants: desert Land, open Sea, floating Air islands, and a stone Subterranean necropolis. You\'re trapped with ~150 crawlers.',
    theme: 'four-quadrant biome domes', boss: 'Lusca + Quadrant Bosses',
    rule: 'Liberate all four quadrant castles in your bubble before the stairs open.',
    ready: true, env: 6,
  },
  6: {
    name: 'The Hunting Grounds', subtitle: 'The Hunt',
    desc: 'A dense tropical jungle swallowing the old volcano-world ruins, with the High Elf "Sugar Cube" Castle and the 1950s-style city of Zockau. Outworlder Hunters pay to hunt crawlers for sport.',
    theme: 'jungle + Hunters', boss: 'Queen Imogen',
    rule: 'Deep-dungeon saferooms require a filled "blood bar" to enter. Hunters can be killed permanently. Guild system opens.',
    ready: true, env: 6,
  },
  7: {
    name: 'The Great Race', subtitle: 'The Vehicle Floor',
    desc: 'Crawlers spawn in glass pods around a central abyss, then race biological or mechanical vehicles through hundreds of kilometers of twisting enclosed tube-tracks full of puzzles.',
    theme: 'forced vehicle race', boss: '(bypassed in canon)',
    rule: 'No backtracking. Paths seal after 10 crawlers pass. Come last in a heat and your vehicle\'s life support is removed.',
    ready: true, env: 6,
  },
  8: {
    name: 'The Ghosts of Earth', subtitle: 'The Card Game Floor',
    desc: 'Painstaking geographic recreations of Earth populated by "memory ghosts" — echoes of humanity at the moment of collapse. Crawlers collect Totem (T\'Ghee) cards and fight massive chaotic deck battles.',
    theme: 'Earth recreations + card battles', boss: 'Reminiscence Hydra / Shi Maria',
    rule: 'Time-gated in 3 phases: locked in your region 14 days, then assault another region for an exit key, then descend with a keyholder squad. Looted memory-items turn to dust on collapse.',
    ready: true, env: 9,
  },
  9: {
    name: 'Faction Wars', subtitle: 'The Peeling of Larracos',
    desc: 'The funnel-shaped dwarf city of Larracos sunk into the earth with a river of lava, ringed by nine pie-shaped "petal" territories of trenches and muddy labyrinths. Nine sponsored factions wage war.',
    theme: 'subterranean total war', boss: 'The Blood Sultanate',
    rule: 'Factions can\'t fight until crawlers arrive. During "Ramp-Up," ALL magic and tech skills are blocked — hand-to-hand and non-magical artillery only.',
    ready: true, env: 9,
  },
  10: { name: 'Floor 10', subtitle: '(awaiting book data)', desc: 'Deep-dungeon floor — details pending book research beyond floor 9.', theme: 'unknown', ready: false, env: 12 },
  11: { name: 'Floor 11', subtitle: '(awaiting book data)', desc: 'Details pending book research.', theme: 'unknown', ready: false, env: 12 },
  12: { name: 'Floor 12', subtitle: '(awaiting book data)', desc: 'Details pending book research.', theme: 'unknown', ready: false, env: 12 },
  13: { name: 'Floor 13', subtitle: '(awaiting book data)', desc: 'Details pending book research.', theme: 'unknown', ready: false, env: 12 },
  14: { name: 'Floor 14', subtitle: '(awaiting book data)', desc: 'Details pending book research.', theme: 'unknown', ready: false, env: 12 },
  15: { name: 'Floor 15', subtitle: '(awaiting book data)', desc: 'Details pending book research.', theme: 'unknown', ready: false, env: 12 },
  16: { name: 'Floor 16', subtitle: '(awaiting book data)', desc: 'Details pending book research.', theme: 'unknown', ready: false, env: 12 },
  17: { name: 'Floor 17', subtitle: '(awaiting book data)', desc: 'Details pending book research.', theme: 'unknown', ready: false, env: 12 },
  18: { name: 'The Final Floor', subtitle: 'The Bottom', desc: 'The bottom of the dungeon. Whatever waits here, the whole galaxy is watching.', theme: 'the end', ready: false, env: 12 },
};

const MAX_FLOOR = 18;
const BATTLES_PER_FLOOR = 2; // battle 1 = normal, battle 2 = boss → one boss per floor, never back-to-back

function getFloorInfo(n) {
  return FLOORS[n] || { name: `Floor ${n}`, subtitle: '', desc: 'Uncharted depths.', theme: 'unknown', ready: false, env: 12 };
}
// Returns the ENVIRONMENTS floor key to use for a given dungeon floor
function envFloorFor(n) {
  return getFloorInfo(n).env || 3;
}

module.exports = { FLOORS, MAX_FLOOR, BATTLES_PER_FLOOR, getFloorInfo, envFloorFor };
