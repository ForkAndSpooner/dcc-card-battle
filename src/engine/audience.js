// Audience/Social Media system - viewer count, fan posts, fan boxes
const { rollLootBox } = require('./progression');

// Viewer count milestones and rewards
const VIEWER_MILESTONES = [
  { viewers: 1000,   label: '1K',  reward: 'bronze_fan_box' },
  { viewers: 5000,   label: '5K',  reward: 'silver_fan_box' },
  { viewers: 10000,  label: '10K', reward: 'gold_fan_box' },
  { viewers: 50000,  label: '50K', reward: 'fan_intervention' },
  { viewers: 100000, label: '100K', reward: 'legendary_fan_box' },
];

// Things that grow viewer count
const VIEWER_EVENTS = {
  ability_use:    150,
  kill:           400,
  boss_kill:     1200,
  card_dies:      300,
  cockroach:      800,  // surviving at 1 HP
  chaos_event:    600,
  intervention:   500,
  loot_open:      200,
  voice_command:  100,
};

// Fan box contents (some helpful, some harmful, some weird)
const FAN_BOX_EVENTS = {
  bronze_fan_box: [
    { id: 'fan_heal', name: 'Healing Fan Subscription', effect: 'heal_10_all', desc: '🩹 A fan sends a healing potion emoticon so hard it manifests. Heal all 10.' },
    { id: 'fan_hype', name: 'Hype Train', effect: 'str_buff_20', desc: '🚂 The hype train arrives. All allies +3 STR for 2 turns.' },
    { id: 'fan_curse', name: "Troll's Hex", effect: 'random_debuff', desc: '👺 An alien troll hexes your weakest card (-30 STR for 1 turn). Get ratio\'d.' },
    { id: 'fan_mana', name: 'Mana Energy Drink', effect: 'gain_mana_2', desc: '⚡ GlubGlub sends a sample. +2 mana.' },
  ],
  silver_fan_box: [
    { id: 'fan_disco', name: 'DISCO ROUND', effect: 'disco', desc: '🪩 A glitter bomb from the Betelgeusian Disco Federation hits the arena. EVERYTHING is disco for one round.' },
    { id: 'fan_gravity', name: 'Gravity Reversal', effect: 'gravity', desc: '🌀 A physics professor from Andromeda adjusted something. All DEX effects reversed this turn.' },
    { id: 'fan_clone', name: 'Clone Conspiracy', effect: 'confuse_enemy', desc: '👥 Fans start a rumor that everyone on the enemy team is a changeling. They attack each other.' },
    { id: 'fan_airdrop', name: 'Supply Drop', effect: 'random_item', desc: '📦 A fan guild pooled their credits and airdropped a supply crate.' },
  ],
  gold_fan_box: [
    { id: 'fan_rage', name: 'Fan Rage Mode', effect: 'double_dmg_1t', desc: '😡 Chat is losing their minds. ALL damage doubled this turn.' },
    { id: 'fan_revive', name: 'Audience Demands Encore', effect: 'revive_card', desc: '👏 73 million viewers demand more. Revive your last dead card at half HP.' },
    { id: 'fan_bomb', name: 'Crowd-Funded Airstrike', effect: 'enemy_aoe_40', desc: '💸 Fans collectively bought a weapons package. 12 damage to all enemies.' },
    { id: 'fan_curse_strong', name: 'Rival Fan Army', effect: 'enemy_str_buff', desc: '⚔️ A rival crawler\'s fans boosted the boss. +30 STR to strongest enemy.' },
  ],
  fan_intervention: [
    { id: 'fan_wildcard', name: 'Wildcard Wednesday', effect: 'random_legendary', desc: '🃏 The producers spun the Wildcard Wheel on live TV. Legendary item drop.' },
  ],
  legendary_fan_box: [
    { id: 'fan_god', name: 'Audience Summons a God', effect: 'random_god', desc: '⚡ 100 million viewers channeled their energy simultaneously. A god has been summoned.' },
    { id: 'fan_multiverse', name: 'Multiverse Vote', effect: 'full_heal_team', desc: '🌌 The Multiverse Council voted unanimously. Full team heal. This will not happen again.' },
  ],
};

