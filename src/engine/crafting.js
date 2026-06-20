// Crafting System — Level 1: Combine any 2 inventory items via LLM
const fs = require('fs');
const path = require('path');

const RECIPES_PATH = path.join(__dirname, '..', '..', 'data', 'recipes.json');

function getItemEffectHint(name) {
  // Check master DB first for lore/effect
  try {
    const master = require('../../data/items-master.json');
    const all = [...master.weapons, ...master.potions, ...master.scrolls_tomes, ...master.plushies, ...master.tools, ...master.food_drugs, ...master.materials, ...master.armor, ...master.vehicles];
    const match = all.find(i => name.toLowerCase().includes(i.name.toLowerCase().split(' ').slice(0,3).join(' ')) || i.name.toLowerCase().includes(name.toLowerCase()));
    if (match) return match.lore || match.effect || match.name;
  } catch(e) {}
  const n = name.toLowerCase();
  if (/celestial grenade/i.test(n)) return 'Summons a random God to the battlefield who grants a powerful boon but may also unleash chaos';
  if (/iron skin/i.test(n)) return 'Grants +30 CON and +15 HP — makes the target much harder to kill';
  if (/bloodlust/i.test(n)) return 'Doubles STR and grants an extra action — berserker fury';
  if (/mordecai.*brew/i.test(n)) return 'Makes target INVINCIBLE for 2 rounds — cannot take any damage';
  if (/cosmic buff/i.test(n)) return 'Permanently grants +20 STR and +20 INT to ALL allies';
  if (/invisibility/i.test(n)) return 'Makes target untargetable for 2 turns — enemies cannot hit them';
  if (/disco ball/i.test(n)) return 'STUNS all enemies for 1 turn — they cannot act';
  if (/doomsday/i.test(n)) return 'Deals 90 damage to ALL units on both sides — nuclear option';
  if (/moab/i.test(n)) return 'Deals 40 damage to ALL units on both sides';
  if (/protective shell/i.test(n)) return 'Makes ALL allies invincible for 1 turn';
  if (/heal/i.test(n)) return 'Restores HP to target or team';
  if (/mana/i.test(n)) return 'Restores 3 mana points';
  if (/bomb|boom|grenade|dynamite/i.test(n)) return 'Deals AoE damage to all enemies';
  if (/oil/i.test(n)) return 'Makes next attack deal double damage or applies fire vulnerability';
  if (/goblin oil/i.test(n)) return 'All enemies take +25% fire damage for 3 turns';
  if (/scroll/i.test(n)) return 'One-shot spell effect (varies by type)';
  if (/strength|str/i.test(n)) return 'Grants +30 STR for 3 turns — hit harder';
  if (/size.up/i.test(n)) return 'Finds enemy weakness — deal double damage to strongest foe';
  if (/level.up/i.test(n)) return 'Permanently grants +10 STR, +10 INT, +20 CON';
  if (/confusing fog/i.test(n)) return 'All enemies become CONFUSED — they may attack each other';
  if (/conscription/i.test(n)) return 'Converts a non-boss enemy to fight for your team';
  if (/fear/i.test(n)) return 'Stuns the strongest enemy';
  if (/weapon|sword|axe/i.test(n)) return 'Equippable weapon that enhances basic attacks';
  if (/armor|shield/i.test(n)) return 'Equippable armor that reduces incoming damage';
  return 'A useful dungeon item';
}

function loadRecipes() {
  try { return JSON.parse(fs.readFileSync(RECIPES_PATH, 'utf8')); } catch { return []; }
}

function saveRecipes(recipes) {
  fs.writeFileSync(RECIPES_PATH, JSON.stringify(recipes, null, 2));
}

function findRecipe(itemA, itemB) {
  // Check canonical DCC recipes first
  const canon = findCanonicalRecipe(itemA, itemB);
  if (canon) return canon;
  // Then check player-approved recipes
  const recipes = loadRecipes();
  return recipes.find(r =>
    (r.inputA === itemA && r.inputB === itemB) ||
    (r.inputA === itemB && r.inputB === itemA)
  );
}

const CANONICAL_RECIPES = [
  { inputs: ['Rev-Up Moonshine Jug', 'Goblin Oil'], result: { name: "Carl's Jug O' Boom", rarity: 'epic', slot: 'consumable', description: 'Custom thermobaric jug bomb. Massive fire splash.', effects: [{ type: 'damage_all_enemies', params: { amount: 6 } }] } },
  { inputs: ['Soul Crystal', 'Sheol Glass Reaper Case'], result: { name: "Carl's Doomsday Scenario", rarity: 'celestial', slot: 'consumable', description: 'Unstable miniature sun. Rattles the teeth of a god.', effects: [{ type: 'damage_all_enemies', params: { amount: 13 } }, { type: 'team_damage', params: { amount: 4 } }] } },
  { inputs: ['Hobgoblin Pus', 'Proximity Trigger'], result: { name: 'Remote-Detonated Satchel Charge', rarity: 'epic', slot: 'consumable', description: 'Moldable C4 with smart trigger.', effects: [{ type: 'damage_single', params: { amount: 9 } }] } },
  { inputs: ['Nitro Sludge', 'Hobgoblin Pus'], result: { name: 'Amplified Mega-Bomb', rarity: 'legendary', slot: 'consumable', description: 'Nitro-amplified explosive. Leveling power.', effects: [{ type: 'damage_all_enemies', params: { amount: 8 } }] } },
  { inputs: ['Toraline Root Vegetable', 'Healing Potion'], result: { name: 'Phase Lava Rock Potion', rarity: 'rare', slot: 'consumable', description: 'Reach into solid rock. Great for brain surgery.', effects: [{ type: 'hidden', params: { turns: 1 } }, { type: 'heal_target', params: { amount: 3 } }] } },
  { inputs: ['Dwarven Battery', 'Proximity Trigger'], result: { name: 'Electric Shock Trap', rarity: 'rare', slot: 'consumable', description: 'Battery-powered trap. Zaps next attacker.', effects: [{ type: 'reflect_damage', params: { turns: 2 } }] } },
  { inputs: ['Rev-Up Moonshine Jug', 'Healing Potion'], result: { name: 'Rev-Up Immunity Smoothie', rarity: 'rare', slot: 'consumable', description: 'Pink sparkling liquid. Grants immunity to diseases.', effects: [{ type: 'cleanse_all', params: {} }, { type: 'heal_team', params: { amount: 2 } }] } },
];

