// DCC Card Battle - Client

// Human-readable item effect descriptions (maps internal codes → player-friendly text)
const ITEM_EFFECT_TEXT = {
  fire_dot: 'Sets target on fire (burn damage over time)',
  small_aoe: 'Small explosion — light damage to all enemies',
  medium_aoe: 'Explosion — moderate damage to all enemies',
  large_aoe: 'Big explosion — heavy damage to all enemies',
  massive_aoe: 'Massive blast — huge damage to all enemies',
  fire_aoe: 'Firestorm — burns all enemies',
  divine_aoe: 'Holy blast — heavy damage to all enemies',
  stun_aoe: 'Shockwave — stuns all enemies for 1 turn',
  nuke: 'Devastating single-target damage',
  total_destruction: 'Annihilates the target',
  door_blast: 'Blasts through obstacles / heavy single hit',
  blind: 'Blinds the target (makes them miss)',
  homing: 'Auto-targets and strikes the nearest enemy',
  remote_trigger: 'Can be detonated on command',
  bind_enemy: 'Roots an enemy in place',
  pull_enemy: 'Drags an enemy to the front',
  heal_3: 'Restores a little HP', heal_20: 'Restores 20 HP', shared_heal: 'Heals your whole team',
  restore_mana_3: 'Restores 3 mana', restore_mana_5: 'Restores 5 mana', recharge: 'Refills mana',
  armor_buff: 'Grants bonus armor (damage reduction)',
  attack_buff: 'Boosts attack power',
  all_stats_up: 'Raises all stats', random_buff: 'Grants a random beneficial buff',
  stat_double: 'Doubles a stat temporarily', stealth: 'Become hidden (next strike hits hard)',
  instant_level: 'Instantly levels up a card', upgrade_item: 'Upgrades an item to higher rarity',
  bypass: 'Ignores enemy defenses', rule_break: 'Breaks a dungeon rule (chaotic effect)',
  fall_immunity: 'Immunity to fall/pit damage', cure_debuff: 'Removes a debuff', cure_poison: 'Cures poison/disease',
  reveal_all: 'Reveals all hidden enemies and traps', random_summon: 'Summons a random ally',
  special: 'Unique effect (see lore)',
};
function itemEffectText(item) {
  if (!item) return '';
  const e = item.effect || item.description || '';
  // If it's already a human sentence (has a space and lowercase words), show as-is
  if (ITEM_EFFECT_TEXT[e]) return ITEM_EFFECT_TEXT[e];
  if (/\s/.test(e)) return e; // already descriptive
  if (item.lore) return item.lore;
  return e ? e.replace(/_/g, ' ') : 'Usable item';
}
let ws, state = null, selected = null, saveData = null;

// Resolve candidate art filenames for a card, in priority order.
// Handles boss_/minion_ prefixes (files may or may not keep them), trailing
// instance digits (goblin_4), generic placeholder ids (mob_0), and name fallback.
function norm(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }
const GENERIC_ART_IDS = new Set(['', 'mob', 'elite', 'enemy', 'minion', 'boss', 'lootcard', 'conscript']);
function cardArtCandidates(card) {
  const out = [];
  const rawId = (card.id || '').replace(/_?\d+$/, ''); // strip trailing instance digits
  const idNorm = norm(rawId);                          // e.g. boss_the_hoarder
  const noPrefix = idNorm.replace(/^(boss|minion)_/, '');
  const nm = norm(card.name);
  if (!GENERIC_ART_IDS.has(idNorm)) out.push(idNorm);
  if (noPrefix && noPrefix !== idNorm && !GENERIC_ART_IDS.has(noPrefix)) out.push(noPrefix);
  if (nm) { out.push(nm); out.push('boss_' + nm); }    // creatures may be stored with or without boss_
  return [...new Set(out)].filter(Boolean);
}
// Back-compat single-id resolver (best candidate)
function cardArtId(card) { return cardArtCandidates(card)[0] || norm(card.name); }
// Map a card's active statuses to a persistent elemental aura class
function elementClassFor(statusList) {
  if (!statusList || !statusList.length) return '';
  const blob = statusList.map(s => (s.name || '') + ' ' + (s.desc || '')).join(' ').toLowerCase();
  if (/burn|fire|flame|ember|scorch/.test(blob)) return 'elem-fire';
  if (/poison|venom|toxic|rot|disease|plague|sick/.test(blob)) return 'elem-poison';
  if (/frost|froze|ice|chill|cold/.test(blob)) return 'elem-ice';
  if (/curse|dark|shadow|soul|bedlam|insan|hex/.test(blob)) return 'elem-dark';
  if (/bleed|hemor|wound/.test(blob)) return 'elem-bleed';
  return '';
}
// Human-readable target scope for an ability (single vs multi vs all vs team)
function targetLabel(info) {
  const t = info.target, type = info.type;
  if (type === 'heal' || type === 'buff' || t === 'team') return '🛡️ All allies';
  if (type === 'shield') return '🛡️ An ally';
  if (type === 'taunt' || type === 'self_buff') return '👤 Self';
  const map = {
    single: '🎯 1 enemy',
    aoe: '💥 ALL enemies',
    cleave: '⚔️ 1 enemy + neighbors',
    multi: '🎯 Several enemies',
    overcharge: '💥 1 enemy (+ extras)',
  };
  if (type === 'debuff') return (map[t] || '🎯 1 enemy');
  return map[t] || '';
}
// onerror walker: try the next candidate, then fall back to emoji
function artErr(img) {
  let list = []; try { list = JSON.parse(img.dataset.cands || '[]'); } catch {}
  const i = (+(img.dataset.ci || 0)) + 1;
  if (i < list.length) { img.dataset.ci = i; img.src = '/cards/' + list[i] + '.png'; }
  else if (img.dataset.emoji) { img.parentElement.innerHTML = '<span style="font-size:64px">' + img.dataset.emoji + '</span>'; }
  else { img.src = ''; img.onerror = null; }
}
window.artErr = artErr;
let recognition = null, isListening = false;

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.binaryType = 'arraybuffer';
  ws.onmessage = onMessage;
  ws.onclose = () => setTimeout(connect, 2000);
  ws.onopen = () => { if (localStorage.getItem('dcc_family_mode') === '1') ws.send(JSON.stringify({ type: 'set-family-mode', on: true })); };
  // Kick off music on first user interaction (browser autoplay policy)
  const startAudio = () => {
    if (window.sounds && state) {
      const track = state.battleType === 'boss' ? 'boss_battle' : window.sounds.trackForEnvironment(state.environment, state.floor);
      window.sounds.playBgMusic(track);
    }
    document.removeEventListener('click', startAudio);
    document.removeEventListener('keydown', startAudio);
  };
  document.addEventListener('click', startAudio);
  document.addEventListener('keydown', startAudio);
}

function onMessage(ev) {
  if (ev.data instanceof ArrayBuffer) { queueAudio(ev.data); return; }
  const msg = JSON.parse(ev.data);
  switch (msg.type) {
    case 'init': state = msg.state; saveData = msg.save; render(); showQuest(msg.quest); showFirstTurnHint();
      if (!saveData.sponsor) showSponsorPicker();
      else if (!localStorage.getItem('dcc_welcome_seen')) showWelcome();
      break;
    case 'state': {
      const oldBoard = (state?.player?.board || []).map(c => c.id || c.instanceId);
      state = msg.state;
      checkRapportChanges(state);
      checkStatusAlerts(state);
      document.body.classList.toggle('boss-mode', state.battleType === 'boss');
      render();
      const newBoard = (state?.player?.board || []).map(c => c.id || c.instanceId);
      setTimeout(() => {
        newBoard.forEach(id => {
          if (!oldBoard.includes(id)) {
            const el = document.querySelector(`[data-card-id="${id}"]`);
            if (el) { el.classList.add('entrance'); setTimeout(() => el.classList.remove('entrance'), 500); }
          }
        });
      }, 50);
      break;
    }
    case 'card-speak': addDialogue(msg.cardId, msg.text, msg.rapport); highlight(msg.cardId); break;
    case 'dungeon-ai': addDialogue('🏛️ Dungeon AI', msg.text); break;
    case 'god-played': addDialogue('⚡ ' + msg.card.name, '🙏 ' + msg.boonEffects.join(', ')); break;
    case 'god-chaos': addDialogue('⚡ ' + msg.card.name, '💥 CHAOS: ' + msg.chaosEffects.join(', ')); break;
    case 'audience':
      updateAudienceFeed(msg.data, msg.post);
      break;
    case 'fan-box':
      showFanBox(msg.milestone, msg.event);
      break;
    case 'loot-opened':
      addDialogue('📦', `${msg.box}: ${(msg.applied||[]).join(' · ')}`);
      window.sounds?.playSfx('loot_open');
      showLootBoxOpening(msg.box, msg.applied || []);
      break;
    case 'donut-ability-result':
      if (msg.result.dmg) { window.sounds?.playSfx('spell_cast'); addDialogue('👁️', `Donut's ${msg.result.name}: ${msg.result.dmg} to ${msg.result.target}${msg.result.killed ? ' — KILLED!' : ''}`); }
      else { window.sounds?.playSfx('debuff'); addDialogue('👗', `Donut's ${msg.result.name}: ${msg.result.effect}`); }
      break;
    case 'hero-power-result':
      window.sounds?.playSfx('buff');
      addDialogue('⚡', `${msg.result.name}: ${msg.result.effect}`);
      break;
    case 'rpg-evaluating':
      showRPGModal('evaluating', msg.text);
      break;
    case 'rpg-result':
      showRPGModal('result', msg);
      break;
    case 'boss-intro':
      window.sounds?.playSfx('boss_horn');
      showBossIntro(msg.boss);
      break;
    case 'discover-loot':
      window.sounds?.playSfx('loot_open');
      showDiscoverLoot(msg.boxName, msg.choices);
      break;
    case 'craft-start':
      window.sounds?.playSfx('craft');
      addDialogue('⚗️', `Combining ${msg.itemA} + ${msg.itemB}...`);
      break;
    case 'craft-result':
      window.sounds?.playSfx('level_up');
      showCraftResult(msg.item, msg.fromRecipe);
      break;
    case 'craft-approved':
      addDialogue('📜', `Recipe saved: ${msg.recipe.itemA} + ${msg.recipe.itemB} = ${msg.recipe.result.name}`);
      break;
    case 'fx-disco': triggerDisco(); break;
    case 'fx-gravity': triggerGravity(); break;
    case 'floor-pulse': triggerFloorPulse(); break;
    case 'keyword-trigger': addDialogue(`${msg.kind === 'Battlecry' ? '📢' : '💀'} ${msg.kind}`, msg.text); screenFlash(); break;
    case 'evolution': showEvolution(msg.evolution); break;
    case 'enemy-action':
      if (msg.action === 'play') { window.sounds?.playSfx('card_play'); addDialogue('👹', `${msg.card} enters the battlefield`); }
      else if (msg.action === 'attack') {
        window.sounds?.playSfx('card_attack');
        addDialogue('⚔️', `${msg.card} attacks ${msg.target} for ${msg.dmg} damage`);
        // Land the hit visually on the targeted ally card
        const tEl = [...document.querySelectorAll('#player-board .card')].find(el => el.querySelector('.card-name')?.textContent?.includes(msg.target));
        const aEl = [...document.querySelectorAll('#enemy-board .card')].find(el => el.querySelector('.card-name')?.textContent?.includes(msg.card));
        if (tEl) { window.FX && FX.cast('physical', aEl, tEl); setTimeout(() => { floatText(tEl, '-' + msg.dmg, 'dmg'); hitFlash(tEl); }, 200); }
      }
      else if (msg.action === 'face') {
        window.sounds?.playSfx('card_hit');
        addDialogue('💥', `${msg.card} hits Donut for ${msg.dmg} damage!`);
        const donut = document.getElementById('player-portrait');
        if (donut) { window.FX && FX.impact('physical', donut, { big: true }); floatText(donut, '-' + msg.dmg, 'dmg'); donut.classList.add('hit'); setTimeout(() => donut.classList.remove('hit'), 400); }
        screenFlash();
      }
      else if (msg.action === 'cockroach') { window.sounds?.playSfx('buff'); addDialogue('🪳', `Princess Donut activates COCKROACH! Survives at 1 HP!`); }
      else if (msg.action === 'kill') { window.sounds?.playSfx('card_death'); addDialogue('💀', `${msg.card} was destroyed!`); }
      else if (msg.action === 'ability') { window.sounds?.playSfx('spell_cast'); addDialogue('✨', msg.text); }
      else if (msg.action === 'stunned') { window.sounds?.playSfx('stun'); addDialogue('💫', `${msg.card} is stunned — skips turn`); }
      else if (msg.action === 'status') addDialogue('🌀', msg.text);
      break;
    case 'crawlers-grit':
      window.sounds?.playSfx('buff'); bigBanner("⚡ CRAWLER'S GRIT!", '#ffe14d', `${msg.card} refuses to fall — survives at 1 HP!`);
      addDialogue('⚡', `${msg.card} activates CRAWLER'S GRIT — last stand!`);
      break;
    case 'enemy-ability':
      window.sounds?.playSfx('debuff');
      addDialogue('⚔️', msg.text);
      break;
    case 'god-event':
      if (msg.event === 'chaos') { window.sounds?.playSfx('fire_blast'); bigBanner('⚡ GOD CHAOS!', '#ff8800', msg.effect?.description); addDialogue('⚡ GOD CHAOS', msg.effect?.description || 'The god unleashes chaos!'); screenFlash(); }
      if (msg.event === 'blocked') { addDialogue('🧺 Laundry Day', msg.message); }
      if (msg.event === 'departed') { addDialogue('⚡ God', msg.name + ' has departed.'); }
      break;
    case 'ability-unlock':
      window.sounds?.playSfx('level_up');
      bigBanner('⭐ ABILITY UNLOCKED!', '#ffcc00', `${msg.unlock.name}: ${msg.unlock.ability}`);
      addDialogue('⭐', `${msg.unlock.name} reached Level ${msg.unlock.level}! Unlocked: ${msg.unlock.ability}!`);
      showToast(`🎉 ${msg.unlock.name} unlocked ${msg.unlock.ability} at level ${msg.unlock.level}!`);
      break;
    case 'floor-advance':
      showFloorAdvance(msg);
      break;
    case 'battle-won':
      if (msg.bossNext) bigBanner('⚔️ BOSS NEXT!', '#ff3344', `Win the next battle to clear this floor`);
      else bigBanner('✅ BATTLE WON', '#4caf50', `${msg.remaining} ${msg.remaining === 1 ? 'battle' : 'battles'} until you clear this floor`);
      break;
    case 'dungeon-complete':
      showDungeonComplete(msg);
      break;
    case 'boss-mechanic': {
      const c = msg.fx === 'weak' ? '#ffe14d' : msg.fx === 'heal' ? '#6f9' : msg.fx === 'surge' || msg.fx === 'fuse' ? '#ff6644' : '#c98cff';
      bigBanner(`👹 ${msg.name}`, c, msg.text);
      window.sounds?.playSfx(msg.big ? 'boss_horn' : 'debuff');
      const bossEl = document.querySelector('#enemy-board .boss-card');
      window.FX && FX.boss(msg.fx || 'magic', bossEl);
      if (msg.big) { fireworks(); screenShake(); screenFlash(); }
      else if (msg.fx === 'swarm') fireworks(6);
      break;
    }
    case 'desperado':
      renderDesperado(msg);
      break;
    case 'recruit-offer':
      setTimeout(() => showRecruitOffer(msg.recruits), 5000); // show after floor-advance cinematic
      break;
    case 'recruit-confirmed':
      bigBanner(`🤝 ${msg.name.toUpperCase()} JOINS THE PARTY!`, '#4cf', 'A new ally for the Crawl');
      showToast(`${msg.name} added to your deck`);
      break;
    case 'desperado-result':
      if (msg.ok) { showToast(`🛒 Bought ${msg.bought}!`); window.sounds?.playSfx('loot_claim'); ws.send(JSON.stringify({ type: 'desperado-open' })); }
      else showToast(`❌ ${msg.err}`);
      break;
    case 'wheel-result':
      handleWheelResult(msg);
      break;
    case 'sponsor-unlock':
      showToast(`📺 New sponsor available: ${msg.sponsorId}! Check your sponsor menu.`);
      addDialogue('📺', msg.message);
      break;
    case 'smoke-effect':
      document.getElementById('enemy-board')?.classList.add('smoked');
      setTimeout(() => document.getElementById('enemy-board')?.classList.remove('smoked'), 6000);
      addDialogue('💨', 'Smoke bomb deployed! Enemies blinded (-40 DEX)');
      break;
    case 'free-action-result':
      const fxEffects = msg.result.effects || [];
      const usedEffect = fxEffects.find(e => e.used);
      if (usedEffect) playItemUseFx(usedEffect.used);
      // Particle FX for basic/free attacks (and item damage) — every attack gets effects
      {
        const atkEl = document.querySelector(`[data-card-id="${window._lastFreeAttacker || window._lastAttacker}"]`);
        const enemyEls = [...document.querySelectorAll('#enemy-board .card')];
        fxEffects.forEach(e => {
          if (e.dmg && window.FX) {
            const tEl = enemyEls.find(el => el.querySelector('.card-name')?.textContent?.includes(e.target)) || enemyEls[window._lastTargetIdx] || enemyEls[0];
            const t = /flame|fire|burn|torch/i.test(e.weapon || '') ? 'fire' : /poison|venom/i.test(e.weapon || '') ? 'poison' : 'physical';
            FX.cast(t, atkEl, tEl);
            if (tEl) { setTimeout(() => { floatText(tEl, '-' + e.dmg, 'dmg'); hitFlash(tEl); }, 200); }
          }
          if (e.miss) { const tEl = enemyEls[window._lastTargetIdx] || enemyEls[0]; if (tEl) floatText(tEl, 'MISS', 'dmg'); }
        });
      }
      fxEffects.forEach(e => { if (e.kill) showKillAnnounce(e.kill); });
      // Format effects into readable text (skip internal flags like discover/craft objects)
      const readable = fxEffects.map(e => {
        if (e.used) return `Used ${e.used}${e.effect ? ': ' + e.effect : ''}`;
        if (e.target && e.dmg) return `${e.dmg} to ${e.target}`;
        if (e.healed) return `Healed ${e.healed}`;
        if (e.shield) return `Shielded ${e.shield}`;
        if (e.deployed) return `Deployed ${e.deployed}`;
        if (e.discover || e.craft) return null; // handled by their own modals
        if (typeof e === 'string') return e;
        return null;
      }).filter(Boolean).join(', ');
      const actionLabel = { stack: 'Attack', use_item: 'Used item', open_loot: 'Opened loot', recover: 'Recover', inspect: 'Inspect', taunt: 'Taunt', craft: 'Craft' }[msg.result.action] || msg.result.action;
      if (readable) addDialogue('🆓', `${actionLabel}: ${readable}`);
      break;
    case 'intervention-fired': showToast(`⚡ ${msg.name}: ${msg.effects.join(', ')}`); screenFlash(); break;
    case 'route': showRoute(msg.route); break;
    case 'loot': showLoot(msg.card); break;
    case 'game-over': showGameOver(msg); break;
    case 'error': showToast(msg.message); closeCraftModal(); { const rm = document.getElementById('rpg-modal'); if (rm && rm.querySelector('.rpg-evaluating')) rm.remove(); } break;
    case 'ability-result': playAbilityFx(msg.result, window._lastAttacker, window._lastTargetIdx); actionBanner(msg.result); break;
  }
}

