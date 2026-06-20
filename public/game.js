// Game client
const PORTRAITS = {
  carl: '🤺',
  donut: '🐱',
  mongo: '🦕',
  mordecai: '📖',
  odette: '🩰'
};

let ws;
let state = null;
let selectedCard = null; // { type: 'hand'|'board', index }
let audioQueue = [];
let isPlayingAudio = false;

function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);
  ws.binaryType = 'arraybuffer';

  ws.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      // Audio data
      queueAudio(event.data);
      return;
    }
    const msg = JSON.parse(event.data);
    handleServerMessage(msg);
  };

  ws.onclose = () => setTimeout(connect, 2000);
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'init':
    case 'state':
      state = msg.state || msg;
      if (msg.state) state = msg.state;
      render();
      if (state.gameOver) showGameOver();
      break;
    case 'card-speak':
      addDialogue(msg.cardId, msg.text);
      highlightSpeaker(msg.cardId, msg.dying);
      break;
    case 'error':
      console.warn('Server error:', msg.message);
      break;
  }
}

function render() {
  if (!state) return;

  // Player info
  document.getElementById('player-health').textContent = `❤️ ${state.player.health}`;
  document.getElementById('player-mana').textContent = `💎 ${state.player.mana}/${state.player.maxMana}`;
  document.getElementById('player-deck').textContent = `📚 ${state.player.deckSize}`;

  // Enemy info
  document.getElementById('enemy-health').textContent = `❤️ ${state.enemy.health}`;
  document.getElementById('enemy-mana').textContent = `💎 ${state.enemy.mana}/${state.enemy.maxMana}`;
  document.getElementById('enemy-deck').textContent = `📚 ${state.enemy.deckSize}`;

  // Turn info
  document.getElementById('turn-info').textContent = `Turn ${state.turnNumber}`;
  document.getElementById('end-turn-btn').disabled = state.currentTurn !== 'player';

  // Player hand
  const handEl = document.getElementById('player-hand');
  handEl.innerHTML = '';
  state.player.hand.forEach((card, i) => {
    const el = createCardElement(card, 'hand', i);
    if (card.cost > state.player.mana) el.style.opacity = '0.5';
    handEl.appendChild(el);
  });

  // Player board
  const pBoard = document.getElementById('player-board');
  pBoard.innerHTML = '';
  state.player.board.forEach((card, i) => {
    const el = createCardElement(card, 'board', i);
    if (card.canAttack && state.currentTurn === 'player') el.classList.add('can-attack');
    pBoard.appendChild(el);
  });

  // Enemy hand (face-down)
  const eHand = document.getElementById('enemy-hand');
  eHand.innerHTML = '';
  state.enemy.hand.forEach(() => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = '<div class="card-portrait" style="font-size:20px">🂠</div>';
    eHand.appendChild(el);
  });

  // Enemy board
  const eBoard = document.getElementById('enemy-board');
  eBoard.innerHTML = '';

  // Add face target if we have a board attacker selected
  const faceTarget = document.createElement('div');
  faceTarget.className = 'enemy-face-target';
  if (selectedCard?.type === 'board') faceTarget.classList.add('visible');
  faceTarget.textContent = '👤';
  faceTarget.onclick = () => attackTarget(-1);
  eBoard.appendChild(faceTarget);

  state.enemy.board.forEach((card, i) => {
    const el = createCardElement(card, 'enemy-board', i);
    if (selectedCard?.type === 'board') {
      el.classList.add('targetable');
      el.onclick = () => attackTarget(i);
    }
    eBoard.appendChild(el);
  });
}

function createCardElement(card, location, index) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.cardId = card.id;

  const baseId = card.id?.split('-')[0] || '';
  const portrait = PORTRAITS[baseId] || '❓';

  el.innerHTML = `
    <span class="card-cost">${card.cost ?? '?'}</span>
    <div class="card-portrait">${portrait}</div>
    <div class="card-name">${card.name || '???'}</div>
    <div class="card-stats">
      <span class="card-attack">⚔️${card.attack ?? '?'}</span>
      <span class="card-health">❤️${card.health ?? '?'}</span>
    </div>
  `;

  if (location === 'hand') {
    el.onclick = () => playCard(index);
  } else if (location === 'board') {
    el.onclick = () => selectAttacker(index);
    el.oncontextmenu = (e) => { e.preventDefault(); openChat(card); };
  } else if (location === 'enemy-board') {
    el.oncontextmenu = (e) => { e.preventDefault(); openChat(card); };
  }

  if (selectedCard?.type === 'board' && selectedCard.index === index && location === 'board') {
    el.classList.add('selected');
  }

  return el;
}

