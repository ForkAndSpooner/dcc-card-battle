// Enemy card art generation via Gemini image model.
// Run: node tools/generate-enemy-art.js
// Resume-safe: skips files that already exist. Logs progress to stdout.
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { generateImage } = require('../src/api/gemini');
const syn = require('../src/engine/syndicate');
const { BOSSES } = require('../src/engine/bosses');
const mobData = require('../data/mobs.json');
const fs = require('fs');
const path = require('path');

const ART_DIR = path.join(__dirname, '../public/cards');
const STYLE = `Painterly dark fantasy CARD GAME ENEMY portrait. Dramatic rim lighting, deep shadows, rich saturated colors, menacing presence. The creature fills the frame in a 2:3 portrait composition. Ornate dark filigree border elements at edges. Style: a mix of Hearthstone enemy card art and dark fantasy book-cover illustration. Subtle holographic broadcast overlay suggesting this is televised to an alien audience. Absolutely NO text, letters, numbers, or words anywhere in the image.`;

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// Curated, canon-flavored visual descriptions (keyed by normalized name).
const VISUALS = {
  // ---- Floor 1/2 dungeon mobs ----
  goblin: 'A wiry green goblin with yellow eyes, jagged teeth, clutching a crude rusty dagger, wearing scavenged scraps of armor.',
  goblin_warrior: 'A battle-scarred green goblin in dented plate armor, snarling, hefting a notched cleaver, war-paint across its face.',
  dungeon_rat: 'A dog-sized mangy rat with matted fur, glowing red eyes, long yellow incisors and a whip-like diseased tail.',
  scatterer: 'A grotesque giant cockroach the size of a dog, glistening brown chitin, twitching antennae, swarming menace.',
  green_slime: 'A translucent acid-green gelatinous blob with a half-dissolved skull suspended inside, bubbling and oozing.',
  rot_sticker: 'A bloated decaying insectoid with a barbed stinger dripping green rot, leathery wings, compound eyes.',
  brindle_grub: 'A pale fat maggot-like janitor grub the size of a dog, segmented body, tiny mandibles, faintly glowing.',
  shrieker_bat: 'A nightmarish bat with a gaping screaming maw full of needle teeth, membranous wings, sonic-shriek visualized as rippling air.',
  shadow_leak: 'A pool of living darkness leaking upward into a vaguely humanoid silhouette, glowing white pinprick eyes, tendrils of shadow.',
  bad_llama: 'A demonic llama with bloodshot eyes, bared teeth, singed wool, an unsettling malevolent grin, faint hellish glow.',
  // ---- Troglodytes / kobolds / clurichaun ----
  troglodyte_pygmy: 'A small hunched cave-dwelling reptilian humanoid, grey scaly skin, blind milky eyes, clutching a sharpened bone.',
  troglodyte_basher: 'A hulking grey reptilian brute with a massive stone club, knotted muscles, drooling, cave-dweller.',
  clurichaun_consultant: 'A sinister drunken fae in a tiny rumpled business suit, red nose, carrying a flask and a briefcase, malicious grin.',
  danger_dingo: 'A feral spectral dingo with crackling electric-blue fur, glowing eyes, bared fangs, mid-snarl.',
  kobold_rider: 'A small scaly kobold mounted on a giant snarling lizard, wielding a barbed lance, reptilian war-mount.',
  // ---- Floor 3 mobs ----
  feral_crawler: 'A former human gone utterly feral, ragged torn clothing, wild bloodshot eyes, filthy clawing hands, matted hair, snarling.',
  vorpal_construct: 'A whirring clockwork killing machine bristling with spinning saw blades and razor edges, brass and steel, glowing core.',
  vorpal: 'A floating sentient vorpal blade wreathed in cutting wind, mirror-bright steel, faint malevolent aura.',
  odious_creeper: 'A slow lumbering plant abomination of writhing thorned vines with glowing sickly-green eyes peering from the foliage.',
  shade_gnoll: 'A lean hyena-headed humanoid wreathed in living shadow, glowing eyes, twin curved daggers, mid-lunge.',
  hobgoblin_sergeant: 'A disciplined armored hobgoblin in militaristic red-lacquered plate, barking orders, banner on its back, brutish authority.',
  hobgoblin_soldier: 'A rank-and-file hobgoblin grunt in battered chainmail with a spear and square shield, grim and scarred.',
  bugbear: 'A massive shaggy goblinoid brute, hulking and hairy, oversized fists, fang-filled snarl, crude spiked club.',
  ball_of_swine: 'A horrifying rolling ball of compressed screaming pig-flesh, dozens of squealing tuskling faces fused together, tusks and snouts protruding, revolting and durable.',
  // ---- Floor 3 elites ----
  claude_sludgington_iv: 'An aristocratic sentient sludge creature wearing a monocle and tiny top hat, oozing iridescent slime, smug refined expression.',
  rude_dolph: 'A demonic reindeer with a glowing blood-red nose, blackened antlers like dead branches, bloodshot eyes, baring fangs.',
  juicer: 'A grotesquely swollen steroid-infused humanoid, veins bulging like fire hoses across bulging muscle, one vein pulsing in its thick neck, roaring.',
  the_pooka: 'A shapeshifting trickster fae in the form of a sleek black goat-rabbit hybrid with too-human eyes and an unsettling knowing smile.',
  pooka: 'A shapeshifting trickster fae in the form of a sleek black goat-rabbit hybrid with too-human eyes and an unsettling knowing smile.',
  // ---- Floor 3 boss ----
  scolopendra: 'A colossal armored centipede, dozens of skittering legs, segmented crimson carapace, venom-dripping mandibles, rearing up to strike.',
  // ---- Floor 6 hunters (alien tourist species) ----
  kua_tin_safari_lord: 'An aquatic tentacled humanoid in big-game safari gear and pith helmet, octopus-like head, smug colonial sneer, holding an ornate energy rifle.',
  bopca_game_warden: 'A militaristic insectoid in crisp uniform with chitin armor plates, mandibled face, clutching a shock-lance, bureaucratic menace, hovering drones.',
  valtay_emotion_eater: 'A psychic lizardfolk with smooth iridescent scales, oversized hypnotic eyes, slender frame, tendrils of psychic energy seeping from its skull.',
  skull_empire_collector: 'A skeletal conqueror in ornate black-and-bone armor adorned with trophy skulls, eye-sockets glowing violet, regal and grim.',
  primal_trophy_hunter: 'A massive ancient ape-like being with reddish fur, intelligent cruel eyes, primitive bone weapons and trophy bones lashed to its hide.',
  hive_scout_stalker: 'A sleek chitinous insectoid scout with too many glittering eyes, blade-like forelimbs, bioluminescent markings, predatory stance.',
  // ---- Floor 9 commanders ----
  kua_tin_admiral: 'A regal aquatic tentacled commander in an ornate naval uniform crusted with medals and coral, octopus head, imperious glare.',
  bopca_general: 'A high-ranking insectoid general in heavy ceremonial chitin armor and a peaked cap, clutching a swagger baton, surrounded by paperwork drones.',
  valtay_mindlord: 'A powerful psychic lizardfolk noble in flowing robes, third eye blazing, hands wreathed in puppeteering psionic strings.',
  skull_warlord: 'A towering skeletal warlord in jagged black death-plate, wielding a massive bone greatsword, necromantic green fire in its eye sockets.',
  primal_warchief: 'A gigantic ape-like warchief draped in skulls and war-paint, beating its chest, roaring, primal fury incarnate.',
  hive_overmind: 'A bloated psychic insectoid node with a translucent dome skull exposing a pulsing brain, surrounded by darting drone-bugs.',
  // ---- Floor 12 ascended (stole god bodies) ----
  kua_tin_god_emperor: 'A divine aquatic emperor radiating stolen godhood, tentacled head crowned with a halo of water, golden divine armor, oceanic majesty.',
  bopca_hive_god: 'An ascended insectoid god of order, chitin gilded in divine gold, a swarm of holy drones orbiting, radiant bureaucratic divinity.',
  valtay_dream_eater: 'A reality-warping psychic god-lizard, body flickering between dimensions, eyes like collapsing galaxies, nightmare aura bending the air.',
  skull_god_of_death: 'A towering god of death, a colossal crowned skeleton wreathed in necrotic shadow and green soul-fire, throne of bones, oppressive dread.',
  primal_world_breaker: 'An apocalyptic ape-titan, mountainous and scarred, fists that crack the earth, glowing molten eyes, primal destruction embodied.',
  hive_god_nexus: 'A divine hive-nexus, a radiant crystalline insectoid godhead pulsing with shared consciousness, infinite drones forming halos of wings.',
  // ---- mobs.json extra bosses/mobs ----
  elite_guard: 'An elite dungeon guard in polished black plate armor with a glowing visor, halberd at the ready, disciplined and deadly.',
  prison_pocket: 'A grotesque living dimensional pocket, a maw-like rift in space lined with grasping ghostly hands and swallowed prisoners.',
  quetzalcoatlus: 'A colossal feathered pterosaur with a vast crested head, razor beak, iridescent plumage, wings spread, ancient sky-predator.',
  dispenser: 'A monstrous vending-machine mimic, steel body cracked open into a toothy maw, dispensing rusted cans and menace, glowing buttons like eyes.',
  dismember: 'A butcher-horror of stitched limbs and cleavers, blood-stained apron, too many arms each ending in a different blade.',
  big_tina: 'A full-sized Tyrannosaurus Rex with scarred hide and intelligent, malevolent eyes, towering and terrifying, massive jaws dripping, prehistoric apex predator in a dungeon.',
  denise: 'A deceptively cute-looking dungeon horror, doll-like face hiding rows of needle teeth, sweet smile turned sinister.',
  ralph: 'A lumpy misshapen dungeon brute with mismatched eyes and a confused angry expression, surprisingly dangerous, drooling.',
  feral_goose: 'A demonic feral goose, wings flared, neck extended in a furious hiss, glowing eyes, far more terrifying than any goose should be.',
  madre_de_aguas: 'A colossal serpentine water-mother of Cuban myth, a vast horned aquatic serpent rising from black flood-water, ancient and divine.',
  // ---- new boss alts (grander boss_ versions) ----
  boss_ball_of_swine: 'EPIC BOSS: a towering wall of compressed screaming pig-flesh, a Tuskling Knight and Courtesan fused at the core, dozens of squealing faces and tusks, rolling through a labyrinth, terrifying scale.',
  boss_the_juicer: 'EPIC BOSS: a monstrously swollen steroid titan, veins bulging like fire hoses, one massive vein throbbing in its neck, fists raised, roaring with gym-bro rage.',
  boss_gore_gore: 'EPIC BOSS: Gore-Gore the Mantaur, a berserker minotaur-centaur fused to the controls of a screaming high-speed train, bellowing, steam and sparks, brutal.',
  boss_ghazi: 'EPIC BOSS: Ghazi the Mad Dune Mage, a sand-wreathed sorcerer atop a sandcastle of shifting electrified translucent glass, cackling, eyes glowing with arcane sand-magic.',
  boss_odious_creepers: 'EPIC BOSS: a massive fused mass of Odious Creeper vines combining at night into a rapidly-replicating thorned abomination with many glowing green eyes.',
  boss_blood_sultanate: 'EPIC BOSS: the Sultana of the Blood Sultanate, an imperious crowned naga queen flanked by royal serpent guards, throne of bones, blood-red regalia, ancient menace.',
  // ---- boss minions ----
  scatterer_brood_guardian: 'A massive armored mother cockroach, glistening brown chitin plates, twitching antennae, guarding a brood of skittering young.',
  mold_lion: 'A lion-shaped beast made entirely of furry green and grey mold and fungus, glowing spore-eyes, spores drifting from its mane.',
  mind_controlled_clown: 'A circus clown with blank mind-controlled eyes and parasitic vines threading from the back of its skull, painted grin frozen, unsettling.',
  blood_and_ink_elemental: 'A swirling humanoid elemental of churning red blood and black ink, dripping and splattering, formless face, eerie liquid menace.',
  severed_mouth: 'A detached chunk of monster-flesh that has sprouted centipede legs and a fanged mouth, scuttling, dripping, grotesque.',
  concierge_shark: 'An anthropomorphic shark in a crisp bellhop concierge uniform and cap, rows of teeth in a polite-but-deadly smile, fins in white gloves.',
  high_elf_guard: 'A regal high elf castle guard in gleaming silver-and-gold filigree plate armor, ornate spear, cold beautiful disdainful face.',
  ice_elf: 'A pale frost-skinned elf wreathed in swirling snow and ice crystals, glowing blue eyes, frost-rimed robes, conjuring icicles.',
  castle_defense: 'An animated castle defense construct, an armored stone-and-crystal sentinel turret with glowing runic eyes, magical wards crackling.',
  alpha_male_carl: 'A grotesque buffed-up parody of a bald muscled man flexing aggressively, smug alpha-bro sneer, surreal exaggerated muscles, nightmarish.',
  leveled_up_frank: 'A hulking over-leveled brute named Frank, swollen with stolen power, glowing veins, cocky menacing grin, oversized fists.',
  king_croissant: 'A buttery flaky croissant the size of a man, wearing a tiny crown, with a smug regal face, oddly menacing pastry royalty.',
  tuskling_squealer: 'A small fierce pig-creature with oversized curved tusks and bristly hide, mouth open in a furious squeal, beady angry eyes, scrappy and vicious.',
  hobgoblin_mechanic: 'A grease-stained hobgoblin engineer in a leather apron with goggles and a heavy wrench, sparks and oil, mechanical gadgets on its belt.',
  dirigible_gnome: 'A tiny goggled gnome strapped beneath a small brass dirigible balloon, dropping bombs, manic grin, steampunk contraption.',
  night_fright: 'A bulbous bioluminescent explosive insect that glows ominously in the dark, swollen abdomen full of volatile fluid, twitching wings.',
  blood_naga_prince: 'A regal male naga (serpent from the waist down) with crimson scales, gold jewelry, a princely circlet, wielding an ornate curved blade.',
  blood_naga_princess: 'A regal female naga (serpent from the waist down) with crimson and rose scales, gold-and-ruby regalia, a princess tiara, casting blood magic.',
  sultanate_vizier: 'A sinister naga vizier in dark robes and a tall ornate headdress, holding a glowing staff, scheming red eyes, advisor to the Blood Sultanate.',
};