function showToast(text) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(window._toastТimer);
  window._toastТimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// Render
function render() {
  if (!state) return;
  const envName = state.environment?.name;
  document.getElementById('floor-num').textContent = envName || state.floor;
  document.getElementById('turn-num').textContent = state.turn;
  document.getElementById('gold').textContent = saveData?.gold || 0;
  // Set floor background from environment
  const bgId = state.environment?.bg || ('floor' + Math.min(state.floor || 1, 5));
  document.getElementById('center-panel').style.setProperty('--floor-bg', `url('/img/${bgId}.png')`);
  // Play matching ambient music (boss battles get the boss track)
  if (window.sounds) {
    const track = state.battleType === 'boss' ? 'boss_battle' : window.sounds.trackForEnvironment(state.environment, state.floor);
    window.sounds.playBgMusic(track);
  }

  // Player HP arc
  const maxHP = 30 + (state.floor || 1) * 5;
  const hpPct = Math.max(0, Math.min(100, (state.playerHP / maxHP) * 100));
  document.getElementById('player-hp').textContent = state.playerHP;
  const arc = document.getElementById('hp-arc-fill');
  if (arc) {
    const offset = 276 - (276 * hpPct / 100);
    arc.style.strokeDashoffset = offset;
    arc.style.stroke = hpPct > 50 ? '#4ecdc4' : hpPct > 25 ? '#e6a817' : '#f55';
  }
  // Donut ability buttons
  const missileBtn = document.getElementById('donut-missile');
  const laundryBtn = document.getElementById('donut-laundry');
  if (missileBtn) missileBtn.disabled = state.donutMissileUsed || state.currentTurn !== 'player';
  if (laundryBtn) laundryBtn.disabled = state.mana < 3 || state.donutLaundryCd > 0 || state.currentTurn !== 'player';
  const bonusMana = state.mana > state.maxMana ? ` (${state.maxMana} + ${state.mana - state.maxMana} bonus)` : '';
  document.getElementById('player-mana').textContent = `${state.mana}${bonusMana}`;

  // Enemy info
  const enemyOnField = (state.enemy.board?.length || 0);
  const enemyIncoming = (state.enemy.deckSize || 0);
  document.getElementById('enemy-hp').textContent = enemyIncoming > 0 ? `${enemyOnField} on field (+${enemyIncoming} incoming)` : `${enemyOnField} remaining`;
  document.getElementById('btn-end-turn').disabled = state.currentTurn !== 'player';

  const inst = state.instability || 0;
  const instEl = document.getElementById('instability-display');
  if (instEl) instEl.textContent = inst >= 12 ? `🌀 ${inst} UNHINGED` : inst >= 5 ? `🌀 ${inst} glitching` : '';

  // Hide loot count at 0 (only show when relevant)
  const loot = state.pendingLoot || [];
  const lootEl = document.getElementById('loot-indicator');
  if (lootEl) lootEl.textContent = loot.length > 0 ? `📦 ${loot.length} box${loot.length > 1 ? 'es' : ''} — kill rewards (end turn to open)` : '';

  // Sponsor bar
  // Update sponsor badge on Donut portrait
  if (state.sponsor) {
    let badge = document.getElementById('sponsor-badge');
    if (!badge) { badge = document.createElement('div'); badge.id = 'sponsor-badge'; document.getElementById('player-portrait')?.appendChild(badge); }
    badge.textContent = state.sponsor.emoji;
    badge.title = state.sponsor.name + ' — ' + state.sponsor.passive;
  }
  let sponsorEl = document.getElementById('sponsor-bar');
  if (!sponsorEl) { sponsorEl = document.createElement('div'); sponsorEl.id = 'sponsor-bar'; document.body.appendChild(sponsorEl); }
  if (state.sponsor) {
    const iv = state.sponsor.intervention;
    const canFire = state.favor >= (iv?.cost || 30) && state.currentTurn === 'player';
    sponsorEl.innerHTML = `
      <div class="sponsor-name">${state.sponsor.emoji} ${state.sponsor.name}</div>
      <div class="sponsor-passive">${state.sponsor.passive}</div>
      <div class="favor-track"><div class="favor-fill" style="width:${state.favor}%"></div><span>${state.favor}/100</span></div>
      <button id="btn-intervention" class="${canFire ? '' : 'disabled'}" ${canFire ? '' : 'disabled'}>⚡ ${iv?.name || 'Intervention'} (${iv?.cost || 30})</button>
      ${inst >= 5 ? `<div class="instability">🌀 Instability ${inst}${inst >= 12 ? ' — BREAKING FREE' : ''}</div>` : ''}`;
    const btn = document.getElementById('btn-intervention');
    if (btn && canFire) btn.onclick = () => ws.send(JSON.stringify({ type: 'intervention' }));
  }

  // Draw choice
  let drawEl = document.getElementById('draw-choice');
  if (!drawEl) { drawEl = document.createElement('div'); drawEl.id = 'draw-choice'; document.body.appendChild(drawEl); }
  if (state.pendingDraw && state.currentTurn === 'player') {
    // Small delay so enemy turn animations finish before prompting draw
    setTimeout(() => {
      if (!state.pendingDraw) return; // might have been resolved already
      drawEl.innerHTML = `<div class="draw-title">Draw a card — choose your deck:</div>
        <button id="draw-char">🃏 Character Deck <span style="opacity:.6">(${state.player.deckSize} left)</span></button>
        <button id="draw-loot">📦 Loot Deck <span style="opacity:.6">(${state.player.lootDeckSize} left)</span></button>`;
      drawEl.classList.add('show');
      document.getElementById('draw-char').onclick = () => ws.send(JSON.stringify({ type: 'choose-draw', deckType: 'player' }));
      document.getElementById('draw-loot').onclick = () => ws.send(JSON.stringify({ type: 'choose-draw', deckType: 'loot' }));
    }, 800);
  } else {
    drawEl.classList.remove('show');
  }

  renderZone('player-hand', state.player.hand, 'hand');
  renderZone('player-board', state.player.board, 'board');
  renderZone('enemy-board', state.enemy.board, 'enemy-board');
  updateEffectsPanel();
  showTurnHint();
  renderGodZone();
  if (pendingPlayOrigin) animateNewBoardCard();
  // Hide social panel until turn 3
  const socialPanel = document.getElementById('social-panel');
  if (socialPanel) socialPanel.classList.remove('hidden-early');
}

// Contextual hint system — one helpful tip per situation
function showTurnHint() {
  let hintEl = document.getElementById('turn-hint');
  if (!hintEl) { hintEl = document.createElement('div'); hintEl.id = 'turn-hint'; document.getElementById('mid-bar')?.appendChild(hintEl); }

  if (!state) { hintEl.textContent = ''; return; }
  const hand = state.player?.hand || [];
  const board = state.player?.board || [];
  const enemies = state.enemy?.board || [];

  let hint = '';
  if (state.turn <= 1 && board.length === 0 && hand.length > 0) {
    hint = '💡 Drag a card from your hand onto the board (or click it). 🔵=cost 🟠=attack 🟢=health';
  } else if (board.length > 0 && enemies.length > 0 && state.currentTurn === 'player') {
    const ready = board.filter(c => c.abilityInfo?.some(a => a.cost <= state.mana && a.currentCd === 0));
    if (ready.length > 0) hint = '💡 Click your card → pick ability → click enemy. Or End Turn = all auto-attack.';
    else if (state.mana < 2) hint = '💡 No mana left this turn. Hit End Turn — your cards will auto-attack the enemy across from them.';
    else hint = '💡 Hit End Turn — your cards auto-attack their lane opponent.';
  } else if (board.length > 0 && enemies.length === 0) {
    if (state.turn > 1) hint = '✅ All enemies cleared! Hit End Turn to finish.';
    else hint = '💡 Hit End Turn to start the battle — enemies will appear.';
  }
  hintEl.textContent = hint;
}

