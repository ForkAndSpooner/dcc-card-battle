// DM Agent — Level 2 Crafting: Voice-command RPG actions
// Player describes a creative action, AI evaluates feasibility, rolls dice, executes effects

const { getItemEffectHint } = require('./crafting');

function serializeGameState(battle) {
  const board = battle.board.player.map(c => `${c.name} (STR:${c.str} INT:${c.int} CON:${c.con} DEX:${c.dex} HP:${c.currentHP}/${c.maxHP}${c.abilities ? ' abilities:' + c.abilities.join(',') : ''})`).join(', ');
  const enemies = battle.board.enemy.map(e => `${e.name} (HP:${e.currentHP}/${e.maxHP} STR:${e.str||'?'})`).join(', ');
  const inv = (battle.battleInventory || []).map(i => `${i.name} [${i.rarity}] — ${i.effect || i.description || getItemEffectHint(i.name)}`).join('; ');
  return `YOUR BOARD: ${board || 'empty'}
ENEMIES: ${enemies || 'none'}
INVENTORY: ${inv || 'empty'}
MANA: ${battle.mana}/10
TURN: ${battle.turn}`;
}

async function evaluateRPGAction(playerText, battle, geminiKey) {
  const gameState = serializeGameState(battle);

  const prompt = `You are the Dungeon Master for "Dungeon Crawler Carl" — a deadly, darkly comedic dungeon crawl where creativity is rewarded. A player is attempting a creative RPG-style action that goes beyond normal game moves.

CURRENT GAME STATE:
${gameState}

PLAYER'S CREATIVE ACTION:
"${playerText}"

AVAILABLE EFFECTS you can assign to success/failure outcomes (pick appropriate ones):
summon_god, invincible {turns}, team_invincible {turns}, hidden {turns}, str_buff {amount, permanent}, int_buff {amount, permanent}, con_buff {amount, permanent}, team_str_buff {amount}, heal_target {amount}, heal_team {amount}, damage_all_enemies {amount}, damage_single {amount}, stun_all, stun_strongest, confuse_all, steal_enemy, extra_action, mana_restore {amount}, double_damage {turns}, damage_reduction {percent, turns}, revive, cleanse_all, intimidate {amount}, reflect_damage {turns}

SELF-DAMAGE effects for costs/failures: self_damage {amount}, team_damage {amount}, lose_mana {amount}, stun_self {turns}

EVALUATION RULES:
1. Determine if the action is FEASIBLE given the game state (are required cards/items present?)
2. Assign a DIFFICULTY from 1-20 (easy creative combos = 5-8, ambitious = 10-14, insane = 15-18, impossible = 19-20)
3. Pick the most RELEVANT STAT for the action (str/int/con/dex/cha)
4. Determine MANA COST (0-5, based on how many game actions this replaces)
5. Design SUCCESS effects (should be powerful and fun — reward creativity!)
6. Design FAILURE effects (should be thematic and punishing but not game-ending)
7. Write narration for both outcomes in DCC style (dark humor, dramatic, absurd)

Respond ONLY with JSON (no markdown fences):
{"feasible":true/false,"reason":"why not feasible if false","difficulty":N,"relevant_stat":"str|int|con|dex|cha","relevant_card":"card_name_on_board","mana_cost":N,"items_consumed":["item names used"],"on_success":{"effects":[{"type":"effect_name","params":{}}],"narration":"dramatic DCC-style success description"},"on_failure":{"effects":[{"type":"self_damage","params":{"amount":N}}],"narration":"dramatic DCC-style failure description"}}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 2000 } }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return { feasible: false, reason: 'DM could not evaluate this action' };
    return JSON.parse(json);
  } catch (e) {
    console.error('[DM Agent Error]', e.message);
    return { feasible: false, reason: 'DM communication failure' };
  }
}

function rollD20(statValue) {
  const roll = Math.floor(Math.random() * 20) + 1;
  const modifier = Math.floor((statValue || 50) / 20);
  return { roll, modifier, total: roll + modifier };
}

function executeEffects(battle, effects) {
  const results = [];
  const target = battle.board.player[0]; // default to first ally
  for (const fx of (effects || [])) {
    const p = fx.params || {};
    switch (fx.type) {
      case 'summon_god': { const r = battle.summonGod(); if (r.ok) results.push(`Summoned ${r.god.name}`); break; }
      case 'invincible': if (target) { target.invincible = p.turns || 2; results.push(`${target.name} invincible ${p.turns||2} turns`); } break;
      case 'team_invincible': battle.board.player.forEach(c => c.invincible = p.turns || 1); results.push(`ALL allies invincible ${p.turns||1} turns`); break;
      case 'hidden': if (target) { target.hidden = p.turns || 2; results.push(`${target.name} hidden`); } break;
      case 'str_buff': if (target) { target.str += (p.amount||20); results.push(`${target.name} +${p.amount||20} STR`); } break;
      case 'int_buff': if (target) { target.int += (p.amount||20); results.push(`${target.name} +${p.amount||20} INT`); } break;
      case 'con_buff': if (target) { target.con += (p.amount||20); results.push(`${target.name} +${p.amount||20} CON`); } break;
      case 'team_str_buff': battle.board.player.forEach(c => c.str += (p.amount||15)); results.push(`ALL +${p.amount||15} STR`); break;
      case 'heal_target': if (target) { target.currentHP = Math.min(target.maxHP, target.currentHP + (p.amount||30)); results.push(`Healed ${p.amount||30}`); } break;
      case 'heal_team': battle.board.player.forEach(c => c.currentHP = Math.min(c.maxHP, c.currentHP + (p.amount||20))); results.push(`Team healed ${p.amount||20}`); break;
      case 'damage_all_enemies': battle.board.enemy.forEach(e => e.currentHP -= (p.amount||25)); battle.board.enemy = battle.board.enemy.filter(e => e.currentHP > 0); results.push(`${p.amount||25} to all enemies`); break;
      case 'damage_single': { const e = battle.board.enemy[0]; if(e){e.currentHP-=(p.amount||40);if(e.currentHP<=0)battle.board.enemy=battle.board.enemy.filter(x=>x!==e);results.push(`${p.amount||40} to ${e.name}`);} break; }
      case 'stun_all': battle.board.enemy.forEach(e => e.stunned = true); results.push('ALL enemies stunned'); break;
      case 'stun_strongest': { const e=battle.board.enemy.reduce((a,b)=>(b.str||0)>(a.str||0)?b:a,battle.board.enemy[0]); if(e){e.stunned=true;results.push(`${e.name} stunned`);} break; }
      case 'confuse_all': battle.board.enemy.forEach(e => e.confused = true); results.push('ALL enemies confused'); break;
      case 'steal_enemy': { const e=battle.board.enemy.find(x=>!x.isBoss); if(e){battle.board.enemy=battle.board.enemy.filter(x=>x!==e);battle.board.player.push(e);results.push(`${e.name} joins you!`);} break; }
      case 'extra_action': if(target){target.usedFreeAction=false;results.push('Extra action!');} break;
      case 'mana_restore': battle.mana = Math.min(10, battle.mana + (p.amount||3)); results.push(`+${p.amount||3} mana`); break;
      case 'double_damage': if(target){target.doubleDmg=true;results.push(`${target.name} 2x damage`);} break;
      case 'damage_reduction': if(target){target.damageReduction=(p.percent||50);results.push(`${target.name} -${p.percent||50}% damage taken`);} break;
      case 'revive': if(battle.graveyard?.length){const c=battle.graveyard.pop();c.currentHP=Math.floor(c.maxHP/2);battle.board.player.push(c);results.push(`${c.name} revived!`);} break;
      case 'cleanse_all': battle.board.player.forEach(c=>{c.stunned=false;c.smoked=false;}); results.push('Team cleansed'); break;
      case 'intimidate': battle.board.enemy.forEach(e=>e.str=Math.max(0,(e.str||0)-(p.amount||30))); results.push(`Enemies -${p.amount||30} STR`); break;
      case 'reflect_damage': if(target){target.reflectDamage=p.turns||2;results.push(`${target.name} reflects damage`);} break;
      // Failure effects
      case 'self_damage': if(target){target.currentHP-=(p.amount||20);results.push(`${target.name} takes ${p.amount||20} self-damage`);} break;
      case 'team_damage': battle.board.player.forEach(c=>c.currentHP-=(p.amount||15)); results.push(`Team takes ${p.amount||15} damage`); break;
      case 'lose_mana': battle.mana=Math.max(0,battle.mana-(p.amount||2)); results.push(`Lost ${p.amount||2} mana`); break;
      case 'stun_self': if(target){target.stunned=true;results.push(`${target.name} stunned`);} break;
    }
  }
  return results;
}

module.exports = { evaluateRPGAction, rollD20, executeEffects, serializeGameState };
