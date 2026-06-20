// Audio Manager - TTS for talkers, SFX for creatures, caching
const { tts, soundEffect } = require('../api/elevenlabs');
const fs = require('fs');
const path = require('path');

const VOICE_MAP_FILE = path.join(__dirname, '../../data/voice-map.json');
let voiceMap = {};
try { voiceMap = JSON.parse(fs.readFileSync(VOICE_MAP_FILE, 'utf-8')); } catch {}
// Reload periodically (voices are being generated in background)
setInterval(() => { try { voiceMap = JSON.parse(fs.readFileSync(VOICE_MAP_FILE, 'utf-8')); } catch {} }, 30000);

class AudioManager {
  constructor() {
    this.cache = new Map();
    this.sfxCache = new Map();
  }

  getVoiceId(card) {
    // Check voice map first (generated remix voices), then card's voiceId field
    return voiceMap[card.id] || card.voiceId || 'nPczCjzI2devNBz1zQrb';
  }

  async speak(voiceId, text) {
    if (!voiceId || !text) return null;
    const key = `${voiceId}:${text}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const buf = await tts(voiceId, text);
    if (buf && this.cache.size < 200) this.cache.set(key, buf);
    return buf;
  }

  async creatureSound(card, emotionTag) {
    if (!card.creatureSounds) return null;
    const baseId = (card.id || '').split(/[-_]/)[0];
    // Try pre-generated SFX file first (map common triggers)
    const tag = card.creatureSounds[emotionTag] ? emotionTag : 'on_play';
    const sfxFile = path.join(__dirname, '../../public/sfx', `${baseId}_${tag}.mp3`);
    try {
      if (fs.existsSync(sfxFile)) {
        const key = 'file:' + sfxFile;
        if (this.sfxCache.has(key)) return this.sfxCache.get(key);
        const buf = fs.readFileSync(sfxFile);
        this.sfxCache.set(key, buf);
        return buf;
      }
    } catch {}
    // Fallback: generate on the fly
    const prompt = card.creatureSounds[emotionTag] || card.creatureSounds.on_play;
    if (!prompt) return null;
    const key = `sfx:${card.id}:${emotionTag}`;
    if (this.sfxCache.has(key)) return this.sfxCache.get(key);
    const buf = await soundEffect(prompt, 2);
    if (buf) this.sfxCache.set(key, buf);
    return buf;
  }

  async getAudioForCard(card, text, emotionTag) {
    if (card.growlOnly) {
      return this.creatureSound(card, emotionTag || 'on_play');
    }
    const voiceId = this.getVoiceId(card);
    return this.speak(voiceId, text);
  }
}

module.exports = { AudioManager };