function renderZone(elId, cards, zone) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  // Enemy board can hold up to 8; player board 5
  const maxSlots = zone === 'hand' ? 0 : (zone === 'enemy-board' ? Math.max(8, cards.length) : 5);

  // For board zones show filled cards + empty lane slots
  const slots = zone === 'hand' ? cards : [
    ...cards,
    ...Array(Math.max(0, maxSlots - cards.length)).fill(null)
  ];

  slots.forEach((c, i) => {
    if (!c) {
      // Empty lane slot
      const slot = document.createElement('div');
      slot.className = `lane-slot ${zone === 'board' ? 'player-slot' : 'enemy-slot'}`;
      slot.textContent = zone === 'board' ? '+ place card' : '';
      el.appendChild(slot);
      return;
    }

    const div = document.createElement('div');
    div.className = 'card';
    div.dataset.cardId = c.id || c.instanceId;

    // Card type for border color
    if (zone === 'enemy-board') div.classList.add('type-enemy');
    else if (c.int > c.str) div.classList.add('type-magic');
    else if (c.type === 'creature' || c.growlOnly) div.classList.add('type-beast');
    else div.classList.add('type-physical');
    // Bosses get a holographic "foil" treatment + minions of a boss get a faint shimmer
    if (c.isBoss) div.classList.add('boss-card');
    else if (c.bossSpawn || c.bossSwarm) div.classList.add('boss-minion-card');
    // Persistent elemental aura from active status effects (burning/poisoned/frozen/cursed)
    const elem = elementClassFor(c.statusList);
    if (elem) div.classList.add(elem);

    // A1: Action state coloring
    if (zone === 'hand') {
      if (c.cost <= state.mana) div.classList.add('affordable');
      else div.classList.add('too-expensive');
    }
    if (zone === 'board' && state.currentTurn === 'player') {
      const hasAbil = c.abilityInfo?.some(a => a.cost <= state.mana && a.currentCd === 0);
      if (hasAbil) div.classList.add('ready');
      else div.classList.add('spent');
    }
    if (zone === 'enemy-board' && selected) div.classList.add('targetable');
    if (selected?.idx === i && selected?.zone === 'board') div.classList.add('selected');
    if (zone === 'hand' && c.cost > state.mana) div.style.opacity = '0.4';

    const hpPct = c.maxHP ? Math.max(0, Math.round(c.currentHP / c.maxHP * 100)) : 100;
    const hpColor = hpPct > 50 ? '#30d060' : hpPct > 25 ? '#e6a817' : '#f55';
    const rapport = c.rapport || 50;
    const lvl = c.level || 1;
    const artCands = cardArtCandidates(c);
    const artSrc = `/cards/${artCands[0] || norm(c.name)}.png`;
    const emoji = c.emoji || (zone === 'enemy-board' ? '👹' : '⚔️');
    // ATK = base + STR/2, HP = currentHP
    const atkVal = c.abilityInfo?.[0]?.damage || (c.str ? Math.floor(c.str/2)+3 : c.attack || '?');
    const hpVal = c.currentHP ?? '?';
    const isLoot = c.isLootCard;

    // HP-based border classes
    div.classList.remove('hp-warn','hp-crit','shielded');
    if (hpPct <= 30 && zone !== 'hand') div.classList.add('hp-crit');
    else if (hpPct <= 60 && zone !== 'hand') div.classList.add('hp-warn');

    let abilitiesHtml = '';
    if (zone === 'board' && c.abilityInfo) {
      abilitiesHtml = '<div class="card-abilities">' + c.abilityInfo.map(info => {
        const onCd = info.currentCd > 0;
        const used = c.usedAction;
        const isSpell = info.kind === 'spell';
        const label = isSpell ? `🔮${info.cost}` : '⚡';
        const tip = `${info.name} — ${isSpell ? info.cost + ' mana SPELL' : 'FREE SKILL'}: ${info.preview||''}`;
        return `<span class="ability-pip ${onCd||used ? 'on-cd' : ''} ${isSpell?'pip-spell':'pip-skill'}" title="${tip}">${label} ${info.name.split(' ')[0].slice(0,4)}</span>`;
      }).join('') + '</div>';
    }

    // Keyword icons
    const KW_ICONS = { taunt:'🛡️', stealth:'🌫️', lifesteal:'🩸', cleave:'↔️', deathrattle:'💀', battlecry:'📢', regenerate:'💚', first_strike:'⚡', thorns:'🌵' };
    const KW_TIPS = { taunt:'Taunt: Enemies must attack this first', stealth:'Stealth: Can\'t be targeted until it attacks', lifesteal:'Lifesteal: Damage heals your team', cleave:'Cleave: Hits adjacent enemies too', deathrattle:'Deathrattle: Triggers effect on death', battlecry:'Battlecry: Triggers effect when played', regenerate:'Regenerate: Heals each turn', first_strike:'First Strike: Attacks before enemy reacts', thorns:'Thorns: Hurts attackers back' };
    let keywordsHtml = '';
    if (c.keywords?.length) {
      keywordsHtml = '<div class="card-keywords">' + c.keywords.map(k => `<span class="kw-icon" title="${KW_TIPS[k]||k}">${KW_ICONS[k]||'•'}</span>`).join('') + '</div>';
    }
    // Status effect chips
    let statusHtml = '';
    if (c.statusList?.length) {
      statusHtml = '<div class="card-statuses">' + c.statusList.map(s => `<span class="status-icon status-${s.type}" title="${s.name}: ${s.desc} (${s.turnsLeft}t)">${s.icon}</span>`).join('') + '</div>';
    }

    div.innerHTML = `
      <span class="cost">${c.cost ?? '?'}</span>
      ${statusHtml}
      ${!isLoot ? `<span class="lvl-badge">${lvl}</span>` : ''}
      <div class="portrait">${isLoot
        ? '<span style="font-size:56px;margin-top:30px">📦</span>'
        : `<img src="${artSrc}" data-cands='${JSON.stringify(artCands)}' data-emoji="${emoji}" onerror="artErr(this)" loading="lazy">`
      }</div>
      ${keywordsHtml}
      <div class="card-name">${c.name || '?'}</div>
      <div class="card-bottom">
        ${!isLoot ? `<div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%;background:${hpColor}"></div></div>` : ''}
        ${isLoot ? `<div style="font-size:10px;color:#d4a017;text-align:center;margin:4px 0">${c.tier||''} tier · play to open</div>` : ''}
        ${abilitiesHtml}
        <div class="stat-badges">
          <div class="stat-atk" title="Attack Power (STR/2 + base)">${atkVal}</div>
          <div class="stat-hp" title="Current HP / Max HP (from CON)">${hpVal}${c.maxHP ? '<br><span style=font-size:9px>'+c.maxHP+'</span>' : ''}</div>
        </div>
        ${c.equippedWeapon ? `<div class="equipped-badge weapon-badge" title="${c.equippedWeapon.name}">⚔️</div>` : ''}
        ${c.equippedArmor ? `<div class="equipped-badge armor-badge" title="${c.equippedArmor.name}">🛡️</div>` : ''}
        ${!isLoot ? `<div class="rapport-bar" title="Rapport ${rapport}/100 — Chat with this card to build bond: higher rapport = +dmg bonus & better ability rolls"><div class="fill" style="width:${rapport}%"></div></div>` : ''}
      </div>
    `;

    if (zone === 'hand') div.onclick = () => playCard(i);
    else if (zone === 'board') div.onclick = () => selectAttacker(i);
    else if (zone === 'enemy-board' && selected) div.onclick = () => doAttack(i);
    else if (zone === 'enemy-board') div.oncontextmenu = div.onclick = (e) => { e.preventDefault(); showCardDetail(c, zone); };
    // Right-click for detail on any card
    if (zone !== 'enemy-board') div.oncontextmenu = (e) => { e.preventDefault(); showCardDetail(c, zone); };
    // Drag-to-play for hand cards
    if (zone === 'hand') {
      div.draggable = true;
      div.dataset.handIdx = i;
      div.ondragstart = (e) => { e.dataTransfer.setData('handIdx', i); div.classList.add('dragging'); };
      div.ondragend = () => div.classList.remove('dragging');
    }
    el.appendChild(div);
  });

  // Fan the hand cards in an arc
  if (zone === 'hand') fanHand(el);
}

// Hearthstone-style fanned hand layout
function fanHand(handEl) {
  const cards = [...handEl.querySelectorAll('.card')];
  const n = cards.length;
  if (n === 0) return;
  const maxAngle = Math.min(3, 15 / n);
  const mid = (n - 1) / 2;
  cards.forEach((card, i) => {
    const offset = i - mid;
    const angle = offset * maxAngle;
    card.style.transform = `rotate(${angle}deg)`;
    card.style.transformOrigin = 'bottom center';
    card.style.zIndex = 10 + i;
    // Hover is handled by CSS (margin-bottom transition)
    // Keep the hand-tip for ability preview on hover
    card.onmouseenter = () => {
      const c = (state?.player?.hand || [])[i];
      if (c && !c.isLootCard && c.abilityInfo?.length) {
        let tip = card.querySelector('.hand-tip');
        if (!tip) { tip = document.createElement('div'); tip.className = 'hand-tip'; card.appendChild(tip); }
        tip.innerHTML = c.abilityInfo.map(a => `<div><b>${a.name}</b> ${a.cost}💎: ${a.preview||''}</div>`).join('');
      }
    };
    card.onmouseleave = () => {
      const tip = card.querySelector('.hand-tip');
      if (tip) tip.remove();
    };
  });
}

function playCard(i) {
  if (state.currentTurn !== 'player') return;
  window.sounds?.playSfx('card_play');
  const handEl = document.querySelectorAll('#player-hand .card')[i];
  // Store the hand card's position so we can animate from it after render
  if (handEl) {
    const r = handEl.getBoundingClientRect();
    pendingPlayOrigin = { x: r.left, y: r.top, w: r.width, h: r.height };
    handEl.style.visibility = 'hidden';
  }
  selected = null;
  ws.send(JSON.stringify({ type: 'play-card', index: i }));
}

let pendingPlayOrigin = null;

// Called after render() when a new card appears on the player board
function animateNewBoardCard() {
  if (!pendingPlayOrigin) return;
  const origin = pendingPlayOrigin;
  pendingPlayOrigin = null;
  // The newly rendered card is the last one in player-board
  const boardCards = document.querySelectorAll('#player-board .card');
  if (!boardCards.length) return;
  const newCard = boardCards[boardCards.length - 1];
  const dest = newCard.getBoundingClientRect();
  // Create a flying clone starting at hand position
  const fly = newCard.cloneNode(true);
  fly.style.cssText = `position:fixed;left:${origin.x}px;top:${origin.y}px;width:${origin.w}px;height:${origin.h}px;z-index:9999;pointer-events:none;transition:left .45s cubic-bezier(.4,0,.2,1),top .45s cubic-bezier(.4,0,.2,1),width .45s,height .45s`;
  document.body.appendChild(fly);
  newCard.style.opacity = '0';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    fly.style.left = dest.left + 'px';
    fly.style.top = dest.top + 'px';
    fly.style.width = dest.width + 'px';
    fly.style.height = dest.height + 'px';
  }));
  setTimeout(() => { fly.remove(); newCard.style.opacity = ''; }, 480);
}
function selectAttacker(i) {
  if (state.currentTurn !== 'player') { showToast("It's not your turn"); return; }
  const card = state.player.board[i];
  if (!card) return;
  // Show full card detail with ability buttons embedded
  showCardDetailWithAbilities(card, i);
}

function showAbilityPicker(cardIdx) {
  const card = state.player.board[cardIdx];
  if (!card) return;
  let picker = document.getElementById('ability-picker');
  if (!picker) {
    picker = document.createElement('div');
    picker.id = 'ability-picker';
    document.body.appendChild(picker);
  }
  const abils = (card.abilityInfo || []).map(info => {
    const onCd = info.currentCd > 0;
    const tooExpensive = (info.cost || 0) > state.mana;
    const disabled = onCd || tooExpensive;
    const kindTag = info.kind === 'spell' ? `<span class="abil-tag spell">🔮 ${info.cost} MANA</span>` : `<span class="abil-tag skill">⚡ FREE</span>`;
    return `<button class="abil-btn ${disabled ? 'disabled' : ''}" data-ability="${info.id}" ${disabled ? 'disabled' : ''}>
      <div class="abil-head"><b>${info.name}</b> ${kindTag}</div>
      <div class="abil-target">${targetLabel(info)}</div>
      <small>${info.preview || ''}${onCd ? ` · CD ${info.currentCd}` : ''}${tooExpensive ? ' · need mana' : ''}</small>
    </button>`;
  }).join('');
  picker.innerHTML = `<div class="picker-title">${card.name} — choose ability (💎 ${state.mana} mana available)</div>${abils}
    <button class="abil-btn cancel" data-ability="cancel">Cancel</button>`;
  picker.classList.add('show');
  picker.querySelectorAll('.abil-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const a = btn.dataset.ability;
      if (a === 'cancel') { selected = null; hideAbilityPicker(); render(); return; }
      selected.ability = a;
      const info = (card.abilityInfo || []).find(x => x.id === a);
      if (info && ['self', 'team', 'ally'].includes(info.target)) {
        window._lastAttacker = card?.id || card?.instanceId;
        window._lastTargetIdx = 0;
        ws.send(JSON.stringify({ type: 'use-ability', cardIndex: selected.idx, abilityId: a, targetIndex: 0 }));
        selected = null; hideAbilityPicker();
      } else {
        showToast('Now click an enemy target');
      }
    };
  });
}

function abilityDesc(ab) {
  if (!ab) return '';
  if (ab.type === 'physical' || ab.type === 'fire' || ab.type === 'magic') {
    const tgt = ab.target === 'aoe' ? 'all enemies' : ab.target === 'cleave' ? 'target + splash' : ab.target === 'multi' ? 'multiple' : 'one enemy';
    return `Damage ${tgt}`;
  }
  if (ab.type === 'buff') return `Buff team +${ab.buff} ${ab.stat}`;
  if (ab.type === 'heal') return `Heal team ${ab.healAmt || 30}`;
  if (ab.type === 'shield') return `Shield ${ab.shield}`;
  if (ab.mark) return 'Mark enemy (+50% dmg)';
  if (ab.type === 'execute') return 'Execute low-HP enemy';
  if (ab.type === 'self_buff') return 'Double next attack';
  if (ab.type === 'taunt') return 'Taunt + defense';
  if (ab.type === 'debuff') return 'Weaken enemy';
  return ab.type || '';
}

function hideAbilityPicker() {
  const p = document.getElementById('ability-picker');
  if (p) p.classList.remove('show');
}

function doAttack(targetIdx) {
  if (!selected) return;
  if (selected.freeAction) {
    const c = (state.player.board || [])[selected.idx];
    window._lastFreeAttacker = c?.id || c?.instanceId;
    window._lastTargetIdx = targetIdx;
    ws.send(JSON.stringify({ type: 'free-action', cardIndex: selected.idx, action: selected.freeAction, targetIndex: targetIdx }));
    selected = null;
    return;
  }
  const card = state.player.board[selected.idx];
  const ability = selected.ability || card?.abilities?.[0];
  window._lastAttacker = card?.id || card?.instanceId;
  window._lastTargetIdx = targetIdx;
  ws.send(JSON.stringify({ type: 'use-ability', cardIndex: selected.idx, abilityId: ability, targetIndex: targetIdx }));
  selected = null;
  hideAbilityPicker();
}
function attackFace() {
  showToast('Defeat all enemies to win — no face attacks in this mode');
}
function endTurn() {
  if (state.currentTurn !== 'player') return;
  window.sounds?.playSfx('turn_end');
  selected = null;
  hideAbilityPicker();

  // B1: Auto-battle — all ready board cards fire their best ability
  const boardCards = state.player.board || [];
  const enemies = state.enemy.board || [];

  if (boardCards.length > 0 && enemies.length > 0) {
    let chain = Promise.resolve();
    boardCards.forEach((card, ci) => {
      if (card.usedAction) return; // already acted manually this turn
      // Find best affordable ability (skills are free, spells need mana) not on CD
      const bestAbil = (card.abilityInfo || [])
        .filter(a => a.damage && (a.kind === 'skill' || a.cost <= state.mana) && a.currentCd === 0)
        .sort((a, b) => b.damage - a.damage)[0];
      if (!bestAbil) return;

      // Target: lane opponent (same index) or nearest enemy
      const targetIdx = Math.min(ci, enemies.length - 1);

      chain = chain.then(() => new Promise(resolve => {
        window._lastAttacker = card.id || card.instanceId;
        window._lastTargetIdx = targetIdx;
        ws.send(JSON.stringify({ type: 'use-ability', cardIndex: ci, abilityId: bestAbil.id, targetIndex: targetIdx }));
        setTimeout(resolve, 400); // stagger attacks for visual drama
      }));
    });

    // After all auto-attacks, end the turn
    chain.then(() => {
      setTimeout(() => ws.send(JSON.stringify({ type: 'end-turn' })), 300);
    });
  } else {
    // No board cards or no enemies — just end turn directly
    ws.send(JSON.stringify({ type: 'end-turn' }));
  }
}

// Dialogue
function addDialogue(cardId, text, rapport) {
  if (!text || text === 'null' || text === 'undefined') return; // skip null/empty
  const log = document.getElementById('live-log');
  // Clean up card IDs like "bugbear1" → "Bugbear", "dungeon-ai" stays as-is
  let name = cardId || '?';
  if (name !== '🏛️ Dungeon AI' && name !== 'player' && name !== '📜 Quest') {
    // Strip numbers, replace underscores, capitalize
    name = name.replace(/\d+$/, '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  }
  const div = document.createElement('div');
  div.className = 'line';
  const color = name === 'player' ? '#4ecdc4' : name.includes('Dungeon') ? '#fa8' : '#d4a017';
  div.innerHTML = `<span class="speaker" style="color:${color}">${name}:</span> ${text}`;
  log.insertBefore(div, log.firstChild);
  while (log.children.length > 30) log.removeChild(log.lastChild);
}

function highlight(cardId) {
  document.querySelectorAll('.card.speaking').forEach(e => e.classList.remove('speaking'));
  document.querySelectorAll('.speech-bubble').forEach(e => e.remove());
  const el = document.querySelector(`[data-card-id="${cardId}"]`);
  if (el) {
    el.classList.add('speaking');
    const b = document.createElement('div'); b.className = 'speech-bubble'; b.textContent = '💬';
    el.appendChild(b);
    setTimeout(() => { el.classList.remove('speaking'); b.remove(); }, 3500);
  }
}
function showRoute(route) {
  // Brief flash of who coordinator thinks is addressed
  if (route.addressed && route.addressed !== 'general') {
    const el = document.querySelector(`[data-card-id*="${route.addressed}"]`);
    if (el) { el.style.outline = '2px solid #ff0'; setTimeout(() => el.style.outline = '', 1500); }
  }
}

// ====== ANIMATION / FX SYSTEM ======
function cardCenter(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Generic big-text banner for important events
function bigBanner(text, color, sub) {
  const el = document.createElement('div');
  el.className = 'big-banner';
  el.innerHTML = `<div class="big-banner-main" style="color:${color}">${text}</div>${sub ? `<div class="big-banner-sub">${sub}</div>` : ''}`;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 450); }, 1100);
}

// Detect new debuffs on player cards and alert prominently
let _knownStatuses = {};
function checkStatusAlerts(newState) {
  const board = newState?.player?.board || [];
  board.forEach(c => {
    const key = c.id || c.instanceId;
    const prev = _knownStatuses[key] || [];
    const curr = (c.statusList || []).map(s => s.name);
    curr.forEach(name => {
      if (!prev.includes(name)) {
        const st = (c.statusList || []).find(s => s.name === name);
        if (st && st.type !== 'buff') {
          bigBanner(`${st.icon} ${c.name.toUpperCase()} ${name.toUpperCase()}!`, '#ff5555', st.desc);
          window.sounds?.playSfx(name.toLowerCase().includes('stun') ? 'stun' : 'debuff');
        }
      }
    });
    _knownStatuses[key] = curr;
  });
}

function showKillAnnounce(enemyName) {
  screenFlash();
  window.sounds?.playSfx('card_death');
  window._killCombo = (window._killCombo || 0) + 1;
  clearTimeout(window._killComboReset);
  window._killComboReset = setTimeout(() => { window._killCombo = 0; }, 2500);
  const combo = window._killCombo;
  const verbs = ['SMUSHED', 'CRUSHED', 'OBLITERATED', 'DESTROYED', 'ANNIHILATED', 'WRECKED', 'PULVERIZED', 'SPLATTERED'];
  const verb = verbs[Math.floor(Math.random() * verbs.length)];
  const comboBanner = combo >= 4 ? `🔥 ${combo}x RAMPAGE!` : combo === 3 ? '⚡ TRIPLE KILL!' : combo === 2 ? '💥 DOUBLE KILL!' : '';
  const el = document.createElement('div');
  el.className = 'kill-announce';
  el.innerHTML = `
    ${comboBanner ? `<div class="kill-combo">${comboBanner}</div>` : ''}
    <div class="kill-announce-main">${(enemyName||'ENEMY').toUpperCase()} ${verb}!</div>`;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 500); }, 1300);
}

function floatText(el, text, kind = 'dmg') {
  if (!el) return;
  const c = cardCenter(el);
  const ft = document.createElement('div');
  ft.className = `float-text ${kind}`;
  ft.textContent = text;
  ft.style.left = (c.x - 20 + (Math.random() * 30 - 15)) + 'px';
  ft.style.top = (c.y - 20) + 'px';
  document.body.appendChild(ft);
  setTimeout(() => ft.remove(), 1100);
}

function hitFlash(el) {
  if (!el) return;
  el.classList.add('hit');
  setTimeout(() => el.classList.remove('hit'), 320);
}

// Color-coded action banner — announces what an ability did (every action type gets its own color)
const ACTION_COLORS = { physical: '#ff8a3d', fire: '#ff5522', poison: '#7ed957', magic: '#9d7bff', skill: '#ffcf4d', heal: '#4dd97a', buff: '#ffe14d', shield: '#5cc8ff', debuff: '#ff5d8a', dark: '#b06bff' };
function actionBanner(result) {
  if (!result || !result.ability) return;
  const fx = result.effects || [];
  // Don't double-announce kills (the kill crash handles those)
  const totalDmg = fx.reduce((s, e) => s + (e.dmg || 0), 0);
  const healed = fx.find(e => e.heal);
  const buffed = fx.find(e => e.buff);
  let type = result.dmgType || (result.kind === 'spell' ? 'magic' : 'skill');
  let label = result.ability.toUpperCase();
  if (healed) { type = 'heal'; label = `${result.ability.toUpperCase()} +${healed.heal}`; }
  else if (totalDmg > 0) { label = `${result.ability.toUpperCase()} −${totalDmg}`; }
  else if (buffed) { type = 'buff'; }
  const color = ACTION_COLORS[type] || '#fff';
  const el = document.createElement('div');
  el.className = 'action-banner';
  el.innerHTML = `<span class="action-banner-text" style="color:${color}">${label}</span>`;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 400); }, 700);
}

function screenFlash() {
  let f = document.getElementById('fx-flash');
  if (!f) { f = document.createElement('div'); f.id = 'fx-flash'; document.body.appendChild(f); }
  f.classList.remove('flash'); void f.offsetWidth; f.classList.add('flash');
}

// Boss spectacle: burst of colorful fireworks across the arena
function fireworks(count = 14) {
  const colors = ['#ff3366', '#ffcc00', '#33ff99', '#3399ff', '#cc66ff', '#ff8800'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'firework';
    p.style.left = (10 + Math.random() * 80) + 'vw';
    p.style.top = (15 + Math.random() * 55) + 'vh';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.animationDelay = (Math.random() * 0.4) + 's';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }
}

function screenShake() {
  const el = document.getElementById('center-panel') || document.body;
  el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 600);
}

function projectile(fromEl, toEl, color, emoji) {
  if (!fromEl || !toEl) return;
  const a = cardCenter(fromEl), b = cardCenter(toEl);
  const p = document.createElement('div');
  if (emoji) { p.className = 'fx-burst'; p.textContent = emoji; p.style.fontSize = '28px'; }
  else { p.className = 'fx-projectile'; p.style.background = color || '#6cf'; p.style.color = color || '#6cf'; }
  p.style.left = a.x + 'px'; p.style.top = a.y + 'px';
  p.style.transition = 'left .3s ease-in, top .3s ease-in';
  document.body.appendChild(p);
  requestAnimationFrame(() => { p.style.left = b.x + 'px'; p.style.top = b.y + 'px'; });
  setTimeout(() => { p.remove(); burstAt(toEl, emoji || '💥'); }, 320);
}

function burstAt(el, emoji) {
  if (!el) return;
  const c = cardCenter(el);
  const b = document.createElement('div');
  b.className = 'fx-burst'; b.textContent = emoji;
  b.style.left = (c.x - 20) + 'px'; b.style.top = (c.y - 20) + 'px';
  document.body.appendChild(b);
  setTimeout(() => b.remove(), 500);
}

function swoopAttack(attackerEl, targetEl) {
  if (!attackerEl || !targetEl) return;
  const a = cardCenter(attackerEl), b = cardCenter(targetEl);
  const dx = b.x - a.x, dy = b.y - a.y;
  attackerEl.classList.add('attacking');
  attackerEl.style.transition = 'transform .18s ease-in';
  attackerEl.style.transform = `translate(${dx*0.6}px,${dy*0.6}px) scale(1.1)`;
  setTimeout(() => {
    attackerEl.style.transition = 'transform .25s ease-out';
    attackerEl.style.transform = '';
    setTimeout(() => attackerEl.classList.remove('attacking'), 250);
  }, 180);
}

const ABILITY_FX = {
  fire: { color: '#ff6622', emoji: '🔥' },
  magic: { color: '#bb66ff', emoji: '✨' },
  physical: { color: '#ffcc44', emoji: '💥' },
  ice: { color: '#66ccff', emoji: '❄️' },
  heal: { color: '#5fff8f', emoji: '💚' },
};

// Per-item unique attack animations
const ITEM_FX = {
  // Explosives → fire AoE
  'bomb': { type: 'fire', emoji: '💣', aoe: true },
  'jug o': { type: 'fire', emoji: '🫙🔥', aoe: true },
  'dynamite': { type: 'fire', emoji: '🧨', aoe: true },
  'grenade': { type: 'fire', emoji: '💥', aoe: true },
  'waffle maker': { type: 'fire', emoji: '🧇💥', aoe: true },
  'doomsday': { type: 'fire', emoji: '☢️', aoe: true, screenShake: true },
  'moab': { type: 'fire', emoji: '☢️💥', aoe: true, screenShake: true },
  // Ice
  'graupel': { type: 'ice', emoji: '🌨️', aoe: true },
  'icicle': { type: 'ice', emoji: '🧊', aoe: false },
  // Magic
  'scroll': { type: 'magic', emoji: '📜✨', aoe: false },
  'tome': { type: 'magic', emoji: '📖✨', aoe: false },
  'wand': { type: 'magic', emoji: '🪄', aoe: false },
  'celestial': { type: 'magic', emoji: '⚡🌟', aoe: false },
  // Heal
  'potion': { type: 'heal', emoji: '🧪', aoe: false },
  'brew': { type: 'heal', emoji: '⚗️', aoe: false },
  // Plushies
  'stuffed': { type: 'magic', emoji: '🧸', aoe: false },
  'grulke': { type: 'physical', emoji: '🐸💥', aoe: false },
  'pyxie': { type: 'magic', emoji: '🦇✨', aoe: false },
  // Weapons
  'gauntlet': { type: 'physical', emoji: '🥊', aoe: false },
  'crossbow': { type: 'physical', emoji: '🏹', aoe: false },
  'flamethrower': { type: 'fire', emoji: '🔥💨', aoe: true },
  'slingshot': { type: 'physical', emoji: '🪃', aoe: false },
  'nickel sock': { type: 'physical', emoji: '🧦💰', aoe: false },
};

function getItemFx(itemName) {
  const n = (itemName || '').toLowerCase();
  return Object.entries(ITEM_FX).find(([key]) => n.includes(key))?.[1] || { type: 'physical', emoji: '💥', aoe: false };
}

function playItemUseFx(itemName) {
  const fx = getItemFx(itemName);
  const enemyCards = document.querySelectorAll('#enemy-board .card');
  if (fx.screenShake) screenFlash();
  if (fx.aoe && enemyCards.length) {
    enemyCards.forEach(el => { floatText(el, fx.emoji, 'dmg'); });
  } else if (enemyCards.length) {
    const tgt = enemyCards[0];
    floatText(tgt, fx.emoji, 'dmg');
  }
}

// Play FX based on an ability result from the server
function playAbilityFx(result, attackerId, targetIdx) {
  if (!result) return;
  // SFX based on ability type
  const sfxMap = { fire: 'fire_blast', ice: 'ice_blast', magic: 'spell_cast', heal: 'heal', buff: 'buff', debuff: 'debuff', physical: 'card_attack' };
  window.sounds?.playSfx(result.kind === 'spell' ? (sfxMap[result.dmgType] || 'spell_cast') : (sfxMap[result.dmgType] || 'card_attack'));
  if (result.effects?.some(e => e.crit)) window.sounds?.playSfx('crit');
  const attackerEl = document.querySelector(`[data-card-id="${attackerId}"]`);
  const fxType = ABILITY_FX[result.dmgType] || ABILITY_FX.physical;
  const enemyCards = [...document.querySelectorAll('#enemy-board .card')];
  const targetEl = enemyCards[targetIdx] || enemyCards.find(el => el.querySelector('.card-name')?.textContent?.includes(result.effects?.[0]?.target)) || enemyCards[0];

  // Lane connection beam
  if (attackerEl && targetEl) {
    const beam = document.createElement('div');
    beam.className = 'lane-beam';
    const a = cardCenter(attackerEl), b = cardCenter(targetEl);
    const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    beam.style.cssText = `left:${a.x}px;top:${a.y}px;width:${dist}px;transform:rotate(${angle}deg);transform-origin:0 50%`;
    document.body.appendChild(beam);
    setTimeout(() => beam.remove(), 500);
  }

  // Swoop attack
  if (attackerEl && targetEl) swoopAttack(attackerEl, targetEl);

  // Effects with stagger
  const TYPE_TO_FX = { ice: 'frost', debuff: 'dark', buff: 'arcane', poison: 'poison', fire: 'fire', magic: 'magic', holy: 'holy', dark: 'dark', physical: 'physical' };
  const fxKind = TYPE_TO_FX[result.dmgType] || (result.kind === 'spell' ? 'magic' : 'physical');
  const isBigSpell = result.kind === 'spell' && (result.target === 'aoe' || (result.effects || []).length >= 3);
  if (window.FX) FX.signature(result.ability, attackerEl, targetEl); // marquee-ability flair
  if (isBigSpell && targetEl && window.FX) FX.bigSpell(fxKind, targetEl);
  (result.effects || []).forEach((eff, i) => {
    setTimeout(() => {
      if (eff.dmg) {
        const tEl = enemyCards.find(el => el.querySelector('.card-name')?.textContent?.includes(eff.target)) || targetEl;
        if (window.FX) FX.cast(fxKind, attackerEl, tEl, { big: eff.crit || eff.big });
        else if (attackerEl && tEl) projectile(attackerEl, tEl, fxType.color, fxType.emoji);
        setTimeout(() => {
          floatText(tEl, (eff.crit ? '💥 CRIT! ' : '') + '-' + eff.dmg, eff.crit ? 'crit' : 'dmg');
          hitFlash(tEl);
          if (eff.crit) { window.FX && FX.crit(tEl); screenFlash(); }
        }, 240);
      }
      if (eff.heal) document.querySelectorAll('#player-board .card').forEach(el => { floatText(el, '+' + eff.heal, 'heal'); window.FX && FX.heal(el); });
      if (eff.kill) { window.sounds?.playSfx('card_death'); showKillAnnounce(eff.kill); }
      if (eff.buff) document.querySelectorAll('#player-board .card').forEach(el => { floatText(el, '▲ ' + (typeof eff.buff === 'string' ? eff.buff.replace(' all', '') : 'BUFF'), 'buff'); window.FX && FX.heal(el); });
      if (eff.shield) { const sEl = document.querySelectorAll('#player-board .card')[0]; const named = [...document.querySelectorAll('#player-board .card')].find(el => el.querySelector('.card-name')?.textContent?.includes(eff.shield)); const t = named || sEl; if (t) { floatText(t, '🛡️ +' + (eff.amount || '') + ' shield', 'buff'); } }
      if (eff.stun) { const tEl = enemyCards.find(el => el.querySelector('.card-name')?.textContent?.includes(eff.stun)) || targetEl; if (tEl) { floatText(tEl, '💫 STUNNED', 'debuff'); } }
      if (eff.rage) floatText(attackerEl, '⚡ RAGE', 'buff');
      if (eff.debuff) {
        const tEl = enemyCards.find(el => el.querySelector('.card-name')?.textContent?.includes(eff.debuff)) || targetEl;
        if (tEl) { floatText(tEl, '🌀 ' + (eff.ability || 'Debuffed'), 'debuff'); hitFlash(tEl); window.FX && FX.cast('dark', attackerEl, tEl); }
      }
      if (eff.conscripted) { window.sounds?.playSfx('buff'); bigBanner(`🪢 ${eff.conscripted.toUpperCase()} CONSCRIPTED!`, '#4cf', eff.sacrificed ? `${eff.sacrificed} flew off with them` : 'Joined your team!'); }
      if (eff.fizzle) showToast(`💨 ${eff.fizzle}`);
      // Boss mechanic feedback — teach the weakness through dramatic feedback
      const bossEl = document.querySelector('#enemy-board .boss-card');
      if (eff.bossFx && window.FX) FX.boss(eff.bossFx, bossEl);
      if (eff.bossNote) {
        if (eff.bossFx === 'resist') { showToast(eff.bossNote); }
        else if (eff.bossFx === 'weak') { bigBanner('WEAK POINT!', '#ffe14d', eff.bossNote); fireworks(); window.sounds?.playSfx('crit'); }
        else if (eff.bossFx === 'reflect') { bigBanner('🔥 REFLECTED!', '#ff5522', eff.bossNote); screenFlash(); }
        else if (eff.bossFx === 'revive') { bigBanner('🪳 COCKROACH!', '#8f8', eff.bossNote); fireworks(); }
        else showToast(eff.bossNote);
      }
      if (eff.bossTrigger) { bigBanner(eff.big ? '💥 CHOKE!' : '🤢', '#9f6', eff.bossTrigger); if (eff.big) { fireworks(); screenShake(); window.sounds?.playSfx('boss_horn'); } }
      if (eff.reflect) floatText(attackerEl, '-' + eff.reflect, 'dmg');
    }, i * 140);
  });
}

// Audio
let audioQueue = [], playing = false;
function queueAudio(buf) { audioQueue.push(buf); if (!playing) playNext(); }
function playNext() {
  if (!audioQueue.length) { playing = false; return; }
  playing = true;
  const blob = new Blob([audioQueue.shift()], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  const a = new Audio(url);
  a.volume = window.sounds ? window.sounds.voiceVolume() : 1;
  if (a.volume === 0) { URL.revokeObjectURL(url); playNext(); return; } // voice muted
  a.onended = () => { URL.revokeObjectURL(url); playNext(); };
  a.onerror = () => { URL.revokeObjectURL(url); playNext(); };
  a.play().catch(() => playNext());
}

// Push-to-talk (SPACE)
function initVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.onresult = (ev) => {
    const t = Array.from(ev.results).map(r => r[0].transcript).join('');
    document.getElementById('voice-transcript').textContent = t || 'Listening...';
    const last = ev.results[ev.results.length - 1];
    if (last.isFinal && t.trim()) {
      ws.send(JSON.stringify({ type: 'voice', transcript: t.trim() }));
      addDialogue('player', t.trim());
      document.getElementById('live-log').lastChild?.classList.add('you');
    }
  };
  recognition.onend = () => {
    // Only show indicator while spacebar is held — don't auto-restart
    if (!isListening) {
      document.getElementById('voice-hud').classList.add('hidden');
    } else {
      // Spacebar still held — restart
      try { recognition.start(); } catch(x) {}
    }
  };
  recognition.onerror = () => { isListening = false; document.getElementById('voice-hud').classList.add('hidden'); };
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat && !isListening && recognition) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return; // don't hijack typing
    e.preventDefault();
    isListening = true;
    document.getElementById('voice-hud').classList.remove('hidden');
    document.getElementById('voice-transcript').textContent = 'Listening...';
    try { recognition.start(); } catch(x) {}
  }
});
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && isListening) {
    e.preventDefault();
    isListening = false;
    document.getElementById('voice-hud').classList.add('hidden');
    try { recognition.stop(); } catch(x) {}
  }
});

// Game over
function showGameOver(msg) {
  if (window.sounds) { window.sounds.stopBgMusic(); window.sounds.playSting(msg.winner === 'player' ? 'victory' : 'defeat'); }
  const el = document.getElementById('game-over-screen');
  el.classList.remove('hidden');
  document.getElementById('game-over-title').textContent =
    msg.winner === 'player' ? '🎉 Victory!'
    : msg.results?.canRetry ? '💪 You fell, but the Crawl continues...'
    : '💀 GAME OVER — A protagonist has fallen.';
  // Retry vs true game over
  const btn = document.querySelector('#game-over-content button');
  if (btn) btn.textContent = msg.winner === 'player' ? 'Continue' : msg.results?.canRetry ? 'Regroup & Retry' : 'Start a New Crawl';
  const loot = document.getElementById('loot-display');
  let html = '';
  if (msg.results) {
    if (msg.results.levelUps?.length) html += '<div>📈 ' + msg.results.levelUps.map(l => `${l.name} Lv${l.from}→${l.to}`).join(', ') + '</div>';
    if (msg.results.xpGains?.length) html += '<div style="font-size:12px;color:#888">XP: ' + msg.results.xpGains.map(x => `${x.name}+${x.xp}`).join(', ') + '</div>';
    if (msg.results.loot) html += `<div>📦 Loot: ${msg.results.loot.boxes.join(', ')} (${msg.results.loot.itemCount} items → inventory)</div>`;
    if (msg.results.deaths?.length) html += '<div style="color:#f55">💀 Lost a level: ' + msg.results.deaths.map(d => d.name).join(', ') + '</div>';
  }
  // Post-game breakdown
  if (msg.breakdown) {
    const b = msg.breakdown;
    html += `<div class="breakdown">
      <div class="breakdown-title">⚔️ Battle Report</div>
      <div class="breakdown-row">🕐 Turns: <b>${b.turns}</b></div>
      ${b.topKiller ? `<div class="breakdown-row">🏆 Top Killer: <b>${b.topKiller}</b> (${b.kills} total kills)</div>` : ''}
      ${b.critsLanded ? `<div class="breakdown-row">💥 Crits: <b>${b.critsLanded}</b></div>` : ''}
      ${b.itemsUsed ? `<div class="breakdown-row">🎒 Items Used: <b>${b.itemsUsed}</b></div>` : ''}
      ${b.rapportGains?.length ? `<div class="breakdown-row">💕 Strongest Bond: <b>${b.rapportGains[0].name}</b></div>` : ''}
      ${b.abilityUnlocks?.length ? `<div class="breakdown-row">⭐ New Abilities: <b>${b.abilityUnlocks.map(a=>a.ability).join(', ')}</b></div>` : ''}
      <div class="breakdown-row">🎯 Floor Progress: <b>${b.floorWins}/3 wins</b></div>
    </div>`;
  }
  loot.innerHTML = html;
  if (msg.save) saveData = msg.save;
}

function showQuest(quest) {
  const el = document.getElementById('quest-info');
  if (!el) return;
  if (!quest) { el.textContent = 'No quest assigned yet'; return; }
  el.innerHTML = `<div class="quest-name">${quest.name}</div><div class="quest-desc">${quest.description}</div>`;
  addDialogue('📜 Quest', `${quest.name}: ${quest.description}`);
}

// ====== WELCOME / HOW TO PLAY ======
function showWelcome() {
  let modal = document.getElementById('welcome-modal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'welcome-modal'; document.body.appendChild(modal); }
  modal.innerHTML = `<div class="welcome-inner">
    <h2>🎴 Dungeon Crawler Carl: The Card Game</h2>
    <div class="welcome-grid">
      <div class="welcome-tile">🃏 <b>Two Decks</b><br>Draw from your Character deck (reliable) or Loot deck (gamble) each turn.</div>
      <div class="welcome-tile">⚡ <b>Abilities</b><br>Click a board card to pick an ability — exact damage shown before you commit.</div>
      <div class="welcome-tile">📺 <b>Sponsors</b><br>Your alien corp gives passive buffs. Build 30 favor → fire an Intervention.</div>
      <div class="welcome-tile">🌀 <b>The AI Breaks</b><br>The Dungeon AI grows more unhinged each turn. By turn 12 it's helping you.</div>
      <div class="welcome-tile">📦 <b>Kill Loot</b><br>Every kill drops a loot box. End Turn to open them — better enemies = better loot.</div>
      <div class="welcome-tile">🎙️ <b>Talk to Cards</b><br>Hold SPACE and speak. Your cards know who they are and respond in character.</div>
    </div>
    <div class="welcome-tip">💡 <b>First move:</b> just hit "End Turn" — enemies don't appear until after your first turn ends.</div>
    <button id="welcome-close">Start Crawling →</button>
  </div>`;
  modal.classList.add('show');
  document.getElementById('welcome-close').onclick = () => { modal.classList.remove('show'); localStorage.setItem('dcc_welcome_seen', '1'); };
}

// ====== SPONSOR SELECTION ======
async function showSponsorPicker(force) {
  const sponsors = await fetch('/api/sponsors').then(r => r.json());
  let modal = document.getElementById('sponsor-modal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'sponsor-modal'; document.body.appendChild(modal); }
  modal.innerHTML = `<div class="sponsor-modal-inner">
    <h2>📺 Choose Your Sponsor</h2>
    <p class="sponsor-sub">An alien corporation will fund your crawl — for a price.</p>
    <div class="sponsor-grid">${sponsors.map(s => `
      <div class="sponsor-card" data-id="${s.id}">
        <div class="sc-emoji">${s.emoji}</div>
        <div class="sc-name">${s.name}</div>
        <div class="sc-tag">"${s.tagline}"</div>
        <div class="sc-passive">📈 ${s.passive.desc}</div>
        <div class="sc-iv">⚡ ${s.intervention.name}: ${s.intervention.desc}</div>
      </div>`).join('')}</div>
  </div>`;
  modal.classList.add('show');
  modal.querySelectorAll('.sponsor-card').forEach(el => {
    el.onclick = async () => {
      await fetch('/api/sponsor', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ sponsorId: el.dataset.id }) });
      modal.classList.remove('show');
      location.reload(); // reconnect with new sponsor
    };
  });
}

// Card detail with USE buttons for abilities (when clicking own board cards)
function showCardDetailWithAbilities(card, boardIdx) {
  let modal = document.getElementById('card-detail-modal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'card-detail-modal'; document.body.appendChild(modal); }
  const artSrc = `/cards/${cardArtId(card)}.png`;

  // Stat color coding: blue if buffed, maroon if debuffed vs base
  function statColor(val, base) {
    if (!base || val === base) return '#9cf';
    return val > base ? '#66ccff' : '#cc4466';
  }
  function statLabel(val, base) {
    if (!base || val === base) return val;
    return `${val} <small style="opacity:.6">(${base})</small>`;
  }

  const abils = (card.abilityInfo || []).map(a => {
    const isSpell = a.kind === 'spell';
    const canUse = !card.usedAction && (isSpell ? a.cost <= state.mana : true) && a.currentCd === 0 && !(card.silenced && isSpell);
    const kindLabel = isSpell ? `<span class="da-cost">🔮 ${a.cost} mana</span>` : `<span class="da-skill">⚡ FREE SKILL</span>`;
    return `<button class="da-use-btn ${canUse ? '' : 'disabled'} ${isSpell?'btn-spell':'btn-skill'}" data-abil="${a.id}" ${canUse ? '' : 'disabled'}>
      <span class="da-name">${a.name}</span> ${kindLabel}
      <span class="da-target">${targetLabel(a)}</span>
      <span class="da-prev">${a.preview || ''}</span>
      ${a.currentCd > 0 ? `<span class="da-cd">CD: ${a.currentCd}</span>` : ''}
      ${card.usedAction ? '<span class="da-cd">already acted</span>' : ''}
    </button>`;
  }).join('') || '<div class="da-none">No abilities</div>';

  const KW_TIPS = { taunt:'Taunt: Enemies must attack this first', stealth:'Stealth: Hidden until attack', lifesteal:'Lifesteal: Heals team', cleave:'Cleave: Hits adjacent', deathrattle:'Deathrattle: Effect on death', battlecry:'Battlecry: Effect on play', regenerate:'Regenerate: Heals each turn', first_strike:'First Strike: Hits first', thorns:'Thorns: Hurts attackers' };
  const kwHtml = (card.keywords || []).map(k => `<span class="detail-kw">${k}: ${KW_TIPS[k]?.split(': ')[1] || k}</span>`).join(' · ') || 'none';

  modal.innerHTML = `<div class="card-detail-content" onclick="event.stopPropagation()">
    <div class="cd-art"><img src="${artSrc}" onerror="this.src=''" /><span class="cd-emoji">${card.emoji || '⚔️'}</span></div>
    <div class="cd-info">
      <h2>${card.name || '?'} <small style="color:#d4a017">Lv${card.level || 1}</small></h2>
      <div class="cd-subtitle">HP: ${card.currentHP}/${card.maxHP} · Keywords: ${kwHtml}</div>
      <div class="detail-stats">
        <span style="color:${statColor(card.str, card.baseStr)}">💪 STR ${statLabel(card.str, card.baseStr)}</span>
        <span style="color:${statColor(card.int, card.baseInt)}">🧠 INT ${statLabel(card.int, card.baseInt)}</span>
        <span style="color:${statColor(card.con, card.baseCon)}">🛡️ CON ${statLabel(card.con, card.baseCon)}</span>
        <span>🎯 DEX ${card.dex || 0}</span>
        <span>💬 CHA ${card.cha || 0}</span>
      </div>
      ${(card.statusList && card.statusList.length) ? `
      <div class="cd-section-title">🌀 Active Effects</div>
      <div class="cd-status-list">
        ${card.statusList.map(s => `<div class="cd-status status-${s.type}"><span class="cd-status-icon">${s.icon}</span> <b>${s.name}</b> <span class="cd-status-turns">${s.turnsLeft ? s.turnsLeft + 't' : ''}</span><br><small>${s.desc}</small></div>`).join('')}
      </div>` : ''}
      <div class="cd-section-title">⚡ Primary Action — pick ONE: a free Skill OR a Spell (💎 ${state.mana} mana)</div>
      <div class="da-ability-list">${abils}</div>
      <div class="cd-section-title">🆓 FREE ACTIONS (no mana cost, 1/turn)</div>
      <div class="da-free-list">
        ${card.usedFreeAction ? '<div class="da-none">Free action already used this turn</div>' : `
        <button class="da-free-btn" data-free="stack">⚔️ ${card.equippedWeapon ? card.equippedWeapon.name + ' (free attack)' : 'Stack (weak punch)'}</button>
        <button class="da-free-btn" data-free="inspect">🔍 Inspect (mark enemy +50% dmg)</button>
        <button class="da-free-btn" data-free="recover">💚 Recover (heal self CON/20)</button>
        <button class="da-free-btn" data-free="taunt">🛡️ Taunt (force enemies to target)</button>
        <button class="da-free-btn" data-free="return">↩️ Return to Hand</button>
        ${(state.pendingLoot||[]).length ? '<button class="da-free-btn" data-free="open_loot">📦 Open Loot Box</button>' : ''}
        ${(state.battleInventory||[]).length ? (() => {
          // Group items by type and show with rarity colors
          const items = state.battleInventory;
          const rarityColor = {common:'#888',uncommon:'#4a4',rare:'#48f',epic:'#a5f',legendary:'#fa0',celestial:'#ff0'};
          const grouped = {};
          items.forEach((it, idx) => {
            const type = it.slot === 'weapon' ? '⚔️ Weapons' : /bomb|boom|grenade|dynamite|smoke|oil|satchel|spider|waffle|train/i.test(it.name) ? '💣 Explosives' : /potion|brew/i.test(it.name) ? '🧪 Potions' : /scroll|spell/i.test(it.name) ? '📜 Scrolls' : '🎒 Other';
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push({ ...it, idx });
          });
          return Object.entries(grouped).map(([type, items]) =>
            `<div class="inv-group-header">${type} (${items.length})</div>` +
            items.map(it => `<button class="da-free-btn inv-item-btn" data-free="use_item" data-itemidx="${it.idx}" style="border-left:3px solid ${rarityColor[it.rarity]||'#555'}">🎒 ${it.name} <small style="color:${rarityColor[it.rarity]||'#888'}">${it.rarity||''}</small></button>`).join('')
          ).join('');
        })() : ''}
        `}
      </div>
      <div class="cd-rapport">♥ Rapport: ${card.rapport || 50}/100</div>
    </div>
    <button class="cd-close" onclick="document.getElementById('card-detail-modal').classList.remove('show')">✕</button>
  </div>`;
  modal.classList.add('show');
  modal.onclick = () => modal.classList.remove('show');

  // Wire ability use buttons
  modal.querySelectorAll('.da-use-btn:not(.disabled)').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      modal.classList.remove('show');
      selected = { idx: boardIdx, zone: 'board', ability: btn.dataset.abil };
      const info = (card.abilityInfo || []).find(x => x.id === btn.dataset.abil);
      if (info && ['self', 'team', 'ally', 'overcharge'].includes(info.target)) {
        window._lastAttacker = card.id || card.instanceId;
        window._lastTargetIdx = 0;
        ws.send(JSON.stringify({ type: 'use-ability', cardIndex: boardIdx, abilityId: btn.dataset.abil, targetIndex: 0 }));
        selected = null;
      } else {
        showToast('Click an enemy to target');
        render();
      }
    };
  });

  // Wire free action buttons
  modal.querySelectorAll('.da-free-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const action = btn.dataset.free;
      const itemIdx = btn.dataset.itemidx != null ? parseInt(btn.dataset.itemidx) : null;
      modal.classList.remove('show');
      if (['stack', 'inspect'].includes(action)) {
        selected = { idx: boardIdx, zone: 'board', freeAction: action };
        showToast('Click an enemy target');
        render();
      } else {
        ws.send(JSON.stringify({ type: 'free-action', cardIndex: boardIdx, action, targetIndex: 0, itemIdx }));
      }
    };
  });
}

// ====== A4: CARD DETAIL PANEL (right-click) ======
function showCardDetail(card, zone) {
  let modal = document.getElementById('card-detail-modal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'card-detail-modal'; document.body.appendChild(modal); }
  const artSrc = `/cards/${cardArtId(card)}.png`;
  const abils = (card.abilityInfo || []).map(a => `
    <div class="detail-ability">
      <div class="da-head"><b>${a.name}</b> <span class="da-cost">${a.cost}💎${a.currentCd > 0 ? ` CD:${a.currentCd}` : ''}</span></div>
      <div class="da-preview">${a.preview || a.type || ''}</div>
    </div>`).join('') || '<div class="da-none">No detailed ability info available</div>';

  const statsHtml = card.str ? `<div class="detail-stats">
    <span>💪 STR ${card.str}</span><span>🧠 INT ${card.int||0}</span><span>🛡️ CON ${card.con||0}</span><span>🎯 DEX ${card.dex||0}</span><span>💬 CHA ${card.cha||0}</span>
  </div>` : '';

  modal.innerHTML = `<div class="card-detail-content" onclick="event.stopPropagation()">
    <div class="cd-art"><img src="${artSrc}" onerror="this.src=''" /><span class="cd-emoji">${card.emoji || '⚔️'}</span></div>
    <div class="cd-info">
      <h2>${card.name || '?'}</h2>
      <div class="cd-subtitle">${card.title || ''} · Lv${card.level || 1} · Cost ${card.cost || '?'}</div>
      ${statsHtml}
      <div class="cd-section-title">Abilities</div>
      ${abils}
      ${card.passive ? `<div class="cd-section-title">Passive</div><div class="detail-ability"><b>${card.passive}</b></div>` : ''}
      <div class="cd-rapport">♥ Rapport: ${card.rapport || 50}/100</div>
    </div>
    <button class="cd-close" onclick="document.getElementById('card-detail-modal').classList.remove('show')">✕</button>
  </div>`;
  modal.classList.add('show');
  modal.onclick = () => modal.classList.remove('show');
}

// ====== EFFECTS PANEL ======
function updateEffectsPanel() {
  const list = document.getElementById('effects-list');
  if (!list || !state) return;

  // SECTION 1: Combat Status (buffs/debuffs — needs immediate attention)
  const statusEffects = [];
  (state.player?.board || []).forEach(c => {
    if (c.doubleDmg) statusEffects.push(`<div class="status-chip status-good">⚡ ${c.name}: Double DMG</div>`);
    if (c.stunned) statusEffects.push(`<div class="status-chip status-bad">💫 ${c.name}: Stunned</div>`);
    if (c.taunting) statusEffects.push(`<div class="status-chip status-good">🎯 ${c.name}: Taunting</div>`);
    if (c.hidden) statusEffects.push(`<div class="status-chip status-good">👻 ${c.name}: Hidden</div>`);
    if (c.invincible) statusEffects.push(`<div class="status-chip status-good">🛡️ ${c.name}: Invincible ${c.invincible}t</div>`);
  });
  if ((state.pendingLoot||[]).length > 0) statusEffects.push(`<div class="status-chip status-loot">📦 ${state.pendingLoot.length} Loot Box${state.pendingLoot.length>1?'es':''} waiting</div>`);

  // SECTION 2: Inventory bag
  const rarityColor = {common:'#888',uncommon:'#4a4',rare:'#48f',epic:'#a5f',legendary:'#fa0',celestial:'#ff0'};
  const invItems = (state.battleInventory||[]).map((item,idx) => `
    <div class="inv-item" onclick="showItemDetail(${idx})">
      <span class="inv-name">${item.name}</span>
      <span class="inv-rarity" style="color:${rarityColor[item.rarity]||'#888'}">${item.rarity||''}</span>
      <div class="inv-effect">${itemEffectText(item)}</div>
    </div>`).join('');

  // SECTION 3: Sponsor (compact)
  const sponsorHTML = state.sponsor ? `<div class="sponsor-compact"><b>${state.sponsor.emoji} ${state.sponsor.name}</b> — ${state.sponsor.passive}</div>` : '';

  list.innerHTML = `
    ${statusEffects.length ? `<div class="effects-section"><div class="effects-section-title">⚔️ COMBAT STATUS</div>${statusEffects.join('')}</div>` : ''}
    ${sponsorHTML ? `<div class="effects-section sponsor-section-compact">${sponsorHTML}</div>` : ''}
    ${invItems ? `<div class="effects-section"><div class="effects-section-title">🎒 INVENTORY (click for details)</div>${invItems}</div>` : ''}
    ${!statusEffects.length && !invItems ? '<div class="no-effects">No active effects</div>' : ''}
  `;
  renderActionButtons();
}
function renderActionButtons() {
  let bar = document.getElementById('action-buttons-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'action-buttons-bar';
    document.getElementById('effects-list')?.parentElement?.appendChild(bar);
  }
  const hasCraft = (state?.battleInventory || []).length >= 2;
  const hp = state?.sponsor?.heroPower;
  const hpUsed = state?.heroPowerUsed;
  bar.innerHTML =
    (hp ? `<button class="action-bar-btn hero-power-btn${hpUsed?' used':''}" onclick="useHeroPower()" ${hpUsed?'disabled':''}>${hp.name} (${hp.cost}⬡)</button>` : '') +
    `${hasCraft ? '<button class="action-bar-btn craft-bar-btn" onclick="openCraftModal()">⚗️ Craft</button>' : ''}`;

  // Creative Action moves to mid-bar
  const midRight = document.getElementById('mid-right');
  if (midRight && state?.currentTurn === 'player') {
    if (!document.getElementById('creative-action-btn')) {
      const btn = document.createElement('button');
      btn.id = 'creative-action-btn';
      btn.className = 'creative-action-mid-btn';
      btn.innerHTML = '🎲 Creative Action';
      btn.onclick = openRPGInput;
      midRight.appendChild(btn);
    }
  }
}
async function showStatusCodex() {
  let codex = window._statusCodex;
  if (!codex) {
    try { codex = await (await fetch('/api/status-effects')).json(); window._statusCodex = codex; }
    catch(e) { return; }
  }
  const groups = { buff: [], debuff: [], disease: [] };
  Object.values(codex).forEach(s => (groups[s.type] || groups.debuff).push(s));
  const section = (title, arr, color) => arr.length ? `
    <div class="codex-section">
      <div class="codex-section-title" style="color:${color}">${title}</div>
      <div class="codex-grid">${arr.map(s => `
        <div class="codex-entry">
          <span class="codex-icon">${s.icon}</span>
          <div><div class="codex-name">${s.name}</div><div class="codex-desc">${s.desc}</div></div>
        </div>`).join('')}</div>
    </div>` : '';
  const modal = document.createElement('div');
  modal.id = 'codex-modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `<div class="codex-inner">
    <h2>📖 Status Effects Codex</h2>
    <p style="color:#888;font-size:12px;margin-bottom:12px">From the Dungeon Crawler Carl chronicles</p>
    ${section('✨ BUFFS', groups.buff, '#5d5')}
    ${section('💀 DEBUFFS', groups.debuff, '#f66')}
    ${section('🦠 DISEASES', groups.disease, '#a5f')}
    <button onclick="this.closest('#codex-modal').remove()">Close</button>
  </div>`;
  document.body.appendChild(modal);
}

function toggleMute() {
  const muted = window.sounds?.toggleMute();
  document.getElementById('btn-mute').textContent = muted ? '🔇' : '🔊';
}
function showSettings() {
  const s = window.sounds?.s || {};
  const modal = document.createElement('div');
  modal.id = 'settings-modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  const row = (label, channel, on, vol) => `
    <div class="set-row">
      <span class="set-label">${label}</span>
      <label class="set-toggle"><input type="checkbox" ${on?'checked':''} onchange="updateSetting('${channel}On', this.checked)"> On</label>
      <input type="range" min="0" max="1" step="0.05" value="${vol}" oninput="updateSetting('${channel}Vol', parseFloat(this.value))" class="set-slider">
    </div>`;
  modal.innerHTML = `<div class="settings-inner">
    <h2>⚙️ Settings</h2>
    ${row('🎵 Music', 'music', s.musicOn, s.musicVol)}
    ${row('💥 Sound FX', 'sfx', s.sfxOn, s.sfxVol)}
    ${row('🎙️ Character Voices', 'voice', s.voiceOn, s.voiceVol)}
    <div class="set-row">
      <span class="set-label">⚡ Fast Mode</span>
      <label class="set-toggle"><input type="checkbox" ${s.fastMode?'checked':''} onchange="updateSetting('fastMode', this.checked)"> Skip delays & reduce animations</label>
    </div>
    <div class="set-row">
      <span class="set-label">👨‍👩‍👧 Family Friendly</span>
      <label class="set-toggle"><input type="checkbox" ${localStorage.getItem('dcc_family_mode')==='1'?'checked':''} onchange="updateSetting('familyMode', this.checked)"> No cursing or adult language</label>
    </div>
    <button onclick="this.closest('#settings-modal').remove()">Done</button>
  </div>`;
  document.body.appendChild(modal);
}
function updateSetting(key, val) {
  if (!window.sounds) return;
  const map = {
    musicOn: v => window.sounds.setMusicOn(v), musicVol: v => window.sounds.setMusicVol(v),
    sfxOn: v => window.sounds.setSfxOn(v), sfxVol: v => window.sounds.setSfxVol(v),
    voiceOn: v => window.sounds.setVoiceOn(v), voiceVol: v => window.sounds.setVoiceVol(v),
    fastMode: v => window.sounds.setFastMode(v),
    familyMode: v => { localStorage.setItem('dcc_family_mode', v ? '1' : '0'); ws.send(JSON.stringify({ type: 'set-family-mode', on: !!v })); },
  };
  if (map[key]) map[key](val);
}
function useHeroPower() { ws.send(JSON.stringify({ type: 'hero-power' })); }
function donutAbility(ability) { ws.send(JSON.stringify({ type: 'donut-ability', ability })); }
function showFloorAdvance(msg) {
  const { from, to, name, subtitle, desc, rule, clearedName, final } = msg;
  window.sounds?.playSfx('level_up');
  const el = document.createElement('div');
  el.id = 'floor-advance-screen';
  el.innerHTML = `<div class="floor-advance-inner">
    <div class="floor-advance-from">🏆 FLOOR ${from} CLEARED!</div>
    <div class="floor-advance-cleared">${clearedName || ''}</div>
    <div class="floor-advance-stairs">🪜 You descend the stairs…</div>
    <div class="floor-advance-arrow">▼</div>
    <div class="floor-advance-to">Entering Floor ${to}</div>
    <div class="floor-advance-name">${name}</div>
    ${subtitle ? `<div class="floor-advance-cleared">${subtitle}</div>` : ''}
    ${desc ? `<div class="floor-advance-desc">${desc}</div>` : ''}
    ${rule ? `<div class="floor-advance-rule">📜 System Rule: ${rule}</div>` : ''}
    ${final ? `<div class="floor-advance-final">⚠️ THE FINAL FLOOR ⚠️</div>` : ''}
  </div>`;
  document.body.appendChild(el);
  let done = false;
  const close = () => { if (done) return; done = true; el.classList.add('fade-out'); setTimeout(() => el.remove(), 600); };
  el.onclick = close;
  setTimeout(close, 6000);
}

function showDungeonComplete(msg) {
  window.sounds?.playSting?.('victory');
  const el = document.createElement('div');
  el.id = 'floor-advance-screen';
  el.innerHTML = `<div class="floor-advance-inner">
    <div class="floor-advance-from">👑 DUNGEON CLEARED 👑</div>
    <div class="floor-advance-name">You conquered all ${msg.floor} floors!</div>
    <div class="floor-advance-desc">The whole galaxy saw it. You are the Crawler who reached the bottom.</div>
  </div>`;
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('fade-out'); setTimeout(() => el.remove(), 600); }, 7000);
}

function togglePanel(id) {
  const panel = document.getElementById(id);
  if (!panel) return;
  panel.classList.toggle('collapsed');
  const icon = panel.querySelector('.collapse-icon');
  if (icon) icon.style.transform = panel.classList.contains('collapsed') ? 'rotate(0deg)' : 'rotate(90deg)';
}

let firstTurnShown = false;
function showFirstTurnHint() {
  if (firstTurnShown || localStorage.getItem('dcc_ftue_done')) return;
  firstTurnShown = true;
  const hint = document.createElement('div');
  hint.id = 'first-turn-hint';
  hint.innerHTML = `<div class="ftue-inner">
    <div class="ftue-title">🎮 How to Play</div>
    <div class="ftue-steps">
      <div class="ftue-step">1️⃣ <b>Play cards</b> from your hand (costs 💎 mana)</div>
      <div class="ftue-step">2️⃣ <b>Click a board card</b> → click an enemy to attack</div>
      <div class="ftue-step">3️⃣ <b>Donut's 👁️ Missile</b> is free every turn</div>
      <div class="ftue-step">4️⃣ <b>🎲 Creative Action</b> (center button) — describe ANY wild plan</div>
      <div class="ftue-step">5️⃣ Hit <b>End Turn</b> when done</div>
    </div>
    <button onclick="this.closest('#first-turn-hint').remove(); localStorage.setItem('dcc_ftue_done','1')">Got it, let's crawl! 🗡️</button>
  </div>`;
  document.body.appendChild(hint);
}

let lastRapport = {};
function checkRapportChanges(newState) {
  const board = newState?.player?.board || [];
  board.forEach(c => {
    const key = c.id || c.instanceId;
    const prev = lastRapport[key] || 0;
    const curr = Math.round((c.rapport || 0));
    if (curr > prev && prev > 0) {
      // Pulse the sponsor badge / Donut portrait
      const portrait = document.getElementById('player-portrait');
      if (portrait) { portrait.classList.add('rapport-pulse'); setTimeout(() => portrait.classList.remove('rapport-pulse'), 1000); }
      addDialogue('💕', `${c.name}'s bond increased! (Rapport ${curr}/100)`);
    }
    lastRapport[key] = curr;
  });
}

