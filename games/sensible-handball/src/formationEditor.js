import { COLORS, CONFIG } from './config.js';
import {
  ROLES,
  ROLE_LABELS,
  defaultFormation,
  normalizeFormation,
  saveFormation,
} from './formations.js';

const TOKEN_R = 16;

function clamp01(v) {
  return Math.max(0.04, Math.min(0.96, v));
}

/** Editor canvas is portrait: own goal at bottom, attack at top. */
function slotToCanvas(slot, w, h) {
  return {
    x: slot.nx * w,
    y: (1 - slot.ny) * h,
  };
}

function canvasToSlot(x, y, w, h) {
  return {
    nx: clamp01(x / w),
    ny: clamp01(1 - y / h),
  };
}

function drawMiniCourt(ctx, w, h) {
  ctx.fillStyle = COLORS.court;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = COLORS.courtDark;
  ctx.fillRect(0, 0, w, h * 0.5);

  const midY = h / 2;
  const midX = w / 2;
  const scale = h / CONFIG.COURT_W; // long axis vertical
  const r6 = CONFIG.LINE_6_M * CONFIG.METER * scale;
  const r9 = CONFIG.LINE_9_M * CONFIG.METER * scale;
  const goalHalf = (CONFIG.GOAL_WIDTH_M * CONFIG.METER * scale) / 2;

  ctx.strokeStyle = COLORS.courtLine;
  ctx.lineWidth = 2;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);

  // Halfway
  ctx.beginPath();
  ctx.moveTo(1.5, midY);
  ctx.lineTo(w - 1.5, midY);
  ctx.stroke();

  // Goal areas (bottom = own, top = opponent) as simple D approximations
  function drawD(sign) {
    const postL = midX - goalHalf;
    const postR = midX + goalHalf;
    ctx.beginPath();
    if (sign > 0) {
      // Top goal (y=0), area goes down
      ctx.arc(postL, 0, r6, Math.PI, Math.PI / 2, true);
      ctx.lineTo(postR, r6);
      ctx.arc(postR, 0, r6, Math.PI / 2, 0, true);
    } else {
      // Bottom goal (y=h), area goes up
      ctx.arc(postL, h, r6, Math.PI, -Math.PI / 2, false);
      ctx.lineTo(postR, h - r6);
      ctx.arc(postR, h, r6, -Math.PI / 2, 0, false);
    }
    ctx.strokeStyle = COLORS.courtLine;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    if (sign > 0) {
      ctx.arc(postL, 0, r9, Math.PI, Math.PI / 2, true);
      ctx.lineTo(postR, r9);
      ctx.arc(postR, 0, r9, Math.PI / 2, 0, true);
    } else {
      ctx.arc(postL, h, r9, Math.PI, -Math.PI / 2, false);
      ctx.lineTo(postR, h - r9);
      ctx.arc(postR, h, r9, -Math.PI / 2, 0, false);
    }
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawD(1);
  drawD(-1);

  // Goals
  const gw = goalHalf * 2;
  const gd = 10;
  ctx.fillStyle = COLORS.goalFill;
  ctx.fillRect(midX - gw / 2, -2, gw, gd);
  ctx.fillRect(midX - gw / 2, h - gd + 2, gw, gd);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(midX - gw / 2, -2, gw, gd);
  ctx.strokeRect(midX - gw / 2, h - gd + 2, gw, gd);

  // Zone labels
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '600 13px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ÚTOK', midX, 22);
  ctx.fillText('OBRANA', midX, h - 12);
}

function tokensFromFormation(formation) {
  const list = [];
  for (const role of ROLES) {
    list.push({ role, phase: 'attack', ...formation[role].attack });
    list.push({ role, phase: 'defense', ...formation[role].defense });
  }
  return list;
}

export function createFormationEditor(canvas, initialFormation, onChange) {
  const ctx = canvas.getContext('2d');
  let formation = normalizeFormation(initialFormation);
  let drag = null;

  function syncFromFormation() {
    return tokensFromFormation(formation);
  }

  let tokens = syncFromFormation();

  function canvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
    };
  }

  function hitTest(x, y) {
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      const p = slotToCanvas(t, canvas.width, canvas.height);
      if (Math.hypot(p.x - x, p.y - y) <= TOKEN_R + 4) return i;
    }
    return -1;
  }

  function draw() {
    drawMiniCourt(ctx, canvas.width, canvas.height);

    for (const t of tokens) {
      const p = slotToCanvas(t, canvas.width, canvas.height);
      const isAttack = t.phase === 'attack';
      ctx.beginPath();
      ctx.arc(p.x, p.y, TOKEN_R, 0, Math.PI * 2);
      ctx.fillStyle = isAttack ? COLORS.home : '#5a8fbf';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = t.role === 'gk' ? '#fff' : 'rgba(0,0,0,0.35)';
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = '700 10px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ROLE_LABELS[t.role], p.x, p.y);
    }

    if (drag) {
      const t = tokens[drag.index];
      const p = slotToCanvas(t, canvas.width, canvas.height);
      ctx.beginPath();
      ctx.arc(p.x, p.y, TOKEN_R + 4, 0, Math.PI * 2);
      ctx.strokeStyle = COLORS.controlled;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  function commit() {
    for (const t of tokens) {
      formation[t.role][t.phase] = { nx: t.nx, ny: t.ny };
    }
    formation = saveFormation(formation);
    tokens = syncFromFormation();
    onChange?.(formation);
    draw();
  }

  function onPointerDown(e) {
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = canvasPoint(e);
    const idx = hitTest(x, y);
    if (idx < 0) return;
    drag = { index: idx, pointerId: e.pointerId };
    draw();
  }

  function onPointerMove(e) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const { x, y } = canvasPoint(e);
    const slot = canvasToSlot(x, y, canvas.width, canvas.height);
    const t = tokens[drag.index];
    // Keep attack tokens mostly in upper half, defense in lower — soft clamp
    if (t.phase === 'attack') {
      t.ny = Math.max(0.42, slot.ny);
      t.nx = slot.nx;
    } else {
      t.ny = Math.min(0.55, slot.ny);
      t.nx = slot.nx;
    }
    // GK stays near own goal
    if (t.role === 'gk') {
      t.ny = Math.min(t.ny, 0.22);
      t.nx = clamp01(t.nx);
    }
    draw();
  }

  function onPointerUp(e) {
    if (!drag || drag.pointerId !== e.pointerId) return;
    drag = null;
    commit();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  document.getElementById('formation-reset')?.addEventListener('click', () => {
    formation = saveFormation(defaultFormation());
    tokens = syncFromFormation();
    onChange?.(formation);
    draw();
  });

  draw();

  return {
    getFormation: () => formation,
    setFormation(next) {
      formation = normalizeFormation(next);
      tokens = syncFromFormation();
      draw();
    },
    redraw: draw,
  };
}
