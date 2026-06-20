// Audio Engine - ElevenLabs Flash v2.5 TTS

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

class AudioEngine {
  constructor() {
    this.cache = new Map();
  }

  async speak(voiceId, text) {
    if (!text || !ELEVENLABS_API_KEY) return null;

    const cacheKey = `${voiceId}:${text}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(
        `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg'
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_flash_v2_5',
            voice_settings: {
              stability: 0.4,
              similarity_boost: 0.8,
              style: 0.6,
              use_speaker_boost: true
            }
          })
        }
      );

      if (!response.ok) {
        console.error('ElevenLabs error:', response.status, await response.text());
        return null;
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      if (this.cache.size > 100) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, buffer);

      return buffer;
    } catch (err) {
      console.error('Audio generation error:', err.message);
      return null;
    }
  }
}

module.exports = { AudioEngine };