function findCanonicalRecipe(nameA, nameB) {
  const a = (nameA || '').toLowerCase(), b = (nameB || '').toLowerCase();
  return CANONICAL_RECIPES.find(r => {
    const [rA, rB] = r.inputs.map(x => x.toLowerCase());
    return (a.includes(rA) && b.includes(rB)) || (a.includes(rB) && b.includes(rA));
  });
}

async function craftItems(itemA, itemB, geminiKey) {
  // Check saved recipes first
  const existing = findRecipe(itemA.name, itemB.name);
  if (existing) return { item: existing.result, fromRecipe: true };

  const prompt = `You are the crafting system for "Dungeon Crawler Carl" — a deadly, darkly comedic dungeon where creativity is rewarded with power.

A player is combining:
- Item A: "${itemA.name}" (${itemA.rarity || 'common'})
  Mechanical Effect: ${itemA.effect || itemA.description || getItemEffectHint(itemA.name)}
- Item B: "${itemB.name}" (${itemB.rarity || 'common'})
  Mechanical Effect: ${itemB.effect || itemB.description || getItemEffectHint(itemB.name)}

You must create a NEW item that CREATIVELY MERGES the mechanical effects of both inputs. The result must be MORE POWERFUL than either ingredient alone.

AVAILABLE MECHANICAL EFFECTS you can assign (pick 1-3 and combine them):
- "summon_god": Summons a god with boon (no chaos)
- "invincible": {turns: N} — target cannot take damage for N turns
- "team_invincible": {turns: N} — ALL allies invincible N turns
- "hidden": {turns: N} — target untargetable N turns
- "str_buff": {amount: N, permanent: bool} — buff STR
- "int_buff": {amount: N, permanent: bool} — buff INT
- "con_buff": {amount: N, permanent: bool} — buff CON
- "team_str_buff": {amount: N, permanent: bool}
- "team_int_buff": {amount: N, permanent: bool}
- "heal_target": {amount: N}
- "heal_team": {amount: N}
- "damage_all_enemies": {amount: N}
- "damage_single": {amount: N} — hits strongest enemy
- "stun_all": {} — stun all enemies 1 turn
- "stun_strongest": {}
- "confuse_all": {} — enemies attack each other
- "steal_enemy": {} — convert weakest non-boss enemy to your side
- "extra_action": {} — reset free action flag
- "mana_restore": {amount: N}
- "double_damage": {turns: N} — target deals 2x damage
- "damage_reduction": {percent: N, turns: N}
- "revive": {} — bring back last dead ally
- "cleanse_all": {} — remove all debuffs from team
- "intimidate": {} — reduce all enemy STR by amount
- "reflect_damage": {turns: N} — attackers take damage back

Rules:
1. Combine the THEMES and EFFECTS of both items creatively
2. Result should be powerful but not completely game-breaking
3. Name it with DCC dark humor/absurd tone
4. Description should be brief and funny

Respond ONLY with this JSON (no markdown fences, no explanation):
{"name":"Item Name","rarity":"rare|epic|legendary","slot":"consumable","description":"Brief dark humor description","effects":[{"type":"effect_name","params":{...}},...]}`; 

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9, maxOutputTokens: 2000 } }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('[Craft LLM raw]', text.slice(0, 300));
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { item: fallbackCraft(itemA, itemB), fromRecipe: false };
    const item = JSON.parse(json);
    return { item, fromRecipe: false };
  } catch (e) {
    console.error('[Crafting Error]', e.message);
    return { item: fallbackCraft(itemA, itemB), fromRecipe: false };
  }
}

function fallbackCraft(itemA, itemB) {
  // Offline fallback if LLM fails
  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const rA = rarities.indexOf(itemA.rarity || 'common');
  const rB = rarities.indexOf(itemB.rarity || 'common');
  const newRarity = rarities[Math.min(4, Math.max(rA, rB) + 1)];
  return {
    name: `Fused ${itemA.name.split(' ').pop()}-${itemB.name.split(' ').pop()}`,
    rarity: newRarity,
    slot: 'consumable',
    description: 'A mysterious fusion of two items.',
    effect: 'Grants +15 STR and +15 INT for 2 turns'
  };
}

function approveRecipe(itemAName, itemBName, result) {
  const recipes = loadRecipes();
  recipes.push({ inputA: itemAName, inputB: itemBName, result, approvedAt: Date.now() });
  saveRecipes(recipes);
}

module.exports = { craftItems, approveRecipe, findRecipe, loadRecipes, getItemEffectHint };
