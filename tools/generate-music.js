// Generate background music tracks via ElevenLabs Music API
// Run: node tools/generate-music.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');

const KEY = process.env.ELEVENLABS_API_KEY;
const AUDIO_DIR = path.join(__dirname, '../public/audio');

// Music tracks mapped to game stages. Loop-friendly, instrumental.
const TRACKS = [
  { id: 'menu_theme', length: 30000, prompt: 'Epic dark fantasy main menu theme, mysterious and inviting, orchestral with subtle electronic pulses, looping, instrumental, builds anticipation for a deadly game show dungeon adventure' },
  { id: 'floor3_ambient', length: 30000, prompt: 'Tense dungeon battle ambient loop, medieval village over a volcano, low ominous strings, distant drums, sense of lurking danger, instrumental, loopable' },
  { id: 'floor3_circus', length: 30000, prompt: 'Creepy carnival battle music, distorted calliope and circus organ, menacing waltz, dark and playful, instrumental loop' },
  { id: 'floor6_ambient', length: 30000, prompt: 'Elegant but sinister hunting-grounds battle music, aristocratic strings turning predatory, 1950s lounge meets danger, instrumental loop' },
  { id: 'floor9_ambient', length: 30000, prompt: 'Epic war battle music, faction wars, military percussion, soaring brass, desperate and grand, gothic city under siege, instrumental loop' },
  { id: 'floor12_ambient', length: 30000, prompt: 'Divine apocalyptic battle music, ascending celestial choir twisted into menace, god-tier final confrontation, massive orchestral, instrumental loop' },
  { id: 'boss_battle', length: 30000, prompt: 'Intense epic boss battle music, pounding drums, dramatic orchestral stabs, choir screams, adrenaline-pumping, video game boss fight, instrumental loop' },
  { id: 'victory', length: 12000, prompt: 'Triumphant short victory fanfare, heroic brass and bells, celebratory, instrumental sting' },
  { id: 'defeat', length: 10000, prompt: 'Somber defeat sting, falling strings, melancholy, game over, instrumental' },
];

async function generateMusic(track) {
  const out = path.join(AUDIO_DIR, track.id + '.mp3');
  if (fs.existsSync(out)) { console.log('  skip', track.id, '(exists)'); return; }
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/music', {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ prompt: track.prompt, music_length_ms: track.length }),
    });
    if (!res.ok) { console.log('  ✗', track.id, res.status, (await res.text()).slice(0, 120)); return; }
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log('  ✓', track.id, '(' + (track.length / 1000) + 's)');
  } catch (e) { console.log('  ✗', track.id, e.message.slice(0, 80)); }
}

async function main() {
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
  console.log(`Generating ${TRACKS.length} music tracks...`);
  for (const track of TRACKS) {
    await generateMusic(track);
    await new Promise(r => setTimeout(r, 2000)); // rate limit
  }
  console.log('Music generation complete.');
}

main();
