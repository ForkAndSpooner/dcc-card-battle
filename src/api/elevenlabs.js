// ElevenLabs API helper - TTS, voice remix, and sound effects
const KEY = process.env.ELEVENLABS_API_KEY;
const BASE = 'https://api.elevenlabs.io/v1';

const BRIAN_V3 = 'nPczCjzI2devNBz1zQrb'; // base voice for remix

/** Speak text with a saved voice */
async function tts(voiceId, text, settings = {}) {
  if (!text || !KEY) return null;
  const res = await fetch(`${BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_flash_v2_5',
      voice_settings: {
        stability: 0.4,
        similarity_boost: 0.8,
        style: 0.6,
        use_speaker_boost: true,
        ...settings,
      },
    }),
  });
  if (!res.ok) {
    console.error('TTS error', res.status, (await res.text()).slice(0, 200));
    return null;
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Generate sound effect (for creature growls etc.) */
async function soundEffect(promptText, durationSec = 2) {
  if (!KEY) return null;
  const res = await fetch(`${BASE}/sound-generation`, {
    method: 'POST',
    headers: {
      'xi-api-key': KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: promptText,
      duration_seconds: durationSec,
      prompt_influence: 0.85,
    }),
  });
  if (!res.ok) {
    console.error('SFX error', res.status, (await res.text()).slice(0, 200));
    return null;
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Create remix voice previews from Brian v3 */
async function createRemixPreviews({ description, sampleText, promptStrength = 0.9 }) {
  const res = await fetch(`${BASE}/text-to-voice/create-previews`, {
    method: 'POST',
    headers: {
      'xi-api-key': KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      voice_description: description,
      text: sampleText,
      source_voice_id: BRIAN_V3,
      prompt_strength: promptStrength,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Preview ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

/** Save a generated preview as a permanent voice */
async function saveVoicePreview({ generatedVoiceId, name, description }) {
  const res = await fetch(`${BASE}/text-to-voice/create-voice-from-preview`, {
    method: 'POST',
    headers: {
      'xi-api-key': KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      voice_name: name,
      voice_description: description,
      generated_voice_id: generatedVoiceId,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Save voice ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

/** Full workflow: design + save a remix voice */
async function createSavedRemixVoice({ name, description, sampleText, promptStrength = 0.9 }) {
  const previews = await createRemixPreviews({ description, sampleText, promptStrength });
  const previewId = previews.previews?.[0]?.generated_voice_id;
  if (!previewId) throw new Error('No preview returned');
  const saved = await saveVoicePreview({
    generatedVoiceId: previewId,
    name,
    description,
  });
  return saved.voice_id;
}

module.exports = { tts, soundEffect, createRemixPreviews, saveVoicePreview, createSavedRemixVoice };
