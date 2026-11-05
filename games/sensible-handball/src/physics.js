import { CONFIG } from './config.js';
import { findPassTargets, leadPassPoint, passOfferRadius } from './pass.js';

export function updateStamina(player, sprinting, dt) {
  if (sprinting && player.stamina > CONFIG.STAMINA_MIN_SPRINT) {
    player.stamina = Math.max(0, player.stamina - CONFIG.STAMINA_DRAIN * dt);
  } else {
    player.stamina = Math.min(CONFIG.STAMINA_MAX, player.stamina + CONFIG.STAMINA_REGEN * dt);
  }
}

export function movePlayer(player, dirX, dirY, sprint, dt, court) {
  const canSprint = sprint && player.stamina > CONFIG.STAMINA_MIN_SPRINT;
  updateStamina(player, canSprint, dt);

  const speed = CONFIG.BASE_SPEED * (canSprint ? CONFIG.SPRINT_MULT : 1) * (player.isGK ? 0.9 : 1);
  if (dirX !== 0 || dirY !== 0) {
    player.vx = dirX * speed;
    player.vy = dirY * speed;
    player.facingX = dirX;
    player.facingY = dirY;
  } else {
    player.vx *= 0.75;
    player.vy *= 0.75;
    if (Math.hypot(player.vx, player.vy) < 5) {
      player.vx = 0;
      player.vy = 0;
    }
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;
  court.clampPlayer(player);

  if (player.tackleCooldown > 0) player.tackleCooldown -= dt;
}

export function separatePlayers(players) {
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i];
      const b = players[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = a.radius + b.radius;
      if (dist > 0 && dist < min) {
        const push = (min - dist) * 0.5;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}

export function attachBallToOwner(ball, players) {
  if (ball.ownerId == null) return;
  const owner = players.find((p) => p.id === ball.ownerId);
  if (!owner) {
    ball.ownerId = null;
    return;
  }
  ball.lastTeam = owner.team;
  const fl = Math.hypot(owner.facingX, owner.facingY) || 1;
  ball.x = owner.x + (owner.facingX / fl) * CONFIG.BALL_HOLD_OFFSET;
  ball.y = owner.y + (owner.facingY / fl) * CONFIG.BALL_HOLD_OFFSET;
  ball.vx = 0;
  ball.vy = 0;
  ball.inFlight = false;
  ball.isShot = false;
  ball.arcPeak = 0;
  ball.flightProgress = 0;
  ball.flightDuration = 0;
}

/** Bounce scale while holding: moving, or standing still ≥ 1s. */
export function updateDribble(ball, players, dt) {
  if (ball.ownerId == null) {
    ball.dribblePhase = 0;
    ball.dribbleScale = 1;
    return;
  }
  const owner = players.find((p) => p.id === ball.ownerId);
  if (!owner) {
    ball.dribbleScale = 1;
    return;
  }

  const speed = Math.hypot(owner.vx, owner.vy);
  const moving = speed >= CONFIG.DRIBBLE_MOVE_SPEED;
  if (moving) owner.standStillTime = 0;
  else owner.standStillTime = (owner.standStillTime || 0) + dt;

  const dribbling = moving || owner.standStillTime >= CONFIG.DRIBBLE_STILL_DELAY;
  if (!dribbling) {
    ball.dribblePhase = 0;
    ball.dribbleScale = 1;
    ball.height = 0;
    return;
  }

  const hz = moving ? CONFIG.DRIBBLE_BOUNCE_HZ_MOVE : CONFIG.DRIBBLE_BOUNCE_HZ_STILL;
  ball.dribblePhase = (ball.dribblePhase || 0) + dt * hz;
  // 0 → 1 → 0 (squash at ground, full size at peak)
  const t = Math.abs(Math.sin(ball.dribblePhase * Math.PI));
  ball.dribbleScale = CONFIG.DRIBBLE_SCALE_MIN + (1 - CONFIG.DRIBBLE_SCALE_MIN) * t;
  ball.height = t * 7;
}

function resetBallArc(ball) {
  ball.height = 0;
  ball.arcPeak = 0;
  ball.flightProgress = 0;
  ball.flightDuration = 0;
}

/** Half-angle of throw accuracy sector (radians). Sector % is of a full circle. */
export function throwSpreadHalfRad() {
  return (CONFIG.THROW_SPREAD_PCT / 100) * Math.PI;
}

/** Rotate aim by a random offset inside the accuracy cone. */
export function applyThrowSpread(aimX, aimY) {
  const half = throwSpreadHalfRad();
  if (half <= 0) return { x: aimX, y: aimY };
  const offset = (Math.random() * 2 - 1) * half;
  const c = Math.cos(offset);
  const s = Math.sin(offset);
  return {
    x: aimX * c - aimY * s,
    y: aimX * s + aimY * c,
  };
}

export function releaseBall(ball, owner, aimX, aimY, speed, isShot) {
  const dist = Math.hypot(aimX, aimY) || 1;
  const nx = aimX / dist;
  const ny = aimY / dist;
  ball.ownerId = null;
  owner.hasBall = false;
  ball.inFlight = true;
  ball.isShot = isShot;
  ball.flightAge = 0;
  ball.lastPasserId = owner.id;
  ball.lastTeam = owner.team; // keep possession team during pass/shot flight
  ball.passTargetId = null;
  ball.x = owner.x + nx * (owner.radius + CONFIG.BALL_RADIUS + 2);
  ball.y = owner.y + ny * (owner.radius + CONFIG.BALL_RADIUS + 2);
  ball.vx = nx * speed;
  ball.vy = ny * speed;

  // Longer throw → higher arc; duration ≈ time to cover intended distance
  ball.arcPeak = Math.min(
    CONFIG.ARC_HEIGHT_MAX,
    CONFIG.ARC_HEIGHT_BASE + dist * CONFIG.ARC_HEIGHT_PER_PX,
  );
  ball.flightDuration = Math.max(0.12, dist / Math.max(60, speed));
  ball.flightProgress = 0;
  ball.height = 0;
}

/**
 * @param {'near'|'far'} slot  S → near (closest), A → far (second)
 * @param {{ maxDist?: number }} [opts]  S offer circle radius for near passes
 */
export function passBall(ball, passer, players, charge, slot = 'near', opts = {}) {
  const fl = Math.hypot(passer.facingX, passer.facingY) || 1;
  const fx = passer.facingX / fl;
  const fy = passer.facingY / fl;
  const maxDist =
    opts.maxDist ??
    (slot === 'near' ? passOfferRadius(opts.holdTime) : CONFIG.PASS_MAX_DIST);
  const { near, far } = findPassTargets(passer, players, fx, fy, {
    maxDist: slot === 'near' ? maxDist : CONFIG.PASS_MAX_DIST,
  });
  const pick = slot === 'far' ? far || near : near;
  const t = Math.max(0, Math.min(1, charge));
  const speed = CONFIG.PASS_SPEED_MIN + (CONFIG.PASS_SPEED_MAX - CONFIG.PASS_SPEED_MIN) * t;

  let aimX;
  let aimY;
  if (pick) {
    const lead = leadPassPoint(passer, pick.target);
    aimX = lead.x - passer.x;
    aimY = lead.y - passer.y;
  } else {
    // No teammate (solo / open throw): distance scales with charge
    const throwDist = 70 + t * (CONFIG.PASS_MAX_DIST - 70);
    aimX = fx * throwDist;
    aimY = fy * throwDist;
  }
  const spread = applyThrowSpread(aimX, aimY);
  releaseBall(ball, passer, spread.x, spread.y, speed, false);
  if (pick) ball.passTargetId = pick.target.id;
  return pick;
}

/** Direct pass to a specific teammate (used by GK distribution). */
export function passToPlayer(ball, passer, target, charge = 0.55) {
  const t = Math.max(0, Math.min(1, charge));
  const speed = CONFIG.PASS_SPEED_MIN + (CONFIG.PASS_SPEED_MAX - CONFIG.PASS_SPEED_MIN) * t;
  const lead = leadPassPoint(passer, target);
  passer.facingX = target.x - passer.x;
  passer.facingY = target.y - passer.y;
  const spread = applyThrowSpread(lead.x - passer.x, lead.y - passer.y);
  releaseBall(ball, passer, spread.x, spread.y, speed, false);
  ball.passTargetId = target.id;
}

/**
 * Intended pass receiver runs to where the ball will be (intercept lead).
 * Keeps chasing until pickup — works in match and test modes.
 */
export function updatePassReceiver(players, ball, court, dt) {
  if (ball.ownerId != null || ball.isShot || ball.passTargetId == null) return;
  const receiver = players.find((p) => p.id === ball.passTargetId);
  if (!receiver || receiver.controlled || receiver.isGK) return;

  const speed = Math.hypot(ball.vx, ball.vy) || 1;
  const dist = Math.hypot(ball.x - receiver.x, ball.y - receiver.y);
  const eta = speed > 20 ? Math.min(0.55, dist / speed) : 0.08;
  const tx = ball.x + ball.vx * eta;
  const ty = ball.y + ball.vy * eta;
  const dx = tx - receiver.x;
  const dy = ty - receiver.y;
  const d = Math.hypot(dx, dy) || 1;
  if (d < 3) return;

  // Normal run only — must reach the ball at BASE_SPEED (no free sprint catch)
  movePlayer(receiver, dx / d, dy / d, false, dt, court);
}

export function shootBall(ball, shooter, charge, goalAimY, court) {
  const t = Math.max(0, Math.min(1, charge));
  const speed = CONFIG.SHOT_SPEED_MIN + (CONFIG.SHOT_SPEED_MAX - CONFIG.SHOT_SPEED_MIN) * t;

  const goal = shooter.team === 0 ? court.awayGoal : court.homeGoal;
  const gx = goal.x + goal.w / 2;
  const gy = goalAimY != null ? goalAimY : goal.y + goal.h / 2;

  // Blend facing with goal direction for arcade feel
  let aimX = gx - shooter.x;
  let aimY = gy - shooter.y;
  const fl = Math.hypot(aimX, aimY) || 1;
  aimX /= fl;
  aimY /= fl;

  // Facing bias
  const faceL = Math.hypot(shooter.facingX, shooter.facingY) || 1;
  aimX = aimX * 0.75 + (shooter.facingX / faceL) * 0.25;
  aimY = aimY * 0.75 + (shooter.facingY / faceL) * 0.25;

  // Pressure reduces accuracy
  // (caller can nudge facing beforehand)

  releaseBall(ball, shooter, aimX, aimY, speed, true);
}

export function updateBallFlight(ball, dt, curveDir) {
  if (!ball.inFlight || ball.ownerId != null) return;

  ball.flightAge += dt;

  // Mild curve while shot is in flight (Sensible-style steer)
  if (ball.isShot && curveDir !== 0) {
    const fl = Math.hypot(ball.vx, ball.vy) || 1;
    const px = -ball.vy / fl;
    const py = ball.vx / fl;
    ball.vx += px * curveDir * CONFIG.SHOT_CURVE * dt;
    ball.vy += py * curveDir * CONFIG.SHOT_CURVE * dt;
  }

  ball.vx *= CONFIG.BALL_FRICTION;
  ball.vy *= CONFIG.BALL_FRICTION;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // Parabolic arc height over planned flight (peak in the middle)
  const dur = Math.max(0.08, ball.flightDuration || 0.35);
  ball.flightProgress = Math.min(1, ball.flightAge / dur);
  const peak = ball.arcPeak || 0;
  ball.height = Math.sin(Math.PI * ball.flightProgress) * peak;

  if (Math.hypot(ball.vx, ball.vy) < 25 && ball.flightAge > 0.35) {
    ball.inFlight = false;
    ball.isShot = false;
    resetBallArc(ball);
  }
}

export function tryPickupAndIntercept(ball, players) {
  if (ball.ownerId != null) return null;

  // Slight delay before same passer can reclaim
  let best = null;
  let bestDist = Infinity;

  for (const p of players) {
    if (p.id === ball.lastPasserId && ball.flightAge < 0.18) continue;
    // Ball still high in the arc — field players can't snatch it mid-air easily
    if (!p.isGK && (ball.height || 0) > 16) continue;
    const dist = Math.hypot(ball.x - p.x, ball.y - p.y);
    const reach = ball.inFlight
      ? CONFIG.INTERCEPT_RADIUS + p.radius * 0.35
      : CONFIG.PICKUP_RADIUS + p.radius * 0.2;
    if (dist < reach && dist < bestDist) {
      // Shots are harder to intercept for field players unless close
      if (ball.isShot && !p.isGK && dist > CONFIG.INTERCEPT_RADIUS * 0.75) continue;
      best = p;
      bestDist = dist;
    }
  }

  if (best) {
    // Clear previous ownership flags
    for (const p of players) p.hasBall = false;
    ball.ownerId = best.id;
    best.hasBall = true;
    ball.inFlight = false;
    ball.isShot = false;
    ball.vx = 0;
    ball.vy = 0;
    ball.lastPasserId = null;
    ball.passTargetId = null;
    ball.lastTeam = best.team;
    resetBallArc(ball);
    return best;
  }
  return null;
}

export function tryTackle(tackler, ball, players) {
  if (tackler.tackleCooldown > 0 || ball.ownerId == null) return false;
  const owner = players.find((p) => p.id === ball.ownerId);
  if (!owner || owner.team === tackler.team) return false;

  const dist = Math.hypot(owner.x - tackler.x, owner.y - tackler.y);
  if (dist > CONFIG.TACKLE_RADIUS + tackler.radius) return false;

  tackler.tackleCooldown = 0.7;
  owner.hasBall = false;
  ball.ownerId = null;
  ball.inFlight = true;
  ball.isShot = false;
  ball.flightAge = 0;
  ball.lastPasserId = owner.id;
  ball.passTargetId = null;
  // Loose after tackle — neither team "has" it for formation purposes until pickup
  ball.lastTeam = null;

  // Knock ball loosely toward tackler facing
  const fl = Math.hypot(tackler.facingX, tackler.facingY) || 1;
  ball.vx = (tackler.facingX / fl) * 120 + (Math.random() - 0.5) * 40;
  ball.vy = (tackler.facingY / fl) * 120 + (Math.random() - 0.5) * 40;
  ball.x = (owner.x + tackler.x) / 2;
  ball.y = (owner.y + tackler.y) / 2;
  // Short low arc on loose knock-on
  ball.arcPeak = 10;
  ball.flightDuration = 0.35;
  ball.flightProgress = 0;
  ball.height = 0;
  return true;
}

export function bounceBallInBounds(ball, court) {
  const m = CONFIG.BALL_RADIUS;
  let out = false;
  if (ball.y < m) {
    ball.y = m;
    ball.vy = Math.abs(ball.vy) * 0.7;
    out = true;
  } else if (ball.y > court.h - m) {
    ball.y = court.h - m;
    ball.vy = -Math.abs(ball.vy) * 0.7;
    out = true;
  }
  // Side lines — bounce unless in goal mouth
  if (ball.x < m) {
    const inGoal =
      ball.y >= court.homeGoal.y && ball.y <= court.homeGoal.y + court.homeGoal.h;
    if (!inGoal) {
      ball.x = m;
      ball.vx = Math.abs(ball.vx) * 0.7;
      out = true;
    }
  } else if (ball.x > court.w - m) {
    const inGoal =
      ball.y >= court.awayGoal.y && ball.y <= court.awayGoal.y + court.awayGoal.h;
    if (!inGoal) {
      ball.x = court.w - m;
      ball.vx = -Math.abs(ball.vx) * 0.7;
      out = true;
    }
  }
  return out;
}
