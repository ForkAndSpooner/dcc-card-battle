// Sound/Music System — client-side audio manager with separate channels
// Channels: music (bg loops), sfx (effects), voice (character TTS)
// Settings persist in localStorage. Falls back silently if audio files missing.

class SoundSystem {
  constructor() {
    this.bgMusic = null;
    this.currentTrack = null;
    this.s = this._load();
  }

  _load() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('dcc_audio') || '{}'); } catch(e) {}
    return {
      musicOn: saved.musicOn !== false,
      musicVol: saved.musicVol ?? 0.35,
      sfxOn: saved.sfxOn !== false,
      sfxVol: saved.sfxVol ?? 0.6,
      voiceOn: saved.voiceOn !== false,
      voiceVol: saved.voiceVol ?? 0.9,
      fastMode: saved.fastMode ?? false,
    };
  }

  save() { localStorage.setItem('dcc_audio', JSON.stringify(this.s)); }

  // ===== MUSIC =====
  async playBgMusic(trackId) {
    if (!this.s.musicOn || this.currentTrack === trackId) return;
    this.stopBgMusic();
    try {
      const audio = new Audio(`/audio/${trackId}.mp3`);
      audio.loop = true;
      audio.volume = this.s.musicVol;
      await audio.play();
      this.bgMusic = audio;
      this.currentTrack = trackId;
    } catch(e) { /* missing or autoplay-blocked */ }
  }

  stopBgMusic() {
    if (this.bgMusic) { this.bgMusic.pause(); this.bgMusic = null; this.currentTrack = null; }
  }

  setMusicOn(on) { this.s.musicOn = on; this.save(); if (!on) this.stopBgMusic(); else if (this._lastEnv) this.playBgMusic(this.trackForEnvironment(this._lastEnv.env, this._lastEnv.floor)); }
  setMusicVol(v) { this.s.musicVol = v; if (this.bgMusic) this.bgMusic.volume = v; this.save(); }

  // ===== SFX =====
  playSfx(name) {
    if (!this.s.sfxOn) return;
    try { const a = new Audio(`/audio/sfx/${name}.mp3`); a.volume = this.s.sfxVol; a.play().catch(()=>{}); } catch(e) {}
  }
  setSfxOn(on) { this.s.sfxOn = on; this.save(); }
  setSfxVol(v) { this.s.sfxVol = v; this.save(); }

  // ===== VOICE ===== (returns volume for the game's voice playback to use)
  voiceVolume() { return this.s.voiceOn ? this.s.voiceVol : 0; }
  setVoiceOn(on) { this.s.voiceOn = on; this.save(); }
  setVoiceVol(v) { this.s.voiceVol = v; this.save(); }

  // ===== ANIMATION =====
  get fastMode() { return this.s.fastMode; }
  setFastMode(on) { this.s.fastMode = on; this.save(); }

  // ===== STINGS =====
  playSting(trackId) {
    if (!this.s.musicOn) return;
    try { const a = new Audio(`/audio/${trackId}.mp3`); a.volume = this.s.musicVol; a.play().catch(()=>{}); } catch(e) {}
  }

  trackForEnvironment(env, floor) {
    this._lastEnv = { env, floor };
    if (env?.bg?.includes('circus')) return 'floor3_circus';
    if (floor === 6) return 'floor6_ambient';
    if (floor === 9) return 'floor9_ambient';
    if (floor === 12) return 'floor12_ambient';
    return 'floor3_ambient';
  }
}

const sounds = new SoundSystem();
window.sounds = sounds;
