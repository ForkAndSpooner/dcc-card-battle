// Generate game SFX via ElevenLabs sound-generation API
// Run: node tools/generate-sfx.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { soundEffect } = require('../src/api/elevenlabs');
const fs = require('fs');
const path = require('path');

const SFX_DIR = path.join(__dirname, '../public/audio/sfx');

const SFX = [
  { id: 'card_play', dur: 1, prompt: 'A satisfying magical whoosh as a card slams onto a table, with a soft shimmer' },
  { id: 'card_attack', dur: 1, prompt: 'A sharp swift sword slash, quick impact whoosh' },
  { id: 'card_hit', dur: 1, prompt: 'A meaty physical impact thud, taking damage' },
  { id: 'card_death', dur: 1.5, prompt: 'A card shattering into pieces, glassy crack and dissolve' },
  { id: 'loot_appear', dur: 1, prompt: 'A magical chime as a treasure chest materializes, sparkly twinkle' },
  { id: 'loot_open', dur: 1.5, prompt: 'A treasure chest creaking open with a triumphant magical reveal sparkle' },
  { id: 'loot_claim', dur: 1, prompt: 'A quick rewarding item pickup chime, coins and sparkle' },
  { id: 'spell_cast', dur: 1, prompt: 'A magical spell casting whoosh with arcane energy crackle' },
  { id: 'fire_blast', dur: 1.5, prompt: 'A fiery explosion whoosh, flames erupting' },
  { id: 'ice_blast', dur: 1.5, prompt: 'A sharp icy freeze crackle, shattering frost' },
  { id: 'heal', dur: 1.5, prompt: 'A warm soothing magical heal chime, gentle restorative shimmer' },
  { id: 'buff', dur: 1, prompt: 'An empowering buff sound, rising magical power-up tone' },
  { id: 'debuff', dur: 1, prompt: 'A sickly descending debuff sound, ominous magical wilt' },
  { id: 'crit', dur: 1, prompt: 'A massive critical hit, powerful impact with a metallic ring and boom' },
  { id: 'turn_end', dur: 0.8, prompt: 'A soft UI confirmation chime for ending a turn' },
  { id: 'button_click', dur: 0.5, prompt: 'A crisp UI button click tick' },
  { id: 'boss_horn', dur: 2.5, prompt: 'An ominous deep war horn blast announcing a boss battle, dramatic and foreboding' },
  { id: 'god_summon', dur: 2, prompt: 'A divine celestial choir swell as a god descends, holy and powerful' },
  { id: 'level_up', dur: 1.5, prompt: 'A triumphant level-up fanfare, ascending magical bells' },
  { id: 'craft', dur: 1.5, prompt: 'An alchemical bubbling and magical fusion sound as two items combine' },
  { id: 'coin', dur: 0.8, prompt: 'Gold coins clinking and dropping into a pile' },
  { id: 'stun', dur: 1, prompt: 'A dizzy comedic stun sound, wobbling and stars' },
];

async function gen(sfx) {
  const out = path.join(SFX_DIR, sfx.id + '.mp3');
  if (fs.existsSync(out)) { console.log('  skip', sfx.id); return; }
  try {
    const buf = await soundEffect(sfx.prompt, sfx.dur);
    if (!buf) { console.log('  ✗', sfx.id, 'no audio'); return; }
    fs.writeFileSync(out, buf);
    console.log('  ✓', sfx.id);
  } catch (e) { console.log('  ✗', sfx.id, e.message.slice(0, 60)); }
}

async function main() {
  if (!fs.existsSync(SFX_DIR)) fs.mkdirSync(SFX_DIR, { recursive: true });
  console.log(`Generating ${SFX.length} sound effects...`);
  for (const sfx of SFX) { await gen(sfx); await new Promise(r => setTimeout(r, 1200)); }
  console.log('SFX generation complete.');
}

main();