// ====== AUDIENCE / SOCIAL FEED ======
const AUDIENCE_POSTS_SHOWN = [];

function updateAudienceFeed(data, post) {
  // Hide audience system until turn 3 (reduce initial overwhelm)
  if (state && state.turn < 3) return;
  let audienceEl = document.getElementById('audience-bar');
  if (!audienceEl) {
    audienceEl = document.createElement('div');
    audienceEl.id = 'audience-bar';
    document.querySelector('.hud-seg')?.appendChild(audienceEl);
  }
  audienceEl.textContent = `📺 ${data.formatted} watching`;
  if (post) addSocialPost(post);
}

function addSocialPost(text) {
  let feed = document.getElementById('social-feed');
  if (!feed) return;
  const div = document.createElement('div');
  div.className = 'social-post';
  div.textContent = text;
  feed.insertBefore(div, feed.firstChild);
  while (feed.children.length > 8) feed.removeChild(feed.lastChild);
  // Show notification badge if panel is collapsed
  const panel = document.getElementById('social-panel');
  if (panel?.classList.contains('collapsed')) {
    let badge = panel.querySelector('.feed-notif');
    if (!badge) { badge = document.createElement('span'); badge.className = 'feed-notif'; panel.querySelector('.panel-title')?.appendChild(badge); }
    const count = parseInt(badge.dataset.count || '0') + 1;
    badge.dataset.count = count;
    badge.textContent = count;
    badge.style.display = 'inline-block';
  }
}

