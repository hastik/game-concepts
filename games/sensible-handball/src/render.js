import { COLORS, CONFIG, TEAM } from './config.js';
import { findPassTargets } from './pass.js';

/** Trace IHF goal-area / free-throw arc for home (left) or away (right). */
function traceMeterLine(ctx, court, radius, side) {
  const { midY, w, marks } = court;
  const { postTop, postBot } = marks;

  if (side === 'home') {
    ctx.moveTo(0, postTop - radius);
    ctx.arc(0, postTop, radius, -Math.PI / 2, 0);
    ctx.lineTo(radius, postBot);
    ctx.arc(0, postBot, radius, 0, Math.PI / 2);
  } else {
    ctx.moveTo(w, postTop - radius);
    ctx.arc(w, postTop, radius, -Math.PI / 2, -Math.PI, true);
    ctx.lineTo(w - radius, postBot);
    ctx.arc(w, postBot, radius, Math.PI, Math.PI / 2, true);
  }
}

function fillGoalArea(ctx, court, side, alert = false) {
  const { w, marks } = court;
  const { r6, postTop, postBot } = marks;

  ctx.beginPath();
  if (side === 'home') {
    ctx.moveTo(0, postTop - r6);
    ctx.arc(0, postTop, r6, -Math.PI / 2, 0);
    ctx.lineTo(r6, postBot);
    ctx.arc(0, postBot, r6, 0, Math.PI / 2);
    ctx.lineTo(0, postBot + r6);
    ctx.closePath();
  } else {
    ctx.moveTo(w, postTop - r6);
    ctx.arc(w, postTop, r6, -Math.PI / 2, -Math.PI, true);
    ctx.lineTo(w - r6, postBot);
    ctx.arc(w, postBot, r6, Math.PI, Math.PI / 2, true);
    ctx.lineTo(w, postBot + r6);
    ctx.closePath();
  }

  if (alert) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
    ctx.fillStyle = `rgba(255,255,255,${0.14 + pulse * 0.28})`;
  } else {
    ctx.fillStyle = COLORS.crease;
  }
  ctx.fill();
}

function strokeDashedMeterLine(ctx, court, radius, side) {
  ctx.beginPath();
  traceMeterLine(ctx, court, radius, side);
  ctx.strokeStyle = COLORS.courtLine;
  ctx.lineWidth = 2;
  // ~15cm dash / gap at our scale (24px/m → 3.6px; use readable dashes)
  ctx.setLineDash([5, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function strokeSolidMeterLine(ctx, court, radius, side) {
  ctx.beginPath();
  traceMeterLine(ctx, court, radius, side);
  ctx.strokeStyle = COLORS.courtLine;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  ctx.stroke();
}

function drawGoalFrame(ctx, goal, facing) {
  ctx.fillStyle = COLORS.goalFill;
  ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
  ctx.strokeStyle = COLORS.goalStroke;
  ctx.lineWidth = 3;
  ctx.strokeRect(goal.x, goal.y, goal.w, goal.h);

  // Net hint
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  const step = 8;
  for (let y = goal.y + step; y < goal.y + goal.h; y += step) {
    ctx.beginPath();
    ctx.moveTo(goal.x, y);
    ctx.lineTo(goal.x + goal.w, y);
    ctx.stroke();
  }
  for (let x = goal.x + step; x < goal.x + goal.w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, goal.y);
    ctx.lineTo(x, goal.y + goal.h);
    ctx.stroke();
  }

  // Posts emphasis on goal line
  ctx.fillStyle = '#fff';
  const postW = 3;
  if (facing === 'home') {
    ctx.fillRect(goal.x + goal.w - 1, goal.y - 1, postW, goal.h + 2);
  } else {
    ctx.fillRect(goal.x - postW + 1, goal.y - 1, postW, goal.h + 2);
  }
}

export function drawCourt(ctx, court, creaseAlert = { home: false, away: false }) {
  const { w, h, midX, midY, homeGoal, awayGoal, marks } = court;
  const { r6, r7, r9, r4, penaltyLen, gkLineLen, postTop, postBot } = marks;

  // Floor
  ctx.fillStyle = COLORS.court;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = COLORS.courtDark;
  ctx.fillRect(midX, 0, midX, h);

  // Goal areas fill (blink lighter when a field player is inside)
  fillGoalArea(ctx, court, 'home', !!creaseAlert.home);
  fillGoalArea(ctx, court, 'away', !!creaseAlert.away);

  ctx.strokeStyle = COLORS.courtLine;
  ctx.lineWidth = 2.5;

  // Outer boundary (side lines + outer goal lines)
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);

  // Centre line
  ctx.beginPath();
  ctx.moveTo(midX, 1.5);
  ctx.lineTo(midX, h - 1.5);
  ctx.stroke();

  // Centre mark
  ctx.beginPath();
  ctx.arc(midX, midY, 3, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.courtLine;
  ctx.fill();

  // Substitution zone ticks (4.5 m from centre on both sides)
  const sub = 4.5 * CONFIG.METER;
  ctx.lineWidth = 2;
  for (const dir of [-1, 1]) {
    const x = midX + dir * sub;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 10);
    ctx.moveTo(x, h);
    ctx.lineTo(x, h - 10);
    ctx.stroke();
  }

  // 6 m goal-area lines
  strokeSolidMeterLine(ctx, court, r6, 'home');
  strokeSolidMeterLine(ctx, court, r6, 'away');

  // 9 m free-throw lines (dashed)
  strokeDashedMeterLine(ctx, court, r9, 'home');
  strokeDashedMeterLine(ctx, court, r9, 'away');

  // 7 m penalty lines
  ctx.strokeStyle = COLORS.courtLine;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(r7, midY - penaltyLen / 2);
  ctx.lineTo(r7, midY + penaltyLen / 2);
  ctx.moveTo(w - r7, midY - penaltyLen / 2);
  ctx.lineTo(w - r7, midY + penaltyLen / 2);
  ctx.stroke();

  // 4 m goalkeeper restraining marks
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r4, midY - gkLineLen / 2);
  ctx.lineTo(r4, midY + gkLineLen / 2);
  ctx.moveTo(w - r4, midY - gkLineLen / 2);
  ctx.lineTo(w - r4, midY + gkLineLen / 2);
  ctx.stroke();

  // Goal line thicker between posts
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, postTop);
  ctx.lineTo(0, postBot);
  ctx.moveTo(w, postTop);
  ctx.lineTo(w, postBot);
  ctx.stroke();

  drawGoalFrame(ctx, homeGoal, 'home');
  drawGoalFrame(ctx, awayGoal, 'away');
}

