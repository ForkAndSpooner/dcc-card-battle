// Seeded RNG - reproducible randomness for testing
// Mulberry32: fast, deterministic, good distribution
function makeRng(seed) {
  let s = seed >>> 0;
  const fn = function() {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  fn.seed = seed;
  return fn;
}

// Global RNG — defaults to Math.random behavior unless a seed is set
let _rng = Math.random;
let _currentSeed = null;

function setSeed(seed) {
  _currentSeed = seed;
  _rng = seed == null ? Math.random : makeRng(seed);
}

function random() { return _rng(); }
function getSeed() { return _currentSeed; }

// Seeded shuffle
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Seeded pick
function pick(arr) { return arr[Math.floor(random() * arr.length)]; }

module.exports = { makeRng, setSeed, random, getSeed, shuffle, pick };
