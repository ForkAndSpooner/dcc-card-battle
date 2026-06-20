require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { BattleEngine, shuffle } = require('./src/engine/battle');
const { SmartCoordinator } = require('./src/agents/coordinator');
const { AudienceSystem, VIEWER_EVENTS } = require('./src/engine/audience');
const coordinator = new SmartCoordinator();
const { PersonalityAgent } = require('./src/agents/personality');
const { RapportJudge } = require('./src/agents/judge');
const { DungeonAI } = require('./src/agents/dungeon-ai');
const { AudioManager } = require('./src/audio/manager');
const { createGodCard, applyBoon, applyChaos, ejectGodSponsor } = require('./src/engine/gods');
const { load, save, initNewPlayer } = require('./src/persistence/save');
const { getAllCards, getCard } = require('./src/cards/library');
const { equipItem, unequipItem } = require('./src/engine/equipment');
const { getQuestForFloor, checkQuestComplete } = require('./src/engine/quests');
const { checkAchievements } = require('./src/engine/achievements');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use('/stable', express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
app.use('/experimental', express.static(path.join(__dirname, 'public'), { index: 'index.html' }));
app.use(express.static(path.join(__dirname, 'public'), { index: 'start.html' }));
app.use(express.json());
const { dataEditorRoutes } = require('./src/api/data-editor');
dataEditorRoutes(app);

process.on('unhandledRejection', e => console.error('Unhandled:', e.message));

const judge = new RapportJudge();
const dungeonAI = new DungeonAI();
const sessions = new Map();

function send(ws, data) { if (ws.readyState === 1) ws.send(data); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// REST endpoints
app.get('/api/save', (req, res) => res.json(load()));
app.get('/api/cards', (req, res) => res.json(getAllCards()));
app.post('/api/new-game', (req, res) => { const d = initNewPlayer(); res.json(d); });
app.post('/api/restart', (req, res) => {
  const { initNewPlayer } = require('./src/persistence/save');
  const d = initNewPlayer();
  d.sponsor = null; // force sponsor re-pick
  const { save } = require('./src/persistence/save');
  save(d);
  res.json({ ok: true });
});
app.get('/api/sponsors', (req, res) => { const { listSponsors } = require('./src/engine/sponsors'); res.json(listSponsors()); });
app.get('/api/status-effects', (req, res) => { const { STATUS_EFFECTS } = require('./src/engine/status-effects'); res.json(STATUS_EFFECTS); });
// Player feedback — appends {feedback, state snapshot, timestamp} to a persistent shared log
app.post('/api/feedback', (req, res) => {
  try {
    const fs = require('fs'); const path = require('path');
    const dir = path.join(process.env.HOME || '/tmp', 'shared', 'dcc-feedback');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const entry = {
      ts: new Date().toISOString(),
      feedback: String(req.body.feedback || '').slice(0, 4000),
      category: req.body.category || 'general',
      state: req.body.state || null, // snapshot the client sent
    };
    fs.appendFileSync(path.join(dir, 'feedback.jsonl'), JSON.stringify(entry) + '\n');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});
app.post('/api/sponsor', (req, res) => {
  const saveData = load();
  saveData.sponsor = req.body.sponsorId;
  save(saveData);
  res.json({ ok: true });
});
app.post('/api/equip', (req, res) => {
  const { cardId, itemIndex, slot } = req.body;
  const saveData = load();
  if (!saveData.inventory) saveData.inventory = [];
  const item = saveData.inventory[itemIndex];
  if (!item) return res.status(400).json({ error: 'No item at index' });
  // Store equipment mapping
  if (!saveData.equipped) saveData.equipped = {};
  if (!saveData.equipped[cardId]) saveData.equipped[cardId] = {};
  saveData.equipped[cardId][item.slot || slot || 'accessory'] = item;
  saveData.inventory.splice(itemIndex, 1);
  save(saveData);
  res.json({ ok: true, save: saveData });
});

wss.on('connection', (ws) => {
  const sessionId = crypto.randomUUID();
  let saveData = load();
  if (!saveData.deck?.length) saveData = initNewPlayer();

  // Build player deck from save
  const deckCards = saveData.deck.map(id => {
    const c = getCard(id);
    if (!c) return null;
    const unlocked = saveData.unlockedAbilities?.[id] || [];
    const baseAbilities = c.abilities?.map?.(a => typeof a === 'object' ? (a.id || a.name || '').toLowerCase().replace(/\s+/g, '_') : a).filter(Boolean) || [];
    const allAbilities = [...new Set([...baseAbilities, ...unlocked])].filter(a => typeof a === 'string' && /^[a-z_]+$/.test(a));
    return { ...c, abilities: allAbilities, level: saveData.cardLevels?.[id] || 1, equippedWeapon: saveData.equipped?.[id]?.weapon || null, equippedArmor: saveData.equipped?.[id]?.armor || null, evolvedTo: (saveData.evolutions || []).includes(id) ? require('./src/engine/evolution').getEvolution(id)?.evolvesTo : null, instanceId: crypto.randomUUID(), canAttack: false };
  }).filter(Boolean);

  const { getEnvironment } = require('./src/engine/environments');
  const { envFloorFor, BATTLES_PER_FLOOR } = require('./src/engine/floors');
  const curFloor = saveData.floor || 1;
  const env = getEnvironment(envFloorFor(curFloor));
  // Boss battle on the 3rd (final) battle of every floor
  const isBossBattle = (saveData.floorWins || 0) === (BATTLES_PER_FLOOR - 1);
  const battle = new BattleEngine({ playerDeck: deckCards, floor: curFloor, sponsorId: saveData.sponsor || 'borant', environment: env, battleType: isBossBattle ? 'boss' : 'normal' });
  // Load saved inventory items into battle inventory (usable as free actions)
  if (saveData.inventory?.length) {
    battle.battleInventory = [...saveData.inventory];
  }
  // First-ever battle gets a couple of starter consumables (once — not every battle)
  if (!saveData.starterItemsGiven) {
    battle.battleInventory.push({ name: 'Celestial Grenade', rarity: 'celestial', slot: 'consumable', effect: 'Summons a random God to the battlefield' });
    battle.battleInventory.push({ name: 'Iron Skin Potion', rarity: 'rare', slot: 'consumable', effect: '+30 CON and +15 HP to target' });
    saveData.starterItemsGiven = true;
    save(saveData);
  }
  const quest = getQuestForFloor(saveData.floor || 3);
  const personality = new PersonalityAgent();
  const audio = new AudioManager();
  const audience = new AudienceSystem();

  // Load rapport from save
  for (const [id, val] of Object.entries(saveData.rapport || {})) {
    const allCards = [...battle.board.player, ...battle.hand.player, ...battle.deck.player];
    const card = allCards.find(c => c.id === id);
    if (card) personality.adjustRapport(card, val - 50);
  }

  sessions.set(sessionId, { ws, battle, personality, audio, saveData, quest, audience });
  send(ws, JSON.stringify({ type: 'init', sessionId, state: battle.getState(), save: saveData, quest: quest ? { name: quest.name, description: quest.description } : null }));
  // Send initial audience state
  send(ws, JSON.stringify({ type: 'audience', data: audience.getState(), post: audience.getRandomPost() }));

  // Boss battle cinematic intro
  if (battle.battleType === 'boss' && battle.bossData) {
    send(ws, JSON.stringify({ type: 'boss-intro', boss: {
      name: battle.bossData.name, visual: battle.bossData.visual, intro: battle.bossData.intro,
      mechanic: battle.bossData.mechanicDesc, threat: battle.bossData.threat, emoji: battle.bossData.emoji,
      reward: battle.bossData.reward,
      condition: battle.bossCondition?.label || null,
    }}));
  }

  // Dungeon AI announces the battle
  (async () => {
    dungeonAI.setInstability(0);
    const line = await dungeonAI.onBattleStart(saveData.floor, battle.battleType || 'normal');
    if (line) {
      send(ws, JSON.stringify({ type: 'dungeon-ai', text: line }));
      const voiceMap = require('./data/voice-map.json');
      const dungeonVoice = voiceMap['dungeon_ai'] || 'nPczCjzI2devNBz1zQrb';
      const audioBuf = await audio.speak(dungeonVoice, line);
      if (audioBuf) send(ws, audioBuf);
    }
  })();

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);
      await handleMessage(sessionId, msg);
    } catch (e) {
      console.error('Msg error:', e);
      send(ws, JSON.stringify({ type: 'error', message: e.message }));
    }
  });
  ws.on('close', () => sessions.delete(sessionId));
});