export function drawPlayers(ctx, players) {
  for (const p of players) {
    let fill = p.team === TEAM.HOME ? COLORS.home : COLORS.away;
    if (p.isGK) fill = p.team === TEAM.HOME ? COLORS.gkHome : COLORS.gkAway;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();

    if (p.controlled) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = COLORS.controlled;
      ctx.stroke();
    } else {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.stroke();
    }

    const fl = Math.hypot(p.facingX, p.facingY) || 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + (p.facingX / fl) * (p.radius + 4), p.y + (p.facingY / fl) * (p.radius + 4));
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (p.controlled) {
      const frac = p.stamina / CONFIG.STAMINA_MAX;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.strokeStyle = frac > 0.3 ? 'rgba(255,255,255,0.55)' : COLORS.passRisk;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

export function drawBall(ctx, ball) {
  const h = ball.height || 0;
  const dribble = ball.ownerId != null ? ball.dribbleScale ?? 1 : 1;
  const scale = (1 + h * CONFIG.BALL_SCALE_PER_HEIGHT) * dribble;
  const r = CONFIG.BALL_RADIUS * scale;

  // Ground shadow (smaller / fainter when ball is high)
  const shadowScale = Math.max(0.35, 1 - h * 0.012);
  ctx.beginPath();
  ctx.ellipse(ball.x, ball.y + 2, r * 0.85 * shadowScale, r * 0.45 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(0,0,0,${0.28 * shadowScale})`;
  ctx.fill();

  // Ball drawn slightly “above” shadow when arcing / bouncing
  const lift = Math.min(18, h * 0.22);
  ctx.beginPath();
  ctx.arc(ball.x, ball.y - lift, r, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.ball;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLORS.ballStroke;
  ctx.stroke();
}

/** White vision sector (full aperture in degrees), fades with distance. Visual only. */
function drawVisionSector(ctx, player, apertureDeg, alpha) {
  const half = ((apertureDeg || 0) * Math.PI) / 180 / 2;
  const dist = CONFIG.VISION_CONE_DIST;
  if (half <= 0 || dist <= 0 || alpha <= 0) return;

  const fl = Math.hypot(player.facingX, player.facingY) || 1;
  const angle = Math.atan2(player.facingY / fl, player.facingX / fl);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.arc(player.x, player.y, dist, angle - half, angle + half);
  ctx.closePath();

  const grad = ctx.createRadialGradient(player.x, player.y, 0, player.x, player.y, dist);
  grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
  grad.addColorStop(0.55, `rgba(255,255,255,${alpha * 0.4})`);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

/** Peripheral (wide) + direct (narrow) vision cones for every player. */
export function drawVisionCones(ctx, players) {
  const alpha = CONFIG.VISION_CONE_ALPHA;
  if (alpha <= 0) return;
  for (const p of players) {
    drawVisionSector(ctx, p, CONFIG.VISION_PERIPH_DEG, alpha);
    drawVisionSector(ctx, p, CONFIG.VISION_DIRECT_DEG, alpha);
  }
}

/** Accuracy cone aimed at (dirX, dirY); fades out with distance. */
export function drawThrowConeAt(ctx, passer, dirX, dirY, tint = null) {
  if (!passer || !passer.hasBall) return;
  const fl = Math.hypot(dirX, dirY) || 1;
  const angle = Math.atan2(dirY / fl, dirX / fl);
  const half = (CONFIG.THROW_SPREAD_PCT / 100) * Math.PI;
  const dist = CONFIG.THROW_CONE_FADE_DIST;
  const alpha = CONFIG.THROW_CONE_ALPHA;
  if (half <= 0 || dist <= 0 || alpha <= 0) return;

  const r = tint?.r ?? 255;
  const g = tint?.g ?? 255;
  const b = tint?.b ?? 255;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(passer.x, passer.y);
  ctx.arc(passer.x, passer.y, dist, angle - half, angle + half);
  ctx.closePath();

  const grad = ctx.createRadialGradient(passer.x, passer.y, 0, passer.x, passer.y, dist);
  grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
  grad.addColorStop(0.55, `rgba(${r},${g},${b},${alpha * 0.45})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

function drawPassMarker(ctx, passer, pick, { color, dash, coneTint }) {
  const tx = pick.target.x;
  const ty = pick.target.y;

  drawThrowConeAt(ctx, passer, tx - passer.x, ty - passer.y, coneTint);

  ctx.beginPath();
  ctx.moveTo(passer.x, passer.y);
  ctx.lineTo(tx, ty);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.75;
  ctx.setLineDash(dash);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(tx, ty, pick.target.radius + 4, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Growing green circle: only teammates inside can be offered for S pass. */
export function drawPassOfferCircle(ctx, passer, radius) {
  if (!passer || !passer.hasBall || !(radius > 0)) return;
  ctx.beginPath();
  ctx.arc(passer.x, passer.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.passSafe;
  ctx.lineWidth = 1.75;
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(93,255,138,0.06)';
  ctx.fill();
}

/**
 * S (nearRange > 0): green offer inside growing circle.
 * A (showFar): white dotted second option (full max dist).
 */
export function drawPassIndicators(ctx, passer, players, { nearRange = 0, showFar = false } = {}) {
  if (!passer || !passer.hasBall) return;

  if (nearRange > 0) {
    drawPassOfferCircle(ctx, passer, nearRange);
    const { near } = findPassTargets(
      passer,
      players,
      passer.facingX,
      passer.facingY,
      { maxDist: nearRange },
    );
    if (near) {
      drawPassMarker(ctx, passer, near, {
        color: COLORS.passSafe,
        dash: [7, 5],
        coneTint: { r: 93, g: 255, b: 138 },
      });
    } else {
      drawThrowConeAt(ctx, passer, passer.facingX, passer.facingY);
    }
  }

  if (showFar) {
    const { far, near } = findPassTargets(
      passer,
      players,
      passer.facingX,
      passer.facingY,
    );
    const pick = far || near;
    if (pick) {
      drawPassMarker(ctx, passer, pick, {
        color: 'rgba(255,255,255,0.85)',
        dash: [2, 5],
        coneTint: { r: 255, g: 255, b: 255 },
      });
    } else {
      drawThrowConeAt(ctx, passer, passer.facingX, passer.facingY);
    }
  }
}

export function drawChargeBar(ctx, player, charge, kind) {
  if (!player || charge <= 0) return;
  const w = 28;
  const h = 4;
  const x = player.x - w / 2;
  const y = player.y - player.radius - 14;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle =
    kind === 'shot' ? COLORS.passRisk : kind === 'passFar' ? '#ffffff' : COLORS.passSafe;
  ctx.fillRect(x, y, w * Math.min(1, charge), h);
}

export function renderFrame(ctx, state) {
  const {
    court,
    players,
    ball,
    passNearCharge,
    passFarCharge,
    passNearRange,
    shotCharge,
    orientation,
  } = state;
  const portrait = orientation === 'portrait';

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  if (portrait) {
    ctx.translate(0, CONFIG.COURT_W);
    ctx.rotate(-Math.PI / 2);
  }

  const creaseAlert = court.creaseIntrusions(players);
  drawCourt(ctx, court, creaseAlert);
  drawVisionCones(ctx, players);
  drawPlayers(ctx, players);
  const controlled = players.find((p) => p.controlled);
  if (controlled && controlled.hasBall) {
    const nearCh = passNearCharge || 0;
    const farCh = passFarCharge || 0;
    // Always show at least the intro circle so nearby teammates are offered immediately
    const range = Math.max(passNearRange || 0, CONFIG.PASS_RANGE_MIN);
    drawPassIndicators(ctx, controlled, players, {
      nearRange: range,
      showFar: farCh > 0,
    });
    if (nearCh > 0) drawChargeBar(ctx, controlled, nearCh, 'pass');
    else if (farCh > 0) drawChargeBar(ctx, controlled, farCh, 'passFar');
    if (shotCharge > 0) drawChargeBar(ctx, controlled, shotCharge, 'shot');
  }
  drawBall(ctx, ball);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