function descFor(name, template) {
  const key = norm(name);
  if (VISUALS[key]) return VISUALS[key];
  // Synthesize from template desc + species if no curated visual
  const speciesDesc = template?.species && syn.SYNDICATE_SPECIES[template.species]?.desc;
  const bits = [];
  bits.push(`A menacing dungeon creature called "${name}"`);
  if (speciesDesc) bits.push(speciesDesc);
  if (template?.desc) bits.push(template.desc);
  return bits.join('. ') + '.';
}

async function gen(file, name, template) {
  const outFile = path.join(ART_DIR, `${file}.png`);
  if (fs.existsSync(outFile)) { console.log(`  skip ${file} (exists)`); return false; }
  const prompt = `${STYLE}\n\nCreature: ${descFor(name, template)}`;
  try {
    const buf = await generateImage({ prompt, aspectRatio: '2:3', imageSize: '1K', model: 'gemini-3-pro-image' });
    fs.writeFileSync(outFile, buf);
    console.log(`  ✓ ${file}.png (${buf.length} bytes)`);
    return true;
  } catch (e) {
    console.error(`  ✗ ${file}: ${String(e.message).slice(0, 120)}`);
    return false;
  }
}

async function main() {
  if (!fs.existsSync(ART_DIR)) fs.mkdirSync(ART_DIR, { recursive: true });
  // Collect every enemy: { file, name, template }
  const jobs = new Map(); // file -> {name, template}
  const add = (name, template) => { const f = norm(name); if (f && !jobs.has(f)) jobs.set(f, { name, template }); };

  ['FLOOR_3_MOBS', 'FLOOR_3_ELITES', 'FLOOR_6_HUNTERS', 'FLOOR_9_COMMANDERS', 'FLOOR_12_ASCENDED'].forEach(k => {
    (syn[k] || []).forEach(t => add(t.name, t));
  });
  if (syn.FLOOR_3_BOSS) add(syn.FLOOR_3_BOSS.name, syn.FLOOR_3_BOSS);
  (mobData.mobs || []).forEach(m => add(m.name, m));
  (mobData.bosses || []).forEach(b => add(b.name, b));

  // Dedicated boss_ art for the 6 newer BOSSES (so they look grander than mob versions)
  const newBossKeys = ['ball_of_swine', 'the_juicer', 'gore_gore', 'ghazi', 'odious_creepers', 'blood_sultanate'];
  for (const k of newBossKeys) { jobs.set('boss_' + k, { name: BOSSES[k]?.name || k, template: BOSSES[k] }); }

  // Boss minions (named summons that appear on the enemy board)
  Object.values(BOSSES).forEach(b => (b.minions || []).forEach(m => add(m, { name: m })));

  console.log(`Enemy art jobs: ${jobs.size}`);
  let made = 0, skipped = 0, failed = 0;
  for (const [file, { name, template }] of jobs) {
    const before = fs.existsSync(path.join(ART_DIR, `${file}.png`));
    const r = await gen(file, name, template);
    if (before) skipped++; else if (r) made++; else failed++;
    if (!before) await new Promise(res => setTimeout(res, 1500)); // rate limit
  }
  console.log(`\nDone. made=${made} skipped=${skipped} failed=${failed}`);
}

main();
