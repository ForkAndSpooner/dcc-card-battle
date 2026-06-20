// ============================================================================
// FX ENGINE — a self-contained Canvas particle system for high-end attack
// spectacle. No external dependencies. Additive ("lighter") blending gives
// a neon/glow look. Typed effects per damage type with projectiles, beams,
// bursts, shockwave rings, and big set-pieces for spells / crits / bosses.
//
// Public API (global `FX`):
//   FX.cast(type, fromEl, toEl, {big})  – launch attacker→target effect
//   FX.impact(type, el, {big})          – burst at an element
//   FX.aoe(type, els)                   – hit many targets
//   FX.crit(el)                         – golden crit starburst
//   FX.heal(el)                         – healing sparkle
//   FX.bigSpell(type, el)               – screen-filling spell
//   FX.boss(kind, el)                   – boss mechanic flourish
//   FX.screenTint(color, ms)            – brief full-screen wash
// ============================================================================
(function () {
  const canvas = document.createElement('canvas');
  canvas.id = 'fx-canvas';
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9990';
  const ready = () => { if (!canvas.parentNode) document.body.appendChild(canvas); };
  if (document.body) ready(); else document.addEventListener('DOMContentLoaded', ready);

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ── palettes ──────────────────────────────────────────────
  const PAL = {
    fire:      ['#fff6c8', '#ffcf5c', '#ff7a1a', '#e0301e'],
    ice:       ['#ffffff', '#cdeeff', '#7fd0ff', '#4a86ff'],
    frost:     ['#ffffff', '#cdeeff', '#7fd0ff', '#4a86ff'],
    poison:    ['#f0ffc0', '#b6ff5c', '#5ec92e', '#2e7d32'],
    magic:     ['#ffffff', '#e6c6ff', '#b07bff', '#7a4dff'],
    arcane:    ['#ffffff', '#e6c6ff', '#b07bff', '#7a4dff'],
    holy:      ['#fffdf0', '#ffeeb0', '#ffd24d', '#ffffff'],
    divine:    ['#fffdf0', '#ffeeb0', '#ffd24d', '#ffffff'],
    physical:  ['#ffffff', '#ffe6c0', '#ffb46b', '#c97b3a'],
    dark:      ['#e6c8ff', '#b06bff', '#6a2fa0', '#2a0f44'],
    heal:      ['#e6ffe6', '#9bffc0', '#3ad97a', '#ffffff'],
    lightning: ['#ffffff', '#d6ecff', '#8ec5ff', '#c3a6ff'],
    gold:      ['#fffbe0', '#ffe9a8', '#ffd24d', '#ffae00'],
  };
  const pick = (type) => PAL[type] || PAL.physical;
  const rand = (a, b) => a + Math.random() * (b - a);
  const beamTypes = new Set(['lightning', 'holy', 'divine']);

  // ── particle pool ─────────────────────────────────────────
  const parts = [];
  const rings = [];
  const bolts = []; // jagged beams
  const MAX = 1400;
  let running = false;

  function add(p) { if (parts.length < MAX) parts.push(p); }

  function spawnBurst(x, y, type, count, power) {
    const colors = pick(type);
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = rand(0.4, 1) * power;
      add({
        x, y,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - rand(0, power * 0.3),
        life: 1, decay: rand(0.012, 0.03),
        size: rand(2, 5) + power * 0.25,
        color: colors[(Math.random() * colors.length) | 0],
        grav: type === 'fire' ? -0.04 : type === 'frost' || type === 'ice' ? 0.06 : 0.02,
        shrink: rand(0.94, 0.985),
      });
    }
    rings.push({ x, y, r: power * 1.5, max: power * 6 + 30, life: 1, color: colors[2], lw: 3 });
  }

  function spawnTrail(x, y, type) {
    const colors = pick(type);
    for (let i = 0; i < 3; i++) {
      add({
        x: x + rand(-4, 4), y: y + rand(-4, 4),
        vx: rand(-0.6, 0.6), vy: rand(-0.6, 0.6),
        life: 1, decay: rand(0.04, 0.08),
        size: rand(2, 5), color: colors[(Math.random() * colors.length) | 0],
        grav: 0, shrink: 0.92,
      });
    }
  }

  // jagged lightning/holy beam between two points
  function spawnBolt(x0, y0, x1, y1, type) {
    const colors = pick(type);
    const segs = 10;
    const pts = [{ x: x0, y: y0 }];
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const off = (1 - Math.abs(0.5 - t) * 2) * 26;
      pts.push({ x: x0 + (x1 - x0) * t + rand(-off, off), y: y0 + (y1 - y0) * t + rand(-off, off) });
    }
    pts.push({ x: x1, y: y1 });
    bolts.push({ pts, life: 1, decay: 0.08, color: colors[1], core: colors[0], width: type === 'holy' || type === 'divine' ? 6 : 3 });
    // sparks along it
    pts.forEach(p => spawnTrail(p.x, p.y, type));
  }

  function projectileTo(x0, y0, x1, y1, type, big, onArrive) {
    const colors = pick(type);
    const dur = 260 + (big ? 120 : 0);
    const t0 = performance.now();
    const head = { color: colors[0], size: big ? 14 : 8 };
    function step() {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const ease = t * t * (3 - 2 * t);
      const x = x0 + (x1 - x0) * ease, y = y0 + (y1 - y0) * ease;
      spawnTrail(x, y, type);
      add({ x, y, vx: 0, vy: 0, life: 1, decay: 0.05, size: head.size, color: head.color, grav: 0, shrink: 0.9 });
      ensureRunning();
      if (t < 1) requestAnimationFrame(step);
      else { spawnBurst(x1, y1, type, big ? 90 : 42, big ? 9 : 6); onArrive && onArrive(); }
    }
    requestAnimationFrame(step);
  }

  // ── render loop ───────────────────────────────────────────
  function frame() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // particles
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.grav; p.vx *= 0.99; p.vy *= 0.99;
      p.size *= p.shrink; p.life -= p.decay;
      if (p.life <= 0 || p.size < 0.4) { parts.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.2);
      g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.2, 0, 7); ctx.fill();
    }
    // shockwave rings
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.r += (r.max - r.r) * 0.18; r.life -= 0.04;
      if (r.life <= 0) { rings.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, r.life) * 0.8;
      ctx.strokeStyle = r.color; ctx.lineWidth = r.lw * r.life;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7); ctx.stroke();
    }
    // bolts
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.life -= b.decay;
      if (b.life <= 0) { bolts.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, b.life);
      for (const pass of [{ w: b.width * 3, c: b.color }, { w: b.width, c: b.core }]) {
        ctx.strokeStyle = pass.c; ctx.lineWidth = pass.w; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(b.pts[0].x, b.pts[0].y);
        for (const pt of b.pts) ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (parts.length || rings.length || bolts.length) requestAnimationFrame(frame);
    else running = false;
  }
  function ensureRunning() { if (!running) { running = true; requestAnimationFrame(frame); } }

  // ── element → screen center (CSS px) ──────────────────────
  function center(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // ── public API ────────────────────────────────────────────
  window.FX = {
    cast(type, fromEl, toEl, opts = {}) {
      const a = center(fromEl), b = center(toEl);
      if (!b) return;
      ensureRunning();
      const t = (type || 'physical').toLowerCase();
      if (beamTypes.has(t)) {
        if (a) spawnBolt(a.x, a.y, b.x, b.y, t);
        spawnBurst(b.x, b.y, t, opts.big ? 90 : 46, opts.big ? 9 : 6);
      } else if (a) {
        projectileTo(a.x, a.y, b.x, b.y, t, opts.big);
      } else {
        spawnBurst(b.x, b.y, t, 46, 6);
      }
    },
    impact(type, el, opts = {}) {
      const c = center(el); if (!c) return; ensureRunning();
      spawnBurst(c.x, c.y, (type || 'physical').toLowerCase(), opts.big ? 100 : 46, opts.big ? 9 : 6);
    },
    aoe(type, els) {
      (els || []).forEach((el, i) => setTimeout(() => this.impact(type, el), i * 60));
    },
    crit(el) {
      const c = center(el); if (!c) return; ensureRunning();
      // golden starburst — radial spokes + ring
      const colors = pick('gold');
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        const spd = rand(4, 9);
        add({ x: c.x, y: c.y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1, decay: 0.025, size: rand(3, 6), color: colors[(Math.random() * colors.length) | 0], grav: 0.04, shrink: 0.97 });
      }
      rings.push({ x: c.x, y: c.y, r: 8, max: 130, life: 1, color: '#ffd24d', lw: 5 });
      this.screenTint('rgba(255,210,80,0.12)', 160);
    },
    heal(el) {
      const c = center(el); if (!c) return; ensureRunning();
      const colors = pick('heal');
      for (let i = 0; i < 30; i++) {
        add({ x: c.x + rand(-20, 20), y: c.y + rand(0, 30), vx: rand(-0.5, 0.5), vy: rand(-2.5, -1), life: 1, decay: 0.02, size: rand(2, 5), color: colors[(Math.random() * colors.length) | 0], grav: -0.02, shrink: 0.98 });
      }
    },
    bigSpell(type, el) {
      const c = center(el) || { x: W / 2, y: H / 2 }; ensureRunning();
      const t = (type || 'magic').toLowerCase();
      spawnBurst(c.x, c.y, t, 160, 12);
      rings.push({ x: c.x, y: c.y, r: 10, max: Math.max(W, H), life: 1, color: pick(t)[2], lw: 8 });
      setTimeout(() => rings.push({ x: c.x, y: c.y, r: 10, max: Math.max(W, H) * 0.7, life: 1, color: pick(t)[1], lw: 5 }), 90);
      this.screenTint(`${PAL[t] ? hexToRgba(pick(t)[2], 0.18) : 'rgba(180,120,255,0.18)'}`, 240);
    },
    boss(kind, el) {
      const c = center(el) || { x: W / 2, y: H / 2 }; ensureRunning();
      const map = { weak: 'gold', resist: 'dark', choke: 'poison', surge: 'fire', fuse: 'poison', reflect: 'fire', revive: 'heal', swarm: 'poison' };
      const t = map[kind] || 'magic';
      spawnBurst(c.x, c.y, t, 120, 11);
      rings.push({ x: c.x, y: c.y, r: 10, max: 320, life: 1, color: pick(t)[2], lw: 7 });
    },
    screenTint(color, ms) {
      let t = document.getElementById('fx-tint');
      if (!t) { t = document.createElement('div'); t.id = 'fx-tint'; t.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9989;transition:opacity .15s'; document.body.appendChild(t); }
      t.style.background = color; t.style.opacity = '1';
      clearTimeout(t._to); t._to = setTimeout(() => { t.style.opacity = '0'; }, ms || 200);
    },
    // Signature set-pieces for marquee abilities (additive flair on top of the typed cast).
    // Returns true if a signature fired (so callers know it was special).
    signature(abilityName, fromEl, toEl) {
      const n = (abilityName || '').toLowerCase();
      const a = center(fromEl), b = center(toEl) || center(fromEl);
      if (!b) return false;
      ensureRunning();
      // Donut's Magic Missile — a swarm of homing arcane bolts
      if (n.includes('magic missile')) {
        for (let i = 0; i < 4; i++) setTimeout(() => { if (a) projectileTo(a.x + rand(-30, 30), a.y, b.x + rand(-20, 20), b.y, 'arcane', false); }, i * 80);
        return true;
      }
      // Laundry Day — cyan cleansing sud-burst + ring
      if (n.includes('laundry')) { spawnBurst(b.x, b.y, 'ice', 80, 8); this.screenTint('rgba(120,220,255,0.14)', 240); return true; }
      // Big bombs — screen-cracking fire blast
      if (n.includes('boom') || n.includes('bomb') || n.includes('grenade') || n.includes('dynamite')) { this.bigSpell('fire', toEl || fromEl); return true; }
      // Graupel / ice storm — shards rain down over the target
      if (n.includes('graupel') || n.includes('icicle') || n.includes('blizzard')) {
        for (let i = 0; i < 40; i++) { const x = b.x + rand(-90, 90); add({ x, y: b.y - rand(120, 240), vx: rand(-0.3, 0.3), vy: rand(4, 8), life: 1, decay: 0.02, size: rand(2, 5), color: pick('ice')[(Math.random() * 4) | 0], grav: 0.15, shrink: 0.99 }); }
        return true;
      }
      // Soul Reaper — dark wisps pulled back to the caster (lifesteal)
      if (n.includes('soul') || n.includes('reap') || n.includes('siphon')) {
        if (a) for (let i = 0; i < 24; i++) { const ang = Math.random() * Math.PI * 2, d = rand(20, 70); add({ x: b.x + Math.cos(ang) * d, y: b.y + Math.sin(ang) * d, vx: (a.x - b.x) * 0.02, vy: (a.y - b.y) * 0.02, life: 1, decay: 0.02, size: rand(2, 5), color: pick('dark')[(Math.random() * 4) | 0], grav: 0, shrink: 0.99 }); }
        return true;
      }
      // Crowd Blast / cleave — wide shockwave
      if (n.includes('crowd') || n.includes('cleave') || n.includes('smash')) { spawnBurst(b.x, b.y, 'physical', 80, 9); rings.push({ x: b.x, y: b.y, r: 10, max: 280, life: 1, color: pick('physical')[2], lw: 6 }); return true; }
      return false;
    },
  };

  function hexToRgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
})();