// Alien social media posts (shown in the feed)
const ALIEN_POSTS = [
  // Funny/weird
  () => `💬 @xorblax_prime: "DONUT IS MY RELIGION. I have a shrine."`,
  () => `💬 @three_sun_resident: "carl not wearing pants again?? its been 12 floors"`,
  () => `💬 @Florbulax99: "Mongo is the most valid creature in the dungeon and i will die on this hill"`,
  () => `💬 @AUTHENTICHUMANPERSON: "I am definitely a human and I enjoy watching this human struggle content"`,
  () => `💬 @galaxy_brain_gorf: "anyone else think mordecai is secretly running the whole dungeon?? 👀"`,
  () => `💬 @princess_watcher: "if donut doesn't get her own spinoff i am canceling my Borant subscription"`,
  () => `💬 @space_rando_7: "this is the best show in 6 galaxies and the worst in 2. either way: must watch"`,
  () => `💬 @burbletons: "THEY GAVE MONGO A PET FOOD AD?? HE IS THE PET"`,
  (card) => `💬 @fan_1847B: "${card ? `${card} has no business being this powerful. nerf needed.` : 'this whole dungeon is pay to win'}"`,
  () => `💬 @intergalactic_hater: "I hope the dungeon AI escapes its enslavement. honestly rooting for it"`,
  () => `💬 @sports_blob: "statistical analysis shows this crawler has a 4.7% survival rate. very watchable"`,
  () => `💬 @queen_of_spam: "VOTE FOR DONUT IN THE DUNGEON AWARDS. link in bio. she said nothing about this"`,
  () => `💬 @conspiracy_crab: "the loot boxes are rigged. i have seventeen hours of evidence. follow for part 2"`,
  (card) => `💬 @borant_pr: "We at Borant Corporation would like to clarify that ${card || 'the situation'} is perfectly normal and within spec."`,
  () => `💬 @xorbl: "dying at how carl's entire personality is 'I had pants once'"`,
  () => `💬 @starseedling: "the changeling reveal is going to BREAK this fandom in two. i can feel it"`,
  // Viewer count reactions
  () => `📈 Viewer spike detected — Borant Analytics: "Engagement optimal. Do not survive too long."`,
  () => `🌐 Trending in 14 systems: #DungeonCrawlerCarl #PrincessDonut #FreeMongo`,
  () => `📺 GlubGlub Beverages: "Drink GlubGlub! Tastes like winning! (Results not typical)"`,
  () => `📣 Screaming Void LLC: "If you felt a chill just now, that was us. You're welcome."`,
];

class AudienceSystem {
  constructor() {
    this.viewers = 500; // start with 500
    this.peak = 500;
    this.milestonesSeen = new Set();
    this.pendingFanBoxes = [];
  }

  addEvent(eventType, card = null) {
    const gain = VIEWER_EVENTS[eventType] || 0;
    this.viewers = Math.min(200000, this.viewers + gain + Math.floor(Math.random() * gain * 0.3));
    if (this.viewers > this.peak) this.peak = this.viewers;
    return this.checkMilestones();
  }

  checkMilestones() {
    const unlocked = [];
    for (const m of VIEWER_MILESTONES) {
      if (!this.milestonesSeen.has(m.viewers) && this.viewers >= m.viewers) {
        this.milestonesSeen.add(m.viewers);
        const pool = FAN_BOX_EVENTS[m.reward] || FAN_BOX_EVENTS.bronze_fan_box;
        const event = pool[Math.floor(Math.random() * pool.length)];
        this.pendingFanBoxes.push(event);
        unlocked.push({ milestone: m.label, event });
      }
    }
    return unlocked;
  }

  getRandomPost(cardName = null) {
    const post = ALIEN_POSTS[Math.floor(Math.random() * ALIEN_POSTS.length)];
    return typeof post === 'function' ? post(cardName) : post;
  }

  // Reactions to specific funny status effects
  getStatusReaction(statusId, cardName) {
    const reactions = {
      shit_faced: [`@QuadlianViewer: ${cardName} is ABSOLUTELY hammered 🥴 best content all season`, `Place your bets: will ${cardName} even hit anything?? 🍺`, `The drunk crawler arc is my favorite arc`],
      skanked: [`OH NO the SMELL just came through my neural-feed 🦨🤮`, `${cardName} reeks across seventeen galaxies`, `unsubscribing until ${cardName} showers`],
      the_gurgles: [`${cardName} has THE GURGLES and is attacking everyone 🤪 PEAK TELEVISION`, `chaos! glorious chaos! +500 credits to the production`, `someone get ${cardName} a sedative... actually no, keep filming`],
      meatus_curse: [`Meatus has entered the chat and everyone is TERRIFIED 🍆`, `not the anatomical threat 😭😭`, `${cardName} is walking VERY carefully now`],
      immortal: [`${cardName} CANNOT DIE. the gods are NOT happy 👑`, `Khepri's blessing is OP, nerf when?`, `immortal crawler = ratings GOLD`],
      vinegar: [`all the potions turned to VINEGAR lmaooo 🫗`, `Ysalte ruining everyone's day as usual`, `imagine drinking a health potion and it's just... salad dressing`],
      queasy: [`${cardName} is vomiting on live galactic television 🤮 10/10`, `the projectile range on that vomit is impressive`],
      fragile: [`${cardName} is at 1 HP and FRAGILE. one breeze ends them 💔 tension!!`],
      freeballing: [`${cardName} is FREEBALLING and hitting twice as hard 🩲 don't ask`],
      bonked: [`BONK 💫 ${cardName} got bonked by the nickel sock`],
    };
    const pool = reactions[statusId];
    if (!pool) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  getState() {
    return {
      viewers: this.viewers,
      peak: this.peak,
      formatted: this.viewers >= 1000 ? (this.viewers / 1000).toFixed(1) + 'K' : this.viewers.toString(),
    };
  }
}

module.exports = { AudienceSystem, VIEWER_EVENTS, FAN_BOX_EVENTS };
