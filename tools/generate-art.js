// Card art generation via Gemini 3 Pro Image
// Run: node tools/generate-art.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { generateImage } = require('../src/api/gemini');
const { CHARS } = require('../src/cards/library');
const fs = require('fs');
const path = require('path');

const ART_DIR = path.join(__dirname, '../public/cards');
const STYLE = `Painterly dark fantasy card game portrait. Dramatic rim lighting, deep shadows, rich colors. The character fills the frame in a 2:3 portrait composition. Ornate gold filigree border elements at edges. Style: a mix of Hearthstone card art and dark fantasy book cover illustration. Game-show broadcast aesthetic with faint holographic overlay suggesting this is being televised to aliens.`;

async function generateCardArt(id, card) {
  const outFile = path.join(ART_DIR, `${id}.png`);
  if (fs.existsSync(outFile)) { console.log(`  Skip ${id} (exists)`); return; }

  let charDesc = '';
  if (card.type === 'creature' || card.growlOnly) {
    charDesc = `A fearsome ${card.name}, a ${card.title || 'dungeon creature'}. Monstrous, powerful, dangerous.`;
  } else {
    charDesc = `Portrait of ${card.name}, "${card.title}". ${card.voiceDescription?.split('.').slice(0, 2).join('.') || card.name}`;
  }

  const prompt = `${STYLE}\n\nCharacter: ${charDesc}\n\nThis is a card portrait for a character called "${card.name}" in a game called "Dungeon Crawler Carl". Do NOT include any text or words in the image.`;

  try {
    const buf = await generateImage({ prompt, aspectRatio: '2:3', imageSize: '1K', model: 'gemini-3-pro-image' });
    fs.writeFileSync(outFile, buf);
    console.log(`  ✓ ${id}: ${outFile} (${buf.length} bytes)`);
  } catch (e) {
    console.error(`  ✗ ${id}: ${e.message.slice(0, 100)}`);
  }
}

async function main() {
  if (!fs.existsSync(ART_DIR)) fs.mkdirSync(ART_DIR, { recursive: true });
  const entries = Object.entries(CHARS);
  console.log(`Generating art for ${entries.length} cards...`);

  for (const [id, card] of entries) {
    console.log(`  ${card.name}...`);
    await generateCardArt(id, card);
    await new Promise(r => setTimeout(r, 2000)); // rate limit
  }
  console.log('Done!');
}

main();