// Clear badge when expanded
const origToggle = window.togglePanel;
window.togglePanel = function(id) {
  if (typeof origToggle === 'function') origToggle(id);
  if (id === 'social-panel') {
    const badge = document.querySelector('#social-panel .feed-notif');
    if (badge) { badge.style.display = 'none'; badge.dataset.count = '0'; }
  }
};

// Fix dialogue to show newest at TOP
function showFanBox(milestone, event) {
  let fanEl = document.getElementById('fan-box-toast');
  if (!fanEl) { fanEl = document.createElement('div'); fanEl.id = 'fan-box-toast'; document.body.appendChild(fanEl); }
  fanEl.innerHTML = `<div class="fan-milestone">🎉 ${milestone} viewers!</div>
    <div class="fan-event-name">${event.name}</div>
    <div class="fan-event-desc">${event.desc}</div>
    <button onclick="document.getElementById('fan-box-toast').classList.remove('show')">Got it!</button>`;
  fanEl.classList.add('show');
  // Don't auto-dismiss — user must click
}

// ====== LOOT BOX OPENING ANIMATION ======
function showBossIntro(boss) {
  const el = document.createElement('div');
  el.id = 'boss-intro-screen';
  el.innerHTML = `<div class="boss-intro-inner">
    <div class="boss-intro-splash">⚔️ BOSS BATTLE ⚔️</div>
    <div class="boss-intro-emoji">${boss.emoji || '💀'}</div>
    <div class="boss-intro-name">${boss.name}</div>
    <div class="boss-intro-threat">Threat Level: ${'🔥'.repeat(Math.min(10, boss.threat))}</div>
    <div class="boss-intro-visual">${boss.visual}</div>
    <div class="boss-intro-quote">"${boss.intro.replace(/^["*]|["*]$/g, '')}"</div>
    <div class="boss-intro-mechanic">⚠️ ${boss.mechanic}</div>
    ${boss.condition ? `<div class="boss-intro-condition">${boss.condition}</div>` : ''}
    <div class="boss-intro-reward">🎁 Defeat for: ${boss.reward}</div>
    <div class="boss-intro-skip">▶ click to begin</div>
  </div>`;
  document.body.appendChild(el);
  if (window.sounds) window.sounds.playSfx('boss_horn');
  let dismissed = false;
  const dismiss = () => { if (dismissed) return; dismissed = true; el.classList.add('fade-out'); setTimeout(() => el.remove(), 500); };
  el.onclick = dismiss;
  setTimeout(dismiss, 3500);
}