async function handleMessage(sid, msg) {
  const s = sessions.get(sid);
  if (!s) return;
  const { ws, battle, personality, audio, saveData, audience } = s;

  switch (msg.type) {
    case 'play-card': {
      const r = battle.playCard(msg.index);
      if (!r.ok) { send(ws, JSON.stringify({ type: 'error', message: r.err })); return; }
      if (r.lootCard) {
        send(ws, JSON.stringify({ type: 'loot-opened', box: r.box.boxName, applied: r.applied }));
      } else {
        await speakCard(ws, r.card, 'on_play', battle, personality, audio, s);
        if (r.battlecry?.length) send(ws, JSON.stringify({ type: 'keyword-trigger', kind: 'Battlecry', text: r.battlecry.join(', ') }));
      }
      send(ws, JSON.stringify({ type: 'state', state: battle.getState() }));
      break;
    }

    case 'choose-draw': {
      const r = battle.chooseDraw(msg.deckType);
      if (!r.ok) { send(ws, JSON.stringify({ type: 'error', message: r.err })); return; }
      send(ws, JSON.stringify({ type: 'state', state: battle.getState() }));
      break;
    }

    case 'intervention': {
      const r = battle.useIntervention();
      if (!r.ok) { send(ws, JSON.stringify({ type: 'error', message: r.err })); return; }
      send(ws, JSON.stringify({ type: 'intervention-fired', name: r.name, effects: r.effects }));
      send(ws, JSON.stringify({ type: 'state', state: battle.getState() }));
      break;
    }

    case 'attack': {
      const card = battle.board.player[msg.attackerIndex];
      if (!card) { send(ws, JSON.stringify({ type: 'error', message: 'No card' })); return; }
      const abilId = card.abilities?.[0] || 'crowbar_strike';
      const r = battle.useAbility(msg.attackerIndex, abilId, msg.targetIndex ?? 0);
      if (!r.ok) { send(ws, JSON.stringify({ type: 'error', message: r.err })); return; }
      await speakCard(ws, card, 'on_attack', battle, personality, audio, s);
      for (const eff of r.effects || []) {
        if (eff.kill) { await sleep(800); }
      }
      send(ws, JSON.stringify({ type: 'state', state: battle.getState() }));
      break;
    }

    case 'use-ability': {
      const r = battle.useAbility(msg.cardIndex, msg.abilityId, msg.targetIndex ?? 0);
      if (!r.ok) { send(ws, JSON.stringify({ type: 'error', message: r.err })); return; }
      const card = battle.board.player[msg.cardIndex];
      if (card) await speakCard(ws, card, 'on_attack', battle, personality, audio, s);
      // Audience reacts to ability use
      const milestones = audience.addEvent('ability_use', card?.name);
      if (r.effects?.some(e => e.kill)) {
        const killMilestones = audience.addEvent('kill');
        milestones.push(...killMilestones);
      }
      if (milestones.length) await deliverFanBoxes(ws, milestones, battle, audience);
      send(ws, JSON.stringify({ type: 'ability-result', result: r }));
      send(ws, JSON.stringify({ type: 'audience', data: audience.getState(), post: Math.random() < 0.4 ? audience.getRandomPost(card?.name) : null }));
      send(ws, JSON.stringify({ type: 'state', state: battle.getState() }));
      break;
    }

    case 'free-action': {
      const r = battle.useFreeAction(msg.cardIndex, msg.action, msg.targetIndex ?? 0, msg.itemIdx ?? null, { itemIdxA: msg.itemIdxA, itemIdxB: msg.itemIdxB });
      if (!r.ok) { send(ws, JSON.stringify({ type: 'error', message: r.err })); return; }
      // Handle crafting async
      if (r.action === 'craft' && r.effects?.[0]?.craft) {
        const { craftItems, approveRecipe } = require('./src/engine/crafting');
        const e = r.effects[0];
        send(ws, JSON.stringify({ type: 'craft-start', itemA: e.itemA.name, itemB: e.itemB.name }));
        try {
          const result = await craftItems(e.itemA, e.itemB, process.env.GEMINI_API_KEY);
          // Remove ingredients (higher index first to avoid shift)
          battle.battleInventory.splice(Math.max(e.idxA, e.idxB), 1);
          battle.battleInventory.splice(Math.min(e.idxA, e.idxB), 1);
          battle.battleInventory.push(result.item);
          battle.pendingCraftRating = { itemA: e.itemA.name, itemB: e.itemB.name, result: result.item, fromRecipe: result.fromRecipe };
          send(ws, JSON.stringify({ type: 'craft-result', item: result.item, fromRecipe: result.fromRecipe }));
        } catch (craftErr) {
          console.error('[Craft Error]', craftErr.message);
          send(ws, JSON.stringify({ type: 'craft-result', item: { name: 'Failed Experiment', rarity: 'common', slot: 'consumable', description: 'The combination fizzled.', effect: 'Does nothing useful' }, fromRecipe: false }));
        }
        send(ws, JSON.stringify({ type: 'state', state: battle.getState() }));
        return;
      }
      if (r.effects?.some(e => e.smokeEffect)) send(ws, JSON.stringify({ type: 'smoke-effect' }));
      if (r.action === 'open_loot' && r.effects?.[0]?.discover) {
        send(ws, JSON.stringify({ type: 'discover-loot', boxName: r.effects[0].boxName, choices: r.effects[0].choices }));
      } else if (r.action === 'open_loot' && r.effects?.[0]?.loot) {
        send(ws, JSON.stringify({ type: 'loot-opened', box: r.effects[0].loot, applied: r.effects[0].applied || [] }));
      }
      send(ws, JSON.stringify({ type: 'free-action-result', result: r }));
      // Status effect → alien social reaction
      const statusMsg = r.effects?.map(e => e.effect || e.used || '').join(' ').toLowerCase();
      if (statusMsg) {
        const statusReactionMap = { 'shit-faced': 'shit_faced', 'skanked': 'skanked', 'gurgles': 'the_gurgles', 'invincible': 'immortal', 'vinegar': 'vinegar', 'queasy': 'queasy', 'freeballing': 'freeballing', 'bonked': 'bonked' };
        for (const [kw, sid] of Object.entries(statusReactionMap)) {
          if (statusMsg.includes(kw)) {
            const reaction = audience.getStatusReaction(sid, 'a crawler');
            if (reaction) send(ws, JSON.stringify({ type: 'audience', data: audience.getState(), post: reaction }));
            break;
          }
        }
      }
      send(ws, JSON.stringify({ type: 'state', state: battle.getState() }));
      break;
    }

    case 'donut-ability': {
      if (!battle) break;
      const r = battle.useDonutAbility(msg.ability);
      if (!r.ok) { send(ws, JSON.stringify({ type: 'error', message: r.err })); break; }
      send(ws, JSON.stringify({ type: 'donut-ability-result', result: r }));
      send(ws, JSON.stringify({ type: 'state', state: battle.getState() }));
      break;
    }
    case 'hero-power': {
      const r = battle.useHeroPower();
      if (!r.ok) { send(ws, JSON.stringify({ type: 'error', message: r.err })); return; }
      send(ws, JSON.stringify({ type: 'hero-power-result', result: r }));
      send(ws, JSON.stringify({ type: 'state', state: battle.getState() }));
      break;
    }
    case 'rpg-action': {
      if (!battle) { send(ws, JSON.stringify({ type: 'error', message: 'No active battle' })); return; }
      const { evaluateRPGAction, rollD20, executeEffects } = require('./src/engine/dm-agent');
      send(ws, JSON.stringify({ type: 'rpg-evaluating', text: msg.text }));
      const evaluation = await evaluateRPGAction(msg.text, battle, process.env.GEMINI_API_KEY);
      if (!evaluation.feasible) {
        send(ws, JSON.stringify({ type: 'rpg-result', success: false, feasible: false, reason: evaluation.reason }));
        break;
      }
      // Check mana
      if (battle.mana < (evaluation.mana_cost || 0)) {
        send(ws, JSON.stringify({ type: 'rpg-result', success: false, feasible: false, reason: `Not enough mana (need ${evaluation.mana_cost}, have ${battle.mana})` }));
        break;
      }
      // Consume mana and items
      battle.mana -= (evaluation.mana_cost || 0);
      for (const itemName of (evaluation.items_consumed || [])) {
        const idx = battle.battleInventory.findIndex(i => i.name.toLowerCase() === itemName.toLowerCase());
        if (idx >= 0) battle.battleInventory.splice(idx, 1);
      }
      // Roll dice
      const card = battle.board.player.find(c => c.name.toLowerCase().includes((evaluation.relevant_card || '').toLowerCase())) || battle.board.player[0];
      const statVal = card ? (card[evaluation.relevant_stat] || 50) : 50;
      const roll = rollD20(statVal);
      const success = roll.total >= evaluation.difficulty;
      // Execute effects
      const effects = success ? evaluation.on_success?.effects : evaluation.on_failure?.effects;
      const results = executeEffects(battle, effects || []);
      const narration = success ? evaluation.on_success?.narration : evaluation.on_failure?.narration;
      send(ws, JSON.stringify({
        type: 'rpg-result',
        success,
        feasible: true,
        roll,
        difficulty: evaluation.difficulty,
        stat: evaluation.relevant_stat,
        card: card?.name,
        narration,
        effects: results,
        mana_cost: evaluation.mana_cost,
        items_consumed: evaluation.items_consumed
      }));
      send(ws, JSON.stringify({ type: 'state', state: battle.getState() }));
      break;
    }
    case 'discover-pick': {
      if (!battle?.pendingDiscover) break;
      const picked = battle.pendingDiscover.choices[msg.choiceIndex];
      if (picked) {
        battle.battleInventory = battle.battleInventory || [];
        battle.battleInventory.push(picked);
        const { getItemEffectHint } = require('./src/engine/crafting');
        if (!picked.effect && !picked.description) picked.effect = getItemEffectHint(picked.name);
      }
      battle.pendingDiscover = null;
      send(ws, JSON.stringify({ type: 'state', state: battle.getState() }));
      break;
    }
    case 'rate-craft': {
      if (!battle || !battle.pendingCraftRating) break;
      if (msg.approved) {
        const { approveRecipe } = require('./src/engine/crafting');
        const r = battle.pendingCraftRating;
        approveRecipe(r.itemA, r.itemB, r.result);
        send(ws, JSON.stringify({ type: 'craft-approved', recipe: r }));
      }
      battle.pendingCraftRating = null;
      send(ws, JSON.stringify({ type: 'state', state: battle.getState() }));
      break;
    }
    case 'desperado-open': {
      const { listShop, chaDiscount } = require('./src/engine/desperado');
      const deckCards = (saveData.deck || []).map(getCard).filter(Boolean);
      const disc = chaDiscount(deckCards);
      s.shopStock = listShop(disc); // cache so prices can't be tampered client-side
      send(ws, JSON.stringify({ type: 'desperado', gold: saveData.gold || 0, club: s.shopStock, floor: saveData.floor || 1 }));
      break;
    }
    case 'desperado-buy': {
      const stock = s.shopStock;
      if (!stock) { send(ws, JSON.stringify({ type: 'desperado-result', ok: false, err: 'Open the club first' })); break; }
      const pool = msg.kind === 'vending' ? stock.vending : stock.shop;
      const entry = pool.find(x => x.id === msg.itemId);
      if (!entry) { send(ws, JSON.stringify({ type: 'desperado-result', ok: false, err: 'Item not available' })); break; }
      if ((saveData.gold || 0) < entry.price) { send(ws, JSON.stringify({ type: 'desperado-result', ok: false, err: `Not enough gold (need ${entry.price})` })); break; }
      saveData.gold -= entry.price;
      saveData.inventory = saveData.inventory || [];
      // Vending items carry an effect; shop items are gear/consumables by name
      saveData.inventory.push(msg.kind === 'vending'
        ? { name: entry.name, effect: entry.effect, value: entry.value, slot: 'consumable', rarity: 'common' }
        : { name: entry.name, slot: entry.slot, rarity: entry.rarity });
      save(saveData);
      send(ws, JSON.stringify({ type: 'desperado-result', ok: true, bought: entry.name, gold: saveData.gold }));
      break;
    }
    case 'desperado-spin': {
      const { spinWheel } = require('./src/engine/desperado');
      const cost = s.shopStock?.wheel?.cost ?? 250;
      if ((saveData.gold || 0) < cost) { send(ws, JSON.stringify({ type: 'wheel-result', ok: false, err: `Need ${cost} gold to spin` })); break; }
      saveData.gold -= cost;
      const outcome = spinWheel();
      let detail = { ...outcome };
      if (outcome.type === 'box') {
        const { rollLootBox } = require('./src/engine/progression');
        const box = rollLootBox(outcome.tier);
        saveData.inventory = saveData.inventory || [];
        saveData.inventory.push(...(box.items || []));
        detail.box = box;
      } else if (outcome.type === 'gold') {
        saveData.gold += outcome.value;
      } else if (outcome.type === 'curse') {
        // "Instant death" — canon wheel cruelty: lose a random inventory item instead of a card (between battles)
        if (saveData.inventory?.length) { const i = Math.floor(Math.random() * saveData.inventory.length); detail.lost = saveData.inventory.splice(i, 1)[0]?.name; }
      }
      save(saveData);
      send(ws, JSON.stringify({ type: 'wheel-result', ok: true, outcome: detail, gold: saveData.gold }));
      break;
    }
    case 'recruit-pick': {
      const { id } = msg;
      const { CHARS } = require('./src/cards/library');
      if (id && CHARS[id] && !saveData.deck.includes(id)) {
        saveData.deck.push(id);
        saveData.collection = [...new Set([...(saveData.collection || []), id])];
        save(saveData);
        send(ws, JSON.stringify({ type: 'recruit-confirmed', name: CHARS[id]?.name || id, id }));
      }
      break;
    }
    case 'end-turn': {
      const actions = battle.endTurn(); // enemy acts
      for (const act of actions) {
        if (act.type === 'chaos') {
          dungeonAI.setInstability(battle.instability || 0);
          send(ws, JSON.stringify({ type: 'dungeon-ai', text: act.text }));
          const chaosComment = await dungeonAI.onChaosEvent(act.text);
          if (chaosComment && chaosComment !== act.text) {
            send(ws, JSON.stringify({ type: 'dungeon-ai', text: chaosComment }));
          }
          audience.addEvent('chaos_event');
        }
        if (act.type === 'enemy_play') {
          send(ws, JSON.stringify({ type: 'enemy-action', action: 'play', card: act.card.name, emoji: act.card.emoji || '👹' }));
          await sleep(550); // placement + SFX lands before next action
          if (Math.random() < 0.4) await speakCard(ws, act.card, 'on_play', battle, personality, audio, s);
        }
        if (act.type === 'enemy_attack') {
          send(ws, JSON.stringify({ type: 'enemy-action', action: 'attack', card: act.card.name, target: act.target?.name, dmg: act.dmg }));
          if (act.target?.currentHP > 0) await speakCard(ws, act.target, 'on_damage', battle, personality, audio, s);
        }
        if (act.type === 'face_hit') {
          send(ws, JSON.stringify({ type: 'enemy-action', action: 'face', card: act.card.name, dmg: act.dmg }));
        }
        if (act.type === 'cockroach_donut') {
          send(ws, JSON.stringify({ type: 'enemy-action', action: 'cockroach', card: 'Princess Donut' }));
        }
        if (act.type === 'crawlers_grit') {
          send(ws, JSON.stringify({ type: 'crawlers-grit', card: act.card.name }));
        }
        if (act.type === 'card_died') {
          send(ws, JSON.stringify({ type: 'enemy-action', action: 'kill', card: act.card.name }));
          await speakCard(ws, act.card, 'on_death', battle, personality, audio, s);
          if (act.deathrattle?.length) send(ws, JSON.stringify({ type: 'keyword-trigger', kind: 'Deathrattle', text: act.deathrattle.join(', ') }));
          const cardDiedMilestones = audience.addEvent('card_dies', act.card?.name);
          if (act.card?.passive === 'cockroach') audience.addEvent('cockroach');
          if (cardDiedMilestones.length) await deliverFanBoxes(ws, cardDiedMilestones, battle, audience);
        }
        if (act.type === 'enemy_ability') {
          const msg = act.dmg ? `${act.card.name} uses ${act.name}: ${act.dmg} damage${act.target ? ' to ' + act.target : ''}` : `${act.card.name} uses ${act.name}${act.effect ? ': ' + act.effect : ''}`;
          send(ws, JSON.stringify({ type: 'enemy-action', action: 'ability', card: act.card.name, text: msg }));
        }
        if (act.type === 'enemy_stunned') {
          send(ws, JSON.stringify({ type: 'enemy-action', action: 'stunned', card: act.card.name }));
        }
        if (act.type === 'status_tick') {
          send(ws, JSON.stringify({ type: 'enemy-action', action: 'status', text: act.text }));
        }
        if (act.type === 'boss_mechanic') {
          send(ws, JSON.stringify({ type: 'boss-mechanic', name: act.name, text: act.text, fx: act.fx, big: act.big }));
        }
        // Send intermediate state so player sees changes unfold
        send(ws, JSON.stringify({ type: 'state', state: battle.getState() }));
        await sleep(700);
      }
      // Open kill-bound loot boxes at end of turn
      // Loot boxes no longer auto-open — player must use free action "Open Loot Box"
      // Send audience state + social post after enemy turn
      const endTurnMilestones = audience.addEvent('ability_use');
      if (endTurnMilestones.length) await deliverFanBoxes(ws, endTurnMilestones, battle, audience);
      send(ws, JSON.stringify({ type: 'audience', data: audience.getState(), post: audience.getRandomPost() }));
      // C1: Floor Pulse every 3 turns
      if (battle.turn > 0 && battle.turn % 3 === 0) {
        send(ws, JSON.stringify({ type: 'floor-pulse', turn: battle.turn }));
      }
      // God zone events
      const godEffects = battle.lastGodEffects;
      if (godEffects) {
        for (const ge of godEffects) {
          if (ge.type === 'god_departed') send(ws, JSON.stringify({ type: 'god-event', event: 'departed', name: ge.name }));
          if (ge.type === 'chaos_revealed') send(ws, JSON.stringify({ type: 'god-event', event: 'chaos', effect: ge.effect, results: ge.results }));
          if (ge.type === 'chaos_blocked') send(ws, JSON.stringify({ type: 'god-event', event: 'blocked', message: ge.message }));
        }
        battle.lastGodEffects = null;
      }
      // Player-turn status tick messages (DoT, expiry)
      if (battle.statusMessages?.length) {
        for (const m of battle.statusMessages) send(ws, JSON.stringify({ type: 'enemy-action', action: 'status', text: m }));
        battle.statusMessages = [];
      }
      send(ws, JSON.stringify({ type: 'state', state: battle.getState() }));
      if (battle.winner) await handleGameOver(s);
      break;
    }

    case 'set-family-mode': {
      s.familyMode = !!msg.on;
      break;
    }
    case 'voice': {
      const transcript = msg.transcript?.trim();
      if (!transcript) return;
      const state = battle.getState();

      // Route through smart coordinator with full game context
      const route = await coordinator.route(transcript, state);
      send(ws, JSON.stringify({ type: 'route', route }));
      if (route.intent === 'ignore') return;

      // Tell player what the AI understood
      if (route.reasoning) send(ws, JSON.stringify({ type: 'dungeon-ai', text: `[routing: ${route.reasoning}]` }));

      // ── GAME ACTIONS ──────────────────────────────────────────
      if (route.intent === 'play_card' && route.handIndex >= 0) {
        const r = battle.playCard(route.handIndex);
        if (r.ok) {
          await speakCard(ws, r.card, 'on_play', battle, personality, audio, s);
          send(ws, JSON.stringify({ type: 'state', state: battle.getState() }));
        } else {
          send(ws, JSON.stringify({ type: 'error', message: r.err }));
        }
        return;
      }

      if ((route.intent === 'use_ability' || route.intent === 'attack') && route.boardIndex >= 0) {
        const card = battle.board.player[route.boardIndex];
        const abilId = route.abilityId || card?.abilities?.[0];
        const tgtIdx = route.targetIndex ?? (state.enemy.board.length > 0 ? 0 : -1);
        if (card && abilId) {
          const r = battle.useAbility(route.boardIndex, abilId, tgtIdx);
          if (r.ok) {
            await speakCard(ws, card, 'on_attack', battle, personality, audio, s);
            for (const eff of r.effects || []) {
              if (eff.kill) { await sleep(600); }
            }
            send(ws, JSON.stringify({ type: 'ability-result', result: r }));
            send(ws, JSON.stringify({ type: 'state', state: battle.getState() }));
          } else {
            send(ws, JSON.stringify({ type: 'error', message: r.err }));
          }
        }
        return;
      }

      // ── STRATEGY QUESTION → routed to a card or Dungeon AI ──
      if (route.intent === 'strategy_question' || route.intent === 'game_question') {
        // Route to Dungeon AI for "what happened" questions
        if (route.addressed === 'dungeon_ai' || route.intent === 'game_question') {
          dungeonAI.setInstability(battle.instability || 0);
          const answer = await dungeonAI.narrate('PLAYER_QUESTION', `Player asks: "${transcript}". Game context: turn ${state.turn}, player HP ${state.playerHP}, ${state.player.board.length} allies on board, ${state.enemy.board.length} enemies on board.`);
          if (answer) {
            send(ws, JSON.stringify({ type: 'dungeon-ai', text: answer }));
            const audioBuf = await audio.speak('nPczCjzI2devNBz1zQrb', answer);
            if (audioBuf) send(ws, audioBuf);
          }
          return;
        }
        // Fall through to conversation with addressed card
      }

      // ── CONVERSATION → addressed card responds ────────────────
      let card = null;
      const addressedName = route.addressed?.toLowerCase() || '';
      const everyone = [...state.player.board, ...state.player.hand];
      if (addressedName && addressedName !== 'general' && addressedName !== 'dungeon_ai') {
        card = everyone.find(c => c.name.toLowerCase().includes(addressedName))
            || everyone.find(c => c.id?.includes(addressedName));
      }
      // Default to Mordecai (advisor), else first board card, else any hand card (so cards always reply)
      if (!card) {
        card = state.player.board.find(c => c.id?.includes('mordecai'))
            || state.player.board[0]
            || everyone.find(c => c.id?.includes('donut'))
            || everyone[0];
      }
      if (!card) { send(ws, JSON.stringify({ type: 'dungeon-ai', text: "You've got no crawlers to talk to yet — play a card first!" })); return; }

      try {
        const judgment = await judge.judge(transcript, card, 'conversation').catch(() => ({ rapportDelta: 0 }));
        personality.adjustRapport(card, judgment.rapportDelta || 0);
        const line = await personality.generate(card, 'player_chat', state, transcript, { familyMode: s.familyMode });
        send(ws, JSON.stringify({ type: 'card-speak', cardId: card.id || card.instanceId, text: line || `${card.name} grunts in acknowledgment.`, rapport: personality.getRapport(card) }));
        const audioBuf = await audio.getAudioForCard(card, line, 'happy').catch(() => null);
        if (audioBuf) send(ws, audioBuf);
        if (card.id) { saveData.rapport[card.id] = personality.getRapport(card); save(saveData); }
      } catch (err) {
        console.error('Voice conversation error:', err.message);
        send(ws, JSON.stringify({ type: 'card-speak', cardId: card.id || card.instanceId, text: `${card.name} looks at you, but the words get lost in the dungeon's noise.`, rapport: personality.getRapport?.(card) || 50 }));
      }
      break;
    }
  }
}

