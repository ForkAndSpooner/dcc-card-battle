require('dotenv').config({path:'/workspace/.env'});
const fs = require('fs');

const LAYOUT = `
DUNGEON CRAWLER CARL: Card Battle Game - Full UI Layout

TOP BAR (full width):
- Left: current dungeon location name, turn number, gold count, viewer count
- Center: Princess Donut circular portrait with HP ring + HP number + mana number + two buttons (Magic Missile free/turn, Laundry Day 3 mana)
- Right: Collection button, Sponsor button, New Game button

LEFT PANEL (narrow sidebar):
- YOUR SPONSOR: sponsor name and passive bonus
- ACTIVE EFFECTS & BUFFS: current buffs/debuffs AND your inventory items (click item for detail popup)
- ACTIVE QUEST: current quest objective
- TALK TO YOUR CARDS: chat log + text input (also push-to-talk with spacebar)
- STICKY BOTTOM BUTTONS: Hero Power (1 mana, changes per sponsor), Craft (combine 2 inventory items), Creative Action (describe anything to AI Dungeon Master)

CENTER BATTLEFIELD:
- Top half: enemy cards in up to 5 slots
- Enemy info bar showing total HP and "Defeat all enemies" 
- Middle: END TURN button
- Bottom half: your cards in up to 5 slots
- YOUR HAND: fanned cards at bottom, hover to see full card, click to play

RIGHT PANEL (narrow sidebar):
- GOD ZONE: shows active deity with portrait when summoned (from Celestial Grenade item)
- GALACTIC FEED: alien social media reacting to battle
- LIVE FEED: combat log showing all attacks and events

CARDS:
- Large card art fills top 70%
- Orange circle bottom-left = attack power
- Green circle bottom-right = current HP / max HP  
- Blue diamond top-left = mana cost to play
- Gold badge top-right = card level
- Hover reveals ability pips and rapport bar

EACH TURN YOU CAN:
- Play cards from hand (spend mana equal to card cost)
- Click your board cards to select them, then click an enemy to attack
- Use Donut's Magic Missile once per turn (free)
- Use your Hero Power (1 mana, sponsor-specific)
- Activate card abilities (click board card, choose ability from menu)
- Free Actions: use inventory items, open loot boxes, Craft 2 items together

POPUPS/MODALS:
- Loot box: animated reveal of items won
- Crafting: select 2 items, spinning cauldron animation, AI creates unique combination item, rate it to save as permanent recipe
- Creative Action: type any crazy combo action ("I want Carl to strap the bomb to Mongo and charge the boss"), AI DM evaluates feasibility, rolls dice, narrates outcome
- Item detail: click inventory item for full lore + effects popup
`;

const PROMPT_CASUAL = `You are a casual gamer who loves the Dungeon Crawler Carl book series by Matt Dinniman. You know characters like Carl, Donut, Mongo, and the general vibe of the dungeon. You've played a bit of Hearthstone - enough to know what mana crystals are, what attacking means, and what a minion is. But you're not a competitive player.

You're playing this DCC card game for the very first time. Here's the complete layout:
${LAYOUT}

Respond AS that player discovering this game. Tell me:
1. What excites you most?
2. What would confuse you on your very first turn?  
3. What is hard to find or awkwardly placed?
4. What's the first thing you'd want to click?
5. Are there any terms or UI elements you don't understand?
6. What info seems important but isn't prominent enough?
7. Any frustrations or "why is this here?" moments?

Be honest and specific. No politeness - you want to actually play and need it to make sense.`;

const PROMPT_DESIGNER = `You are a senior UX/game designer with 10+ years experience designing card games and mobile RPGs. You specialize in first-time player experience (FTUE) and information hierarchy.

You just ran a user test session where you showed the following game to 5 casual DCC fans who had played some Hearthstone or Pokemon TCG. Here is the game layout:
${LAYOUT}

Here is what the users said during the test:
USER_FEEDBACK_PLACEHOLDER

Now, as a professional game designer, provide:
1. TOP 5 UX/layout problems (most critical first)
2. TOP 5 specific design changes with exact placement/sizing recommendations
3. Information hierarchy issues (what's buried, what's competing for attention)
4. First-time player experience gaps
5. Quick wins (changes that take <30 min to implement with big impact)

Be specific with measurements, colors, placement. Prioritize ruthlessly.`;

async function callGemini(prompt, model='gemini-3.1-flash-lite') {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}], generationConfig:{maxOutputTokens:1200}})
  });
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
}

async function run() {
  console.log('\n========== PHASE 1: CASUAL USER TESTS ==========\n');
  
  const user1 = await callGemini(PROMPT_CASUAL);
  console.log('--- USER 1 (Gemini Flash) ---\n' + user1);
  fs.writeFileSync('/tmp/ux_user1.txt', user1);
  
  await new Promise(r => setTimeout(r, 2000));
  
  const user2 = await callGemini(PROMPT_CASUAL, 'gemini-3.1-pro-preview');
  console.log('\n--- USER 2 (Gemini Pro) ---\n' + user2);
  fs.writeFileSync('/tmp/ux_user2.txt', user2);
  
  console.log('\n========== PHASE 2: DESIGN EXPERT REVIEW ==========\n');
  
  const combinedFeedback = 'USER 1:\n' + user1 + '\n\nUSER 2:\n' + user2;
  const designPrompt = PROMPT_DESIGNER.replace('USER_FEEDBACK_PLACEHOLDER', combinedFeedback);
  
  await new Promise(r => setTimeout(r, 2000));
  const designReview = await callGemini(designPrompt, 'gemini-3.1-pro-preview');
  console.log('\n--- DESIGN EXPERT REVIEW ---\n' + designReview);
  fs.writeFileSync('/tmp/ux_design_review.txt', designReview);
  
  console.log('\n========== ALL FEEDBACK SAVED ==========');
  console.log('User 1: /tmp/ux_user1.txt');
  console.log('User 2: /tmp/ux_user2.txt');
  console.log('Design review: /tmp/ux_design_review.txt');
}

run().catch(console.error);
