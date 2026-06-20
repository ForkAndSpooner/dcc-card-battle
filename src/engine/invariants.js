// Invariant checker - asserts game state validity after every action
// Returns array of violation strings (empty = valid)
function checkInvariants(battle) {
  const v = [];
  const s = battle;

  // Player HP
  if (s.playerHP > 30 + (s.floor || 1) * 5 + 50) v.push(`playerHP too high: ${s.playerHP}`);
  if (s.playerHP < 0 && !s.winner) v.push(`playerHP negative (${s.playerHP}) but no winner declared`);
  // mana
  if (s.mana < 0) v.push(`negative mana: ${s.mana}`);
  if (s.mana > 10) v.push(`mana over cap: ${s.mana}`);
  if (s.maxMana > 10) v.push(`maxMana over cap: ${s.maxMana}`);

  // Board limits
  if (s.board.player.length > 7) v.push(`player board over limit: ${s.board.player.length}`);
  if (s.board.enemy.length > 7) v.push(`enemy board over limit: ${s.board.enemy.length}`);

  // Card validity
  const checkCard = (c, side) => {
    if (c.currentHP > c.maxHP + 1) v.push(`${side} ${c.name} HP ${c.currentHP} > max ${c.maxHP}`);
    if (c.str < 0) v.push(`${side} ${c.name} negative STR: ${c.str}`);
    if (c.currentHP <= 0 && s.board[side === 'player' ? 'player' : 'enemy']?.includes(c)) {
      v.push(`${side} ${c.name} on board with 0 HP`);
    }
    if (Number.isNaN(c.currentHP)) v.push(`${side} ${c.name} NaN HP`);
    if (Number.isNaN(c.str)) v.push(`${side} ${c.name} NaN STR`);
  };
  s.board.player.forEach(c => checkCard(c, 'player'));
  s.board.enemy.forEach(c => checkCard(c, 'enemy'));

  // No duplicate instanceIds across board+hand+deck
  const allPlayer = [...s.board.player, ...s.hand.player, ...s.deck.player];
  const ids = allPlayer.map(c => c.instanceId);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) v.push(`duplicate instanceIds: ${[...new Set(dupes)].join(',')}`);

  // Hand limit
  if (s.hand.player.length > 9) v.push(`hand over limit: ${s.hand.player.length}`);

  // Winner consistency
  if (s.winner === 'player' && s.board.enemy.length > 0 && s.hand.enemy.length > 0 && s.deck.enemy.length > 0) {
    v.push(`declared player win but enemies remain`);
  }

  return v;
}

module.exports = { checkInvariants };