// C1: Floor Pulse — every 3 turns, surviving cards gain XP
function triggerFloorPulse() {
  // This is handled client-side visually; actual XP awarded at game-over
}

// Apply fan box effects from audience milestones
async function deliverFanBoxes(ws, milestones, battle, audience) {
  for (const { milestone, event } of milestones) {
    send(ws, JSON.stringify({ type: 'fan-box', milestone, event }));
    await sleep(300);
    // Apply effect
    switch (event.effect) {
      case 'heal_10_all': battle.board.player.forEach(c => { c.currentHP = Math.min(c.maxHP, c.currentHP + 8); }); break;
      case 'str_buff_20': battle.board.player.forEach(c => { c.str += 3; battle.buffs.push({ target: c, stat: 'str', amount: 3, turnsLeft: 2 }); }); break;
      case 'random_debuff': if (battle.board.player.length) { const t = battle.board.player[Math.floor(Math.random() * battle.board.player.length)]; t.str = Math.max(0, t.str - 3); setTimeout(() => t.str += 3, 10000); } break;
      case 'gain_mana_2': battle.mana = Math.min(10, battle.mana + 2); break;
      case 'disco': send(ws, JSON.stringify({ type: 'fx-disco' })); break;
      case 'gravity': send(ws, JSON.stringify({ type: 'fx-gravity' })); break;
      case 'confuse_enemy': battle.board.enemy.forEach(c => c.stunned = true); break;
      case 'double_dmg_1t': battle.board.player.forEach(c => c.doubleDmg = true); break;
      case 'revive_card': if (battle.graveyard.length) { const r = battle.graveyard.pop(); r.currentHP = Math.floor(r.maxHP / 2); battle.board.player.push(r); } break;
      case 'enemy_aoe_40': battle.board.enemy.forEach(e => { e.currentHP -= 12; }); battle.board.enemy = battle.board.enemy.filter(e => e.currentHP > 0); break;
      case 'enemy_str_buff': if (battle.board.enemy.length) { const t = battle.board.enemy.reduce((a, b) => (a.str||0) > (b.str||0) ? a : b); t.str += 3; } break;
      case 'full_heal_team': battle.board.player.forEach(c => c.currentHP = c.maxHP); break;
      case 'random_item': {
        const { rollLootBox } = require('./src/engine/progression');
        const box = rollLootBox('gold');
        if (!battle.battleInventory) battle.battleInventory = [];
        const { getItemEffectHint } = require('./src/engine/crafting');
        for (const item of (box.items || [])) {
          if (!item.effect && !item.description) item.effect = getItemEffectHint(item.name);
          battle.battleInventory.push(item);
        }
        send(ws, JSON.stringify({ type: 'loot-opened', box: 'Fan Supply Crate', applied: (box.items||[]).map(i => `${i.name} → inventory`) }));
        break;
      }
    }
  }
}

