// Persistence - save/load game state across sessions
const fs = require('fs');
const path = require('path');

// Use DATA_DIR env var (Railway volume) if set, else ~/shared (DevSpaces), else ./data
const SAVE_DIR = process.env.DATA_DIR || (fs.existsSync(path.join(process.env.HOME || '/tmp', 'shared')) ? path.join(process.env.HOME, 'shared') : path.join(process.cwd(), 'data'));
const SAVE_FILE = path.join(SAVE_DIR, 'dcc-save.json');

const DEFAULT_SAVE = {
  collection: [], // unlocked card ids
  deck: [],       // current deck card ids
  floor: 1,
  floorWins: 0,
  gold: 100,
  rapport: {},    // cardId -> rapportValue
  achievements: [],
  lootHistory: [],
  stats: { gamesPlayed: 0, wins: 0, losses: 0, changelingsCaught: 0, totalRapport: 0 },
  sponsor: 'borant',
  unlockedSponsors: ['borant'],
  totalViewers: 0,
};

function load() {
  try {
    if (fs.existsSync(SAVE_FILE)) {
      return { ...DEFAULT_SAVE, ...JSON.parse(fs.readFileSync(SAVE_FILE, 'utf-8')) };
    }
  } catch (e) { console.error('Load error:', e.message); }
  return { ...DEFAULT_SAVE };
}

function save(data) {
  try {
    if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });
    fs.writeFileSync(SAVE_FILE, JSON.stringify(data, null, 2));
  } catch (e) { console.error('Save error:', e.message); }
}

function initNewPlayer() {
  const { getAllCards } = require('../cards/library');
  const starters = getAllCards()
    .filter(c => c.side === 'ally' && c.floor <= 2)
    .slice(0, 10)
    .map(c => c.id);
  // Carl MUST always be in the deck (he's the protagonist)
  if (!starters.includes('carl')) starters.unshift('carl');
  const data = { ...DEFAULT_SAVE, collection: starters, deck: starters };
  save(data);
  return data;
}

module.exports = { load, save, initNewPlayer };
