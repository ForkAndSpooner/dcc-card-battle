// Voice generation script - creates remix voices for all talker characters
// Run: node tools/generate-voices.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { createSavedRemixVoice } = require('../src/api/elevenlabs');
const { CHARS } = require('../src/cards/library');
const fs = require('fs');
const path = require('path');

const VOICE_MAP_FILE = path.join(__dirname, '../data/voice-map.json');

async function main() {
  // Load existing map
  let voiceMap = {};
  if (fs.existsSync(VOICE_MAP_FILE)) voiceMap = JSON.parse(fs.readFileSync(VOICE_MAP_FILE, 'utf-8'));

  const talkers = Object.entries(CHARS).filter(([_, c]) => c.type === 'talker' && !c.growlOnly && c.voiceDescription);
  console.log(`${talkers.length} talkers to generate voices for. Already have: ${Object.keys(voiceMap).length}`);

  for (const [id, card] of talkers) {
    if (voiceMap[id]) { console.log(`  Skip ${card.name} (already: ${voiceMap[id]})`); continue; }

    console.log(`  Generating: ${card.name}...`);
    try {
      const voiceId = await createSavedRemixVoice({
        name: `${card.name} - DCC Game`,
        description: card.voiceDescription.slice(0, 200),
        sampleText: card.sampleText,
        promptStrength: card.promptStrength || 0.9,
      });
      voiceMap[id] = voiceId;
      console.log(`    ✓ ${card.name}: ${voiceId}`);
      fs.writeFileSync(VOICE_MAP_FILE, JSON.stringify(voiceMap, null, 2));
      await sleep(3000); // Rate limit
    } catch (e) {
      console.error(`    ✗ ${card.name}: ${e.message}`);
      await sleep(5000);
    }
  }
  console.log('Done. Voice map:', VOICE_MAP_FILE);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
main();