async function speakCard(ws, card, trigger, battle, personality, audio, s) {
  if (!card) return;
  const line = await personality.generate(card, trigger, battle.getState(), null, { familyMode: s?.familyMode });
  const emotionTag = card.growlOnly ? line : null;
  const audioBuf = await audio.getAudioForCard(card, line, emotionTag || trigger);
  send(ws, JSON.stringify({
    type: 'card-speak', cardId: card.id || card.instanceId,
    text: card.growlOnly ? `*${emotionTag || trigger}*` : line,
    rapport: personality.getRapport(card),
  }));
  if (audioBuf) send(ws, audioBuf);
}

async function handleGameOver(s) {
  const { ws, battle, saveData, audience } = s;
  const { calcProgression } = require('./src/engine/progression');
  let results = {};
  if (battle.winner === 'player') {
    saveData.stats.wins = (saveData.stats.wins || 0) + 1;
    saveData.gold = (saveData.gold || 0) + 50 + (battle.floor || 1) * 20;
    // Track viewers for sponsor unlocks
    saveData.totalViewers = (saveData.totalViewers || 0) + (audience?.getState?.()?.viewerCount || 1000);
    const SPONSOR_UNLOCKS = { 5000: 'phlegmaxx', 15000: 'glubglub', 30000: 'gridlock', 50000: 'taxavoid', 75000: 'dnadia', 100000: 'void', 150000: 'yumyum' };
    for (const [threshold, sId] of Object.entries(SPONSOR_UNLOCKS)) {
      if (saveData.totalViewers >= parseInt(threshold) && !(saveData.unlockedSponsors||[]).includes(sId)) {
        saveData.unlockedSponsors = [...(saveData.unlockedSponsors||['borant']), sId];
        send(ws, JSON.stringify({ type: 'sponsor-unlock', sponsorId: sId, message: `New sponsor unlocked: ${sId}!` }));
      }
    }
    saveData.floorWins = (saveData.floorWins || 0) + 1;
    const { getFloorInfo, MAX_FLOOR, BATTLES_PER_FLOOR } = require('./src/engine/floors');
    if (saveData.floorWins >= BATTLES_PER_FLOOR) {
      // Cleared the floor (including its boss) — descend the stairs to the next floor
      const currentFloor = saveData.floor || 1;
      const nextFloor = Math.min(MAX_FLOOR, currentFloor + 1);
      const clearedInfo = getFloorInfo(currentFloor);
      const nextInfo = getFloorInfo(nextFloor);
      saveData.floorWins = 0;
      if (nextFloor !== currentFloor) {
        saveData.floor = nextFloor;
        send(ws, JSON.stringify({
          type: 'floor-advance',
          from: currentFloor, to: nextFloor,
          clearedName: clearedInfo.name,
          name: nextInfo.name, subtitle: nextInfo.subtitle, desc: nextInfo.desc, rule: nextInfo.rule,
          final: nextFloor === MAX_FLOOR,
        }));
        // Recruit: offer 3 new ally choices (cards not already in the deck)
        const { CHARS } = require('./src/cards/library');
        const available = Object.keys(CHARS).filter(id => id !== 'carl' && !saveData.deck.includes(id));
        const shuffled = available.sort(() => Math.random() - 0.5).slice(0, 3);
        const recruits = shuffled.map(id => ({ id, name: CHARS[id]?.name || id, str: CHARS[id]?.str, int: CHARS[id]?.int, con: CHARS[id]?.con, abilities: CHARS[id]?.abilities || [] }));
        if (recruits.length) send(ws, JSON.stringify({ type: 'recruit-offer', recruits }));
      } else {
        // Reached the bottom — full clear
        send(ws, JSON.stringify({ type: 'dungeon-complete', floor: currentFloor, name: clearedInfo.name }));
      }
    } else {
      // Won a battle but floor not cleared yet — tell the player how many remain
      const remaining = BATTLES_PER_FLOOR - saveData.floorWins;
      const bossNext = saveData.floorWins === (BATTLES_PER_FLOOR - 1);
      send(ws, JSON.stringify({ type: 'battle-won', floorWins: saveData.floorWins, remaining, bossNext }));
    }
    // XP + leveling + evolutions
    results = calcProgression(battle, saveData);
    // Announce evolutions
    if (results.evolutions?.length) {
      for (const ev of results.evolutions) {
        send(ws, JSON.stringify({ type: 'evolution', evolution: ev }));
      }
    }
    if (results.abilityUnlocks?.length) {
      for (const au of results.abilityUnlocks) {
        send(ws, JSON.stringify({ type: 'ability-unlock', unlock: au }));
      }
    }
    // Collect pending loot into inventory
    if (battle.pendingLoot?.length) {
      results.loot = { boxes: battle.pendingLoot.map(b => b.boxName), itemCount: battle.pendingLoot.reduce((s, b) => s + (b.items?.length || 0), 0) };
    }
  } else {
    saveData.stats.losses = (saveData.stats.losses || 0) + 1;
    results = calcProgression(battle, saveData); // still gain some XP on loss
    // The Crawl: losing ≠ reset. If both protagonists are alive, just retry.
    // Only protagonist death (battle.protagonistFell) means a true Game Over.
    results.canRetry = !battle.protagonistFell;
  }
  // ===== Persist inventory & equipped gear so they carry to the next battle =====
  // battleInventory is the authoritative "what the player currently holds" (started as a
  // copy of saveData.inventory, +/- items used/gained during the battle). Reconcile from it,
  // then fold in any unopened pending loot boxes.
  const newInventory = [...(battle.battleInventory || [])];
  if (battle.pendingLoot?.length) {
    for (const box of battle.pendingLoot) newInventory.push(...(box.items || []));
  }
  saveData.inventory = newInventory;
  // Persist equipped weapons/armor under the card's base id (must match how they're loaded)
  const allCards = [...battle.board.player, ...battle.hand.player, ...battle.deck.player, ...battle.graveyard];
  for (const card of allCards) {
    const baseId = card.id; // CHARS key — same key used at load time
    if (!baseId) continue;
    if (!saveData.equipped) saveData.equipped = {};
    if (!saveData.equipped[baseId]) saveData.equipped[baseId] = {};
    if (card.equippedWeapon) saveData.equipped[baseId].weapon = card.equippedWeapon;
    if (card.equippedArmor) saveData.equipped[baseId].armor = card.equippedArmor;
  }
  save(saveData); // save LAST, after all reconciliation

  const aiLine = await dungeonAI.onBattleEnd(battle.winner, battle.floor);
  dungeonAI.setInstability(battle.instability || 0);
  if (aiLine) send(ws, JSON.stringify({ type: 'dungeon-ai', text: aiLine }));

  // Build post-game breakdown
  const breakdown = {
    winner: battle.winner,
    turns: battle.turn,
    kills: battle.board.player.reduce((sum, c) => sum + (c.killCount || 0), 0),
    topKiller: [...battle.board.player, ...battle.graveyard].sort((a,b) => (b.killCount||0)-(a.killCount||0))[0]?.name || null,
    rapportGains: Object.entries(saveData.rapport || {})
      .map(([id, v]) => ({ id, name: id, rapport: v }))
      .filter(r => r.rapport > 10)
      .sort((a,b) => b.rapport - a.rapport)
      .slice(0, 3),
    sponsorPassive: saveData.sponsor ? `${saveData.sponsor} passive was active all battle` : null,
    critsLanded: battle.critsThisBattle || 0,
    itemsUsed: battle.itemsUsedThisBattle || 0,
    floorWins: saveData.floorWins || 0,
    levelUps: results.levelUps || [],
    abilityUnlocks: results.abilityUnlocks || [],
  };

  send(ws, JSON.stringify({ type: 'game-over', winner: battle.winner, results, save: saveData, breakdown }));

  // ===== MATCH ANALYST: post-game LLM assessment (async, non-blocking) =====
  (async () => {
    try {
      const fs = require('fs'); const path = require('path');
      const { generateText } = require('./src/api/gemini');
      const dir = path.join(process.env.HOME || '/tmp', 'shared', 'dcc-insights');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const matchSummary = {
        ts: new Date().toISOString(), floor: battle.floor, battleType: battle.battleType, winner: battle.winner,
        turns: battle.turn, protagonistFell: battle.protagonistFell || null,
        playerCards: [...battle.board.player, ...battle.graveyard].map(c => ({ name: c.name, kills: c.killCount || 0, alive: c.currentHP > 0 })),
        enemiesDefeated: battle.board.enemy.length === 0 && battle.hand.enemy.length === 0 && battle.deck.enemy.length === 0,
        breakdown,
      };
      const prompt = `You are a game balance analyst for a card battle game. Analyze this completed match and provide:
1. Was the fight too easy or too hard for the player? Why?
2. Which player cards performed best/worst?
3. Did the enemy AI make good decisions? What could it improve?
4. One concrete suggestion to make this fight more interesting.
5. Any bugs or exploits you notice in the data.

Match data: ${JSON.stringify(matchSummary)}`;
      const analysis = await generateText({ model: 'gemini-3.1-flash-lite', systemInstruction: 'You are a concise game-balance analyst. Be direct and specific.', contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 400 } });
      const entry = { ...matchSummary, analysis: analysis || 'analysis unavailable' };
      fs.appendFileSync(path.join(dir, 'match-insights.jsonl'), JSON.stringify(entry) + '\n');
    } catch (e) { console.error('Match analyst error:', e.message); }
  })();
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`DCC Card Battle on http://localhost:${PORT}`));