function playCard(index) {
  if (state.currentTurn !== 'player') return;
  selectedCard = null;
  ws.send(JSON.stringify({ type: 'play-card', cardIndex: index }));
}

function selectAttacker(index) {
  if (state.currentTurn !== 'player') return;
  const card = state.player.board[index];
  if (!card.canAttack) return;

  if (selectedCard?.type === 'board' && selectedCard.index === index) {
    selectedCard = null; // Deselect
  } else {
    selectedCard = { type: 'board', index };
  }
  render();
}

function attackTarget(targetIndex) {
  if (!selectedCard || selectedCard.type !== 'board') return;
  ws.send(JSON.stringify({
    type: 'attack',
    attackerIndex: selectedCard.index,
    targetIndex
  }));
  selectedCard = null;
}

function endTurn() {
  if (state.currentTurn !== 'player') return;
  selectedCard = null;
  ws.send(JSON.stringify({ type: 'end-turn' }));
}

// Dialogue
function addDialogue(cardId, text) {
  const log = document.getElementById('dialogue-log');
  const baseId = cardId.split('-')[0];
  const names = { carl: 'Carl', donut: 'Donut', mongo: 'Mongo', mordecai: 'Mordecai', odette: 'Odette', player: 'You' };
  const name = names[baseId] || cardId;

  const line = document.createElement('div');
  line.className = 'line';
  const color = baseId === 'player' ? '#4ecdc4' : '#e6a817';
  line.innerHTML = `<span class="speaker" style="color:${color}">${name}:</span> ${text}`;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;

  while (log.children.length > 20) log.removeChild(log.firstChild);
}

function highlightSpeaker(cardId, dying) {
  document.querySelectorAll('.card.speaking').forEach(el => el.classList.remove('speaking'));
  document.querySelectorAll('.speech-bubble').forEach(el => el.remove());
  const el = document.querySelector(`[data-card-id="${cardId}"]`);
  if (el) {
    el.classList.add('speaking');
    if (dying) el.classList.add('dying');
    const bubble = document.createElement('div');
    bubble.className = 'speech-bubble';
    bubble.textContent = dying ? '💀' : '💬';
    el.appendChild(bubble);
    setTimeout(() => { el.classList.remove('speaking', 'dying'); bubble.remove(); }, 4000);
  }
}

// Audio playback
function queueAudio(buffer) {
  audioQueue.push(buffer);
  if (!isPlayingAudio) playNext();
}

function playNext() {
  if (audioQueue.length === 0) { isPlayingAudio = false; return; }
  isPlayingAudio = true;

  const buffer = audioQueue.shift();
  const blob = new Blob([buffer], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => { URL.revokeObjectURL(url); playNext(); };
  audio.onerror = () => { URL.revokeObjectURL(url); playNext(); };
  audio.play().catch(() => playNext());
}

function showGameOver() {
  const el = document.getElementById('game-over');
  el.classList.remove('hidden');
  document.getElementById('game-over-text').textContent =
    state.winner === 'player' ? '🎉 Victory!' : '💀 Defeat!';
}

// Chat with cards - voice input
let chatTarget = null;
let recognition = null;

function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { console.warn('Speech recognition not supported'); return; }
  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
    document.getElementById('voice-transcript').textContent = transcript;
    if (event.results[0].isFinal) {
      stopListening();
      if (chatTarget && transcript.trim()) {
        ws.send(JSON.stringify({ type: 'chat-card', cardId: chatTarget.id, message: transcript.trim() }));
        addDialogue('player', transcript.trim());
      }
      chatTarget = null;
    }
  };

  recognition.onerror = (e) => { console.error('Speech error:', e.error); stopListening(); };
  recognition.onend = () => stopListening();
}

function openChat(card) {
  if (!recognition) initSpeechRecognition();
  if (!recognition) { alert('Voice input not supported in this browser'); return; }
  chatTarget = card;
  startListening(card.name);
}

function startListening(cardName) {
  const indicator = document.getElementById('voice-indicator');
  document.getElementById('voice-target-name').textContent = cardName;
  document.getElementById('voice-transcript').textContent = 'Listening...';
  indicator.classList.remove('hidden');
  try { recognition.start(); } catch(e) {}
}

function stopListening() {
  const indicator = document.getElementById('voice-indicator');
  indicator.classList.add('hidden');
  try { recognition.stop(); } catch(e) {}
}

// Init
document.getElementById('end-turn-btn').onclick = endTurn;
document.getElementById('voice-cancel').onclick = () => { stopListening(); chatTarget = null; };
initSpeechRecognition();
connect();