function showDiscoverLoot(boxName, choices) {
  const rc = {common:'#888',uncommon:'#4a4',rare:'#48f',epic:'#a5f',legendary:'#fa0',celestial:'#ff0'};
  const modal = document.createElement('div');
  modal.id = 'discover-modal';
  modal.innerHTML = `<div class="discover-inner">
    <div class="discover-title">📦 ${boxName}</div>
    <div class="discover-subtitle">Pick 1 of ${choices.length}</div>
    <div class="discover-choices">${choices.map((item,i) => `
      <div class="discover-choice" onclick="pickLoot(${i})">
        <div class="discover-item-name" style="color:${rc[item.rarity]||'#fff'}">${item.name}</div>
        <div class="discover-item-rarity" style="color:${rc[item.rarity]||'#888'}">${(item.rarity||'').toUpperCase()}</div>
        <div class="discover-item-effect">${itemEffectText(item)}</div>
      </div>`).join('')}
    </div>
  </div>`;
  document.body.appendChild(modal);
}
function pickLoot(idx) {
  window.sounds?.playSfx('loot_claim');
  ws.send(JSON.stringify({ type: 'discover-pick', choiceIndex: idx }));
  const m = document.getElementById('discover-modal'); if (m) m.remove();
}

function showLootBoxOpening(boxName, items) {
  let modal = document.getElementById('loot-open-modal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'loot-open-modal'; document.body.appendChild(modal); }
  const rc = {common:'#888',uncommon:'#4a4',rare:'#48f',epic:'#a5f',legendary:'#fa0',celestial:'#ff0'};
  modal.innerHTML = `<div class="loot-open-content">
    <div class="loot-box-emoji">📦</div>
    <div class="loot-box-name">${boxName}</div>
    <div class="loot-open-items" id="loot-items-container"></div>
    <button onclick="document.getElementById('loot-open-modal').classList.remove('show')" style="margin-top:12px">Claim!</button>
  </div>`;
  modal.classList.add('show');
  // Reveal items one by one
  const container = document.getElementById('loot-items-container');
  const itemArr = items.length ? items : ['Items stored in inventory'];
  itemArr.forEach((item, i) => {
    setTimeout(() => {
      const div = document.createElement('div');
      div.className = 'loot-item loot-item-reveal';
      div.textContent = item;
      // Try to color by rarity if item name contains rarity hint
      const rarityMatch = Object.keys(rc).find(r => item.toLowerCase().includes(r));
      if (rarityMatch) div.style.borderColor = rc[rarityMatch];
      container.appendChild(div);
    }, i * 400);
  });
  // No auto-dismiss — player clicks "Claim!" to close
}

// ====== SPECIAL FX ======
// ===== ITEM DETAIL POPUP =====
function showItemDetail(idx) {
  const item = state.battleInventory?.[idx];
  if (!item) return;
  const rc = {common:'#888',uncommon:'#4a4',rare:'#48f',epic:'#a5f',legendary:'#fa0',celestial:'#ff0'};
  const color = rc[item.rarity] || '#fff';
  const modal = document.createElement('div');
  modal.id = 'item-detail-modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `<div class="item-detail-inner">
    <div class="item-detail-icon">🎒</div>
    <h3 style="color:${color}">${item.name}</h3>
    <div class="item-detail-rarity" style="color:${color}">${(item.rarity||'item').toUpperCase()} · ${item.slot||'consumable'}</div>
    ${item.description ? `<p class="item-detail-desc">${item.description}</p>` : ''}
    <div class="item-detail-effect">${itemEffectText(item)}</div>
    ${item.effects ? `<div class="item-detail-fx">${item.effects.map(fx=>`<span class="craft-fx">✦ ${fx.type.replace(/_/g,' ')}</span>`).join('')}</div>` : ''}
    <button onclick="this.closest('#item-detail-modal').remove()">Close</button>
  </div>`;
  document.body.appendChild(modal);
}

// ===== RPG ACTION (Level 2 Crafting) =====
function openRPGInput() {
  const modal = document.createElement('div');
  modal.id = 'rpg-modal';
  modal.innerHTML = `<div class="rpg-modal-inner">
    <h3>🎲 Creative Action</h3>
    <p style="color:#999;font-size:12px">Describe what you want to do. Combine abilities, items, and cards creatively. The DM will evaluate feasibility and roll dice.</p>
    <textarea id="rpg-input" placeholder="I want to strap the bomb to Mongo and have him charge the boss while I cast Protective Shell on him..." rows="3"></textarea>
    <div class="rpg-actions">
      <button id="rpg-mic" onclick="rpgDictate()" title="Speak your plan">🎤 Speak</button>
      <button onclick="submitRPGAction()">⚔️ Attempt It!</button>
      <button onclick="closeRPGModal()">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('rpg-input').focus();
}
// Dictate a creative action into the textarea using speech recognition
function rpgDictate() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('Speech recognition not supported in this browser'); return; }
  const ta = document.getElementById('rpg-input');
  const mic = document.getElementById('rpg-mic');
  const rec = new SR();
  rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US';
  let base = ta.value ? ta.value + ' ' : '';
  mic.textContent = '🔴 Listening… (click to stop)';
  mic.onclick = () => { rec.stop(); };
  rec.onresult = (ev) => {
    const t = Array.from(ev.results).map(r => r[0].transcript).join('');
    ta.value = base + t;
  };
  rec.onend = () => { mic.textContent = '🎤 Speak'; mic.onclick = () => rpgDictate(); };
  rec.onerror = () => { mic.textContent = '🎤 Speak'; mic.onclick = () => rpgDictate(); showToast('Mic error — try again or type'); };
  try { rec.start(); } catch (x) { showToast('Could not start mic'); }
}
function submitRPGAction() {
  const text = document.getElementById('rpg-input')?.value?.trim();
  if (!text) return;
  ws.send(JSON.stringify({ type: 'rpg-action', text }));
}
function closeRPGModal() { const m = document.getElementById('rpg-modal'); if (m) m.remove(); }
function showRPGModal(phase, data) {
  let modal = document.getElementById('rpg-modal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'rpg-modal'; document.body.appendChild(modal); }
  if (phase === 'evaluating') {
    modal.innerHTML = `<div class="rpg-modal-inner">
      <div class="rpg-evaluating">
        <div class="rpg-dice-anim">🎲</div>
        <p>The DM considers your action...</p>
        <p class="rpg-player-text">"${data}"</p>
      </div>
    </div>`;
  } else if (phase === 'result') {
    if (!data.feasible) {
      modal.innerHTML = `<div class="rpg-modal-inner rpg-fail">
        <h3>❌ Not Feasible</h3>
        <p>${data.reason}</p>
        <button onclick="closeRPGModal()">OK</button>
      </div>`;
      return;
    }
    const successClass = data.success ? 'rpg-success' : 'rpg-fail';
    const icon = data.success ? '✅' : '💀';
    modal.innerHTML = `<div class="rpg-modal-inner ${successClass}">
      <div class="rpg-roll-display">
        <span class="rpg-d20">${data.roll.roll}</span>
        <span class="rpg-modifier">+ ${data.roll.modifier} (${data.stat?.toUpperCase()})</span>
        <span class="rpg-total">= ${data.roll.total}</span>
        <span class="rpg-vs">vs DC ${data.difficulty}</span>
      </div>
      <h3>${icon} ${data.success ? 'SUCCESS!' : 'FAILURE!'}</h3>
      <p class="rpg-narration">${data.narration || ''}</p>
      <div class="rpg-effects">${(data.effects||[]).map(e => `<span class="rpg-fx">✦ ${e}</span>`).join('')}</div>
      ${data.mana_cost ? `<div class="rpg-cost">Cost: ${data.mana_cost} mana${data.items_consumed?.length ? ' + ' + data.items_consumed.join(', ') : ''}</div>` : ''}
      <button onclick="closeRPGModal()">Continue</button>
    </div>`;
  }
}

// ===== CRAFTING UI =====
let craftSelection = [];
let craftSort = 'rarity', craftFilter = '';
function openCraftModal() {
  const items = state.battleInventory || [];
  if (items.length < 2) { showToast('Need at least 2 items to combine'); return; }
  craftSelection = [];
  craftFilter = '';
  const modal = document.createElement('div');
  modal.id = 'craft-modal';
  modal.onclick = (e) => { if (e.target === modal) closeCraftModal(); };
  modal.innerHTML = `<div class="craft-modal-inner">
    <div class="craft-head">
      <h3>⚗️ Crafting Table</h3>
      <div id="craft-mana-note"></div>
      <div class="craft-controls">
        <input id="craft-search" placeholder="🔍 filter items…" oninput="craftSetFilter(this.value)">
        <select id="craft-sort" onchange="craftSetSort(this.value)">
          <option value="rarity">Sort: Rarity</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>
    </div>
    <div class="craft-items" id="craft-items"></div>
    <div class="craft-actions">
      <div id="craft-pick">Select 2 items to combine</div>
      <div class="craft-action-btns">
        <button id="craft-confirm" disabled onclick="confirmCraft()">Combine! (1 mana)</button>
        <button onclick="closeCraftModal()">Cancel</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  renderCraftItems();
}
function craftSetFilter(v) { craftFilter = (v || '').toLowerCase(); renderCraftItems(); }
function craftSetSort(v) { craftSort = v; renderCraftItems(); }
function renderCraftItems() {
  const rc = {common:'#888',uncommon:'#4a4',rare:'#48f',epic:'#a5f',legendary:'#fa0',celestial:'#ff0'};
  const rOrder = {celestial:6,legendary:5,epic:4,rare:3,uncommon:2,common:1};
  const items = (state.battleInventory || []);
  // keep original indices for selection, then filter/sort the view
  let view = items.map((it, idx) => ({ it, idx }))
    .filter(x => !craftFilter || (x.it.name || '').toLowerCase().includes(craftFilter));
  view.sort((a, b) => craftSort === 'name'
    ? (a.it.name || '').localeCompare(b.it.name || '')
    : (rOrder[b.it.rarity] || 0) - (rOrder[a.it.rarity] || 0));
  const cont = document.getElementById('craft-items');
  cont.innerHTML = view.map(({ it, idx }) =>
    `<div class="craft-item ${craftSelection.includes(idx) ? 'selected' : ''}" data-idx="${idx}" onclick="toggleCraftItem(this,${idx})">
      <span class="craft-item-name">${it.name}</span>
      <small style="color:${rc[it.rarity] || '#888'}">${it.rarity || 'item'}</small>
      <span class="craft-item-fx">${itemEffectText(it)}</span>
    </div>`).join('') || '<div style="color:#888;padding:20px;text-align:center">No items match.</div>';
  updateCraftFooter();
}
function toggleCraftItem(el, idx) {
  if (craftSelection.includes(idx)) { craftSelection = craftSelection.filter(i => i !== idx); el.classList.remove('selected'); }
  else if (craftSelection.length < 2) { craftSelection.push(idx); el.classList.add('selected'); }
  else { showToast('Pick exactly 2 — deselect one first'); }
  updateCraftFooter();
}
function updateCraftFooter() {
  const items = state.battleInventory || [];
  const note = document.getElementById('craft-mana-note');
  const hasMana = (state.mana || 0) >= 1;
  if (note) note.innerHTML = hasMana
    ? `<span style="color:#6cf">💧 ${state.mana} mana — combining costs 1</span>`
    : `<span style="color:#f66">⚠️ No mana! Combining costs 1 mana — end your turn to refill.</span>`;
  const pick = document.getElementById('craft-pick');
  if (pick) pick.textContent = craftSelection.length === 0 ? 'Select 2 items to combine'
    : craftSelection.length === 1 ? `Selected: ${items[craftSelection[0]]?.name} — pick 1 more`
    : `Combine: ${items[craftSelection[0]]?.name} + ${items[craftSelection[1]]?.name}`;
  const btn = document.getElementById('craft-confirm');
  if (btn) btn.disabled = craftSelection.length !== 2 || !hasMana;
}
function confirmCraft() {
  if (craftSelection.length !== 2) return;
  if ((state.mana || 0) < 1) { showToast('⚗️ Crafting needs 1 mana — you have none! End your turn to refill.'); return; }
  const items = state.battleInventory || [];
  const nameA = items[craftSelection[0]]?.name || '?';
  const nameB = items[craftSelection[1]]?.name || '?';
  // Replace modal content with animation
  const inner = document.querySelector('.craft-modal-inner');
  inner.innerHTML = `
    <div class="craft-animating">
      <div class="craft-orb orb-left">${nameA}</div>
      <div class="craft-spark">⚗️</div>
      <div class="craft-orb orb-right">${nameB}</div>
    </div>
    <div class="craft-status">Combining...</div>`;
  ws.send(JSON.stringify({ type: 'free-action', cardIndex: 0, action: 'craft', itemIdxA: craftSelection[0], itemIdxB: craftSelection[1] }));
  // Safety: if no result in 30s, show a fallback close button so it never hangs
  window._craftSafety = setTimeout(() => {
    const st = document.querySelector('.craft-status');
    if (st) { st.innerHTML = 'The crafting fizzled... <button onclick="closeCraftModal()" style="margin-left:8px">Close</button>'; }
  }, 30000);
}
function closeCraftModal() { clearTimeout(window._craftSafety); const m = document.getElementById('craft-modal'); if (m) m.remove(); }
function showCraftResult(item, fromRecipe) {
  const rc = {common:'#888',uncommon:'#4a4',rare:'#48f',epic:'#a5f',legendary:'#fa0',celestial:'#ff0'};
  const color = rc[item.rarity] || '#fff';
  clearTimeout(window._craftSafety);
  const modal = document.getElementById('craft-modal');
  if (modal) {
    const inner = modal.querySelector('.craft-modal-inner') || modal.firstElementChild;
    inner.innerHTML = `
      <div class="craft-result-reveal">
        <div class="craft-result-glow"></div>
        <h2 style="color:${color};margin:0">${item.name}</h2>
        <div class="craft-rarity" style="color:${color}">${(item.rarity||'item').toUpperCase()}</div>
        <p class="craft-desc">${item.description || ''}</p>
        <div class="craft-effects">${(item.effects||[]).map(fx => `<span class="craft-fx">✦ ${(fx.type||'effect').replace(/_/g,' ')}</span>`).join('') || (item.effect||'')}</div>
        <div class="craft-result-actions">
          <button onclick="dismissCraft(false)">✓ Add to Inventory</button>
          ${!fromRecipe ? '<button onclick="dismissCraft(true)" class="craft-save-btn">⭐ Save Recipe & Add</button>' : '<div class="craft-recipe-note">📜 Known recipe!</div>'}
        </div>
      </div>`;
  } else {
    // Fallback if modal was closed
    addDialogue('⚗️', `Created: <strong style="color:${color}">${item.name}</strong> (${item.rarity}) — ${item.description || ''}`);
  }
}
function dismissCraft(saveRecipe) {
  if (saveRecipe) ws.send(JSON.stringify({ type: 'rate-craft', approved: true }));
  closeCraftModal();
  addDialogue('⚗️', 'Item added to inventory!');
}
function showCraftRating() {} // no longer needed — rating is in the modal
function rateCraft(approved) {
  ws.send(JSON.stringify({ type: 'rate-craft', approved }));
  const el = document.getElementById('craft-rating'); if (el) el.remove();
  if (approved) addDialogue('📜', 'Recipe saved! This combo will auto-resolve next time.');
}

// ===== GOD ZONE RENDER =====
function renderGodZone() {
  const el = document.getElementById('god-zone');
  if (!el) return;
  const god = state?.godZone;
  if (!god) { el.innerHTML = ''; el.classList.remove('active'); return; }
  el.classList.add('active');
  const imgSrc = `/cards/god_${(god.name||'').toLowerCase().replace(/\s/g,'_')}.png`;
  el.innerHTML = `
    <div class="god-panel">
      <div class="god-portrait"><img src="${imgSrc}" onerror="this.parentElement.innerHTML='⚡'"></div>
      <div class="god-details">
        <div class="god-name">${god.name}</div>
        <div class="god-title">${god.title || god.domain || ''}</div>
        <div class="god-boon">🙏 ${god.boonDescription || 'Divine presence'}</div>
        ${god.chaosRevealed ? `<div class="god-chaos">${god.laundryDayProtected ? '🧺 BLOCKED' : '💥 ' + (god.chaosEffect?.description || 'Chaos!')}</div>` : '<div class="god-chaos-hidden">⚠️ Chaos hidden...</div>'}
        <div class="god-turns">${god.turnsRemaining} turns remaining</div>
      </div>
    </div>`;
}

function showEvolution(ev) {
  let modal = document.getElementById('evolution-modal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'evolution-modal'; document.body.appendChild(modal); }
  const artSrc = `/cards/${ev.evolvedId}.png`;
  modal.innerHTML = `<div class="evo-content">
    <div class="evo-flash">⚡ EVOLUTION ⚡</div>
    <div class="evo-art"><img src="${artSrc}" onerror="this.style.display='none'"></div>
    <div class="evo-text">${ev.announcement}</div>
    <button onclick="document.getElementById('evolution-modal').classList.remove('show')">Incredible!</button>
  </div>`;
  modal.classList.add('show');
  setTimeout(() => modal.classList.remove('show'), 8000);
  screenFlash();
  addDialogue('⚡ EVOLUTION', ev.announcement);
}

function triggerDisco() {
  document.body.classList.add('disco-mode');
  addDialogue('📡', '🪩 DISCO ROUND activated by Betelgeusian Disco Federation fans!');
  setTimeout(() => document.body.classList.remove('disco-mode'), 8000);
}

function triggerGravity() {
  document.querySelectorAll('.card').forEach(c => c.classList.add('gravity-flip'));
  addDialogue('📡', '🌀 Gravity reversed by a physics professor from Andromeda!');
  setTimeout(() => document.querySelectorAll('.card').forEach(c => c.classList.remove('gravity-flip')), 4000);
}

function triggerFloorPulse() {
  // Banner
  let banner = document.getElementById('floor-pulse-banner');
  if (!banner) { banner = document.createElement('div'); banner.id = 'floor-pulse-banner'; document.body.appendChild(banner); }
  banner.textContent = '⚡ FLOOR PULSE — Survivors gain XP';
  banner.classList.add('show');
  setTimeout(() => banner.classList.remove('show'), 2500);
  // Float +XP on each board card
  document.querySelectorAll('#player-board .card').forEach(el => {
    floatText(el, '+5 XP', 'buff');
  });
  screenFlash();
}
async function showCollection() {
  const save = await fetch('/api/save').then(r => r.json());
  const allCards = await fetch('/api/cards').then(r => r.json());
  let modal = document.getElementById('collection-modal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'collection-modal'; document.body.appendChild(modal); }
  const owned = (save.collection || []).map(id => allCards.find(c => c.id === id)).filter(Boolean);
  const inv = save.inventory || [];

  modal.innerHTML = `<div class="coll-inner">
    <div class="coll-head"><h2>🎒 Collection</h2><button id="coll-close">✕</button></div>
    <div class="coll-cols">
      <div class="coll-cards">
        <h3>Your Crawlers (${owned.length})</h3>
        ${owned.map(c => {
          const lvl = save.cardLevels?.[c.id] || 1;
          const xp = save.cardXP?.[c.id] || 0;
          const eq = save.equipped?.[c.id] || {};
          const eqList = Object.values(eq).map(e => e.name).join(', ') || 'nothing equipped';
          return `<div class="coll-card" data-id="${c.id}">
            <span class="cc-emoji">${c.emoji||'❓'}</span>
            <div class="cc-info"><b>${c.name}</b> <span class="cc-lvl">Lv${lvl}</span>
            <div class="cc-xp">XP ${xp} · ⚔️ ${eqList}</div></div>
          </div>`;
        }).join('')}
      </div>
      <div class="coll-inv">
        <h3>Inventory (${inv.length})</h3>
        <p class="coll-hint">Click an item, then a crawler to equip</p>
        ${inv.map((it, i) => `<div class="inv-item ${it.rarity||'common'}" data-idx="${i}">
          ${it.slot==='weapon'?'⚔️':it.slot==='consumable'?'🧪':'💍'} ${it.name} <small>${it.rarity||''}</small>
        </div>`).join('') || '<p style="color:#666">Empty — win battles to find loot</p>'}
      </div>
    </div>
  </div>`;
  modal.classList.add('show');
  document.getElementById('coll-close').onclick = () => modal.classList.remove('show');

  let pickedItem = null;
  modal.querySelectorAll('.inv-item').forEach(el => {
    el.onclick = () => {
      modal.querySelectorAll('.inv-item').forEach(x => x.classList.remove('picked'));
      el.classList.add('picked');
      pickedItem = parseInt(el.dataset.idx);
      showToast('Now click a crawler to equip');
    };
  });
  modal.querySelectorAll('.coll-card').forEach(el => {
    el.onclick = async () => {
      if (pickedItem === null) return;
      await fetch('/api/equip', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ cardId: el.dataset.id, itemIndex: pickedItem }) });
      pickedItem = null;
      showCollection(); // refresh
    };
  });
}

// Init
document.getElementById('btn-end-turn').onclick = endTurn;
document.getElementById('btn-collection').onclick = showCollection;
document.getElementById('btn-sponsor-change').onclick = () => {
  if (state?.sponsor) {
    showToast(`${state.sponsor.emoji} ${state.sponsor.name}: ${state.sponsor.passive}. Intervention: ${state.sponsor.intervention?.name} (${state.sponsor.intervention?.cost} favor)`);
  }
};
document.getElementById('btn-restart').onclick = async () => {
  if (!confirm('Start a completely new game? All progress will be reset.')) return;
  await fetch('/api/restart', { method: 'POST' });
  location.reload();
};
const textInput = document.getElementById('text-input');
const btnSend = document.getElementById('btn-send');
function sendTextVoice() {
  const t = textInput.value.trim();
  if (!t) return;
  ws.send(JSON.stringify({ type: 'voice', transcript: t }));
  addDialogue('player', t);
  document.getElementById('live-log').lastChild?.classList.add('you');
  textInput.value = '';
}
btnSend.onclick = sendTextVoice;
textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); sendTextVoice(); }
  e.stopPropagation(); // don't trigger spacebar push-to-talk
});
initVoice();
connect();

// Drag-to-play: drop a hand card onto the player board to play it
const playerBoard = document.getElementById('player-board');
if (playerBoard) {
  playerBoard.ondragover = (e) => { e.preventDefault(); playerBoard.classList.add('drop-active'); };
  playerBoard.ondragleave = () => playerBoard.classList.remove('drop-active');
  playerBoard.ondrop = (e) => {
    e.preventDefault();
    playerBoard.classList.remove('drop-active');
    const idx = parseInt(e.dataTransfer.getData('handIdx'));
    if (!isNaN(idx)) playCard(idx);
  };
}

// ===== THE DESPERADO CLUB (shop / vending / casino) =====
function openDesperado() {
  if (!ws || ws.readyState !== 1) { showToast('Not connected'); return; }
  ws.send(JSON.stringify({ type: 'desperado-open' }));
}

function renderDesperado(msg) {
  const { gold, club, floor } = msg;
  const rc = {common:'#888',uncommon:'#4a4',rare:'#48f',epic:'#a5f',legendary:'#fa0',celestial:'#ff0'};
  document.getElementById('desperado-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'desperado-modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  const vending = club.vending.map(v => `
    <div class="desp-item">
      <span>${v.emoji} ${v.name}</span>
      <small>${v.desc}</small>
      <button class="desp-buy" data-kind="vending" data-id="${v.id}">${v.price}g</button>
    </div>`).join('');
  const shop = club.shop.map(s => `
    <div class="desp-item">
      <span style="color:${rc[s.rarity]||'#fff'}">${s.name} <small>${s.rarity}</small></span>
      <small>${s.lore || ''}</small>
      <button class="desp-buy" data-kind="shop" data-id="${s.id}">${s.price}g</button>
    </div>`).join('');
  modal.innerHTML = `<div class="desp-inner">
    <div class="desp-header">
      <h2>🎰 The Desperado Club</h2>
      <div class="desp-gold">💰 ${gold} gold ${club.discountPct ? `· <span style="color:#4cf">CHA discount ${club.discountPct}%</span>` : ''}</div>
    </div>
    <div class="desp-cols">
      <div class="desp-col">
        <h3>🥤 Vending Machine</h3>${vending}
      </div>
      <div class="desp-col">
        <h3>🗡️ Weapons Broker</h3>${shop}
      </div>
      <div class="desp-col desp-casino">
        <h3>🎡 Wheel of Fortune</h3>
        <p class="desp-wheel-desc">One spin. Jackpot to disaster. The wheel does not care about you.</p>
        <div id="wheel-display">🎰</div>
        <button id="desp-spin" data-cost="${club.wheel.cost}">SPIN — ${club.wheel.cost}g</button>
      </div>
    </div>
    <button class="desp-close" onclick="this.closest('#desperado-modal').remove()">Leave the Club</button>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('.desp-buy').forEach(b => b.onclick = () => {
    ws.send(JSON.stringify({ type: 'desperado-buy', kind: b.dataset.kind, itemId: b.dataset.id }));
  });
  modal.querySelector('#desp-spin').onclick = () => {
    window.sounds?.playSfx('button_click');
    ws.send(JSON.stringify({ type: 'desperado-spin' }));
  };
}

function handleWheelResult(msg) {
  const disp = document.getElementById('wheel-display');
  if (!msg.ok) { showToast(`❌ ${msg.err}`); return; }
  const o = msg.outcome;
  if (disp) {
    // quick spin animation then land
    const faces = ['✨','🟧','⬜','💰','🟨','🪙','😐','💀'];
    let n = 0;
    const iv = setInterval(() => { disp.textContent = faces[n++ % faces.length]; }, 80);
    setTimeout(() => {
      clearInterval(iv);
      disp.textContent = o.label;
      disp.style.color = o.type === 'curse' ? '#f44' : o.type === 'nothing' ? '#999' : '#ffd700';
    }, 1200);
  }
  setTimeout(() => {
    if (o.type === 'curse') { bigBanner('💀 THE WHEEL IS CRUEL', '#ff3344', o.lost ? `Lost: ${o.lost}` : 'You feel cursed…'); window.sounds?.playSfx('debuff'); }
    else if (o.type === 'nothing') showToast('😐 Nothing. The house always wins.');
    else { bigBanner(o.label, '#ffd700', o.box ? `${o.box.boxName}: ${o.box.items.length} items` : ''); window.sounds?.playSfx('loot_claim'); }
    // refresh gold display
    const g = document.querySelector('.desp-gold');
    if (g) g.innerHTML = `💰 ${msg.gold} gold`;
  }, 1300);
}
window.openDesperado = openDesperado;

// ===== FEEDBACK WIDGET =====
// Reusable compact snapshot of the live game state (also used by the match analyst)
function captureStateSnapshot() {
  if (!state) return { note: 'no active game' };
  const slim = (c) => ({ name: c.name, hp: c.currentHP, maxHP: c.maxHP, str: c.str, statuses: (c.statusList || []).map(s => s.name) });
  return {
    floor: state.floor, turn: state.turn, battleType: state.battleType,
    mana: state.mana + '/' + state.maxMana, playerHP: state.playerHP,
    environment: state.environment?.name,
    sponsor: state.sponsor?.name,
    playerBoard: (state.player?.board || []).map(slim),
    playerHand: (state.player?.hand || []).map(c => c.name),
    enemyBoard: (state.enemy?.board || []).map(slim),
    recentFeed: [...document.querySelectorAll('#live-log .log-line, #live-log > div')].slice(-8).map(el => el.textContent).filter(Boolean),
  };
}

function openFeedback() {
  document.getElementById('feedback-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'feedback-modal';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  modal.innerHTML = `<div class="feedback-inner">
    <h3>💬 Send Feedback</h3>
    <p class="feedback-sub">Report a bug, an idea, or something to change. We'll save exactly what was happening in the game right now.</p>
    <div class="feedback-cats">
      ${['🐞 Bug', '💡 Idea', '⚖️ Balance', '🎨 Visual', '💬 Other'].map((c, i) =>
        `<label class="feedback-cat"><input type="radio" name="fbcat" value="${c}" ${i === 0 ? 'checked' : ''}> ${c}</label>`).join('')}
    </div>
    <textarea id="feedback-text" rows="4" placeholder="What did you notice? What would you change?"></textarea>
    <div class="feedback-snapshot">📸 Context captured: Floor ${state?.floor ?? '?'}, Turn ${state?.turn ?? '?'}, ${(state?.enemy?.board || []).length} enemies, ${(state?.player?.board || []).length} of your cards in play.</div>
    <div class="feedback-actions">
      <button id="feedback-send">Send</button>
      <button onclick="this.closest('#feedback-modal').remove()">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('feedback-text').focus();
  document.getElementById('feedback-send').onclick = submitFeedback;
}

async function submitFeedback() {
  const text = document.getElementById('feedback-text').value.trim();
  if (!text) { showToast('Type some feedback first'); return; }
  const category = document.querySelector('input[name="fbcat"]:checked')?.value || 'general';
  const btn = document.getElementById('feedback-send');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  try {
    await fetch('/api/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback: text, category, state: captureStateSnapshot() }),
    });
    document.getElementById('feedback-modal')?.remove();
    showToast('✅ Feedback saved — thank you!');
  } catch (e) {
    showToast('Could not save feedback — try again');
    if (btn) { btn.disabled = false; btn.textContent = 'Send'; }
  }
}
window.openFeedback = openFeedback;

// ===== RECRUIT-AN-ALLY (between floors) =====
function showRecruitOffer(recruits) {
  if (!recruits || !recruits.length) return;
  document.getElementById('recruit-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'recruit-modal';
  modal.innerHTML = `<div class="recruit-inner">
    <h2>🤝 A New Ally Approaches</h2>
    <p style="color:#aaa;font-size:13px">Pick one crawler to join your party for the rest of the Crawl.</p>
    <div class="recruit-choices">${recruits.map(r => `
      <div class="recruit-card" onclick="pickRecruit('${r.id}')">
        <img src="/cards/${r.id}.png" onerror="this.src=''" class="recruit-art">
        <div class="recruit-name">${r.name}</div>
        <div class="recruit-stats">STR ${r.str} · INT ${r.int} · CON ${r.con}</div>
        <div class="recruit-abils">${(r.abilities || []).slice(0, 2).join(', ')}</div>
      </div>`).join('')}
    </div>
    <button class="recruit-skip" onclick="this.closest('#recruit-modal').remove()">Skip (continue without recruiting)</button>
  </div>`;
  document.body.appendChild(modal);
}
function pickRecruit(id) {
  ws.send(JSON.stringify({ type: 'recruit-pick', id }));
  document.getElementById('recruit-modal')?.remove();
}
window.pickRecruit = pickRecruit;
