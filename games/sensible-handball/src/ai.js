import { CONFIG, TEAM } from './config.js';
import { findPassTarget } from './pass.js';
import { movePlayer, passBall, passToPlayer, shootBall, tryTackle } from './physics.js';
import { getSlot, toWorld } from './formations.js';

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function formationTarget(player, phase, formation, court) {
  const slot = getSlot(formation, player.role, phase);
  return toWorld(slot, player.team, court);
}

function openSpaceScore(x, y, players, team, court) {
  let score = 0;
  if (team === TEAM.HOME) score += (x / court.w) * 0.4;
  else score += (1 - x / court.w) * 0.4;

  for (const p of players) {
    if (p.team === team) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    score += Math.min(1, d / 120) * 0.15;
  }

  for (const p of players) {
    if (p.team !== team || p.isGK) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < 50) score -= 0.35;
  }

  if (court.inForbiddenCrease(x, y, team)) score -= 2;
  return score;
}

/** Spread outlets along own 9 m line so GK has pass options. */
function gkOutletTarget(player, court) {
  const r9 = court.marks.r9;
  const lateral = {
    wingL: 0.14,
    wingR: 0.86,
    backL: 0.3,
    backC: 0.5,
    backR: 0.7,
    pivot: 0.5,
  }[player.role] ?? 0.5;

  const y = clamp(lateral * court.h, 36, court.h - 36);
  // Pivot a bit further out; backs/wings hug the 9 m line
  const out = player.role === 'pivot' ? 28 : player.role.startsWith('wing') ? 8 : 14;

  if (player.team === TEAM.HOME) {
    return { x: clamp(r9 + out, 40, court.w - 40), y };
  }
  return { x: clamp(court.w - r9 - out, 40, court.w - 40), y };
}

function pickRunTarget(player, players, ball, court, formation) {
  const owner = ball.ownerId != null ? players.find((p) => p.id === ball.ownerId) : null;

  // GK has the ball → stay near 9 m for outlet, don't flood the attack
  if (owner && owner.team === player.team && owner.isGK) {
    const outlet = gkOutletTarget(player, court);
    return {
      x: outlet.x + (Math.random() - 0.5) * 16,
      y: outlet.y + (Math.random() - 0.5) * 20,
    };
  }

  const home = formationTarget(player, 'attack', formation, court);

  let best = { x: home.x, y: home.y, s: openSpaceScore(home.x, home.y, players, player.team, court) + 0.55 };

  const samples = 8;
  for (let i = 0; i < samples; i++) {
    const angle = (Math.PI * 2 * i) / samples;
    const dist = 35 + (i % 3) * 22;
    let x = home.x + Math.cos(angle) * dist;
    let y = home.y + Math.sin(angle) * dist;
    x = clamp(x, 40, court.w - 40);
    y = clamp(y, 40, court.h - 40);

    if (court.inForbiddenCrease(x, y, player.team)) continue;

    let s = openSpaceScore(x, y, players, player.team, court);
    const slotDist = Math.hypot(x - home.x, y - home.y);
    s += Math.max(0, 1 - slotDist / 140) * 0.5;

    if (s > best.s) best = { x, y, s };
  }

  if (owner && owner.id !== player.id && player.role !== 'pivot' && player.role !== 'gk') {
    const ox = owner.x * 0.35 + home.x * 0.65;
    const oy = owner.y * 0.35 + home.y * 0.65;
    const sx = clamp(ox, 40, court.w - 40);
    const sy = clamp(oy, 40, court.h - 40);
    const s = openSpaceScore(sx, sy, players, player.team, court) + 0.35;
    if (s > best.s) best = { x: sx, y: sy, s };
  }

  return best;
}

function defensiveTarget(player, players, ball, court, formation) {
  const home = formationTarget(player, 'defense', formation, court);
  const owner = ball.ownerId != null ? players.find((p) => p.id === ball.ownerId) : null;

  // Soft pressure: nearest defender to ball shadows slightly
  const teammates = players.filter((p) => p.team === player.team && !p.isGK);
  teammates.sort(
    (a, b) =>
      Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y),
  );
  const isPresser = teammates[0] && teammates[0].id === player.id;

  if (isPresser && (!owner || owner.team !== player.team)) {
    return {
      x: home.x * 0.45 + ball.x * 0.55,
      y: home.y * 0.45 + ball.y * 0.55,
    };
  }

  // Otherwise hold formation slot with tiny ball bias
  return {
    x: home.x * 0.85 + ball.x * 0.15,
    y: home.y * 0.85 + ball.y * 0.15,
  };
}

function nearestTeammate(gk, players) {
  let best = null;
  let bestDist = Infinity;
  for (const p of players) {
    if (p.team !== gk.team || p.isGK || p.id === gk.id) continue;
    const d = Math.hypot(p.x - gk.x, p.y - gk.y);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

/** GK with ball: short hold, then pass to nearest teammate. */
function gkDistribute(gk, players, ball, court, dt) {
  const target = nearestTeammate(gk, players);
  if (!target) return;

  gk.facingX = target.x - gk.x;
  gk.facingY = target.y - gk.y;

  if (gk._distributeArm == null) {
    gk._distributeArm = 0.28 + Math.random() * 0.2;
  }
  gk._distributeArm -= dt;

  // Step slightly toward target while winding up
  const dx = target.x - gk.x;
  const dy = target.y - gk.y;
  const dist = Math.hypot(dx, dy) || 1;
  movePlayer(gk, dx / dist, dy / dist, false, dt, court);

  if (gk._distributeArm <= 0) {
    const charge = clamp(0.35 + dist / 500, 0.35, 0.75);
    passToPlayer(ball, gk, target, charge);
    gk._distributeArm = null;
  }
}

function updateGK(gk, ball, players, court, dt, formation) {
  gk._distributeArm = null;
  const crease = gk.team === TEAM.HOME ? court.homeCrease : court.awayCrease;
  const goal = gk.team === TEAM.HOME ? court.homeGoal : court.awayGoal;
  const slot = formationTarget(gk, 'defense', formation, court);

  let tx = slot.x * 0.6 + crease.cx * 0.4;
  let ty = clamp(ball.y * 0.5 + slot.y * 0.5, goal.y + 8, goal.y + goal.h - 8);

  if (ball.inFlight && ball.isShot) {
    const toward =
      (gk.team === TEAM.HOME && ball.vx < 0) || (gk.team === TEAM.AWAY && ball.vx > 0);
    if (toward) {
      tx = ball.x;
      ty = ball.y;
    }
  } else if (ball.ownerId != null) {
    const owner = players.find((p) => p.id === ball.ownerId);
    if (owner && owner.team !== gk.team) {
      ty = clamp(owner.y * 0.7 + court.midY * 0.3, goal.y + 8, goal.y + goal.h - 8);
    }
  }

  const dx = tx - gk.x;
  const dy = ty - gk.y;
  const dist = Math.hypot(dx, dy);
  let dirX = 0;
  let dirY = 0;
  if (dist > 4) {
    dirX = dx / dist;
    dirY = dy / dist;
  }
  movePlayer(gk, dirX, dirY, dist > 50, dt, court);
}

function aiWithBall(player, players, ball, court, dt) {
  const goal = player.team === TEAM.HOME ? court.awayGoal : court.homeGoal;
  const gx = goal.x + goal.w / 2;
  const gy = goal.y + goal.h / 2;
  const distGoal = Math.hypot(gx - player.x, gy - player.y);

  let pressure = 0;
  for (const opp of players) {
    if (opp.team === player.team) continue;
    const d = Math.hypot(opp.x - player.x, opp.y - player.y);
    if (d < 55) pressure = Math.max(pressure, 1 - d / 55);
  }

  player.aiTimer -= dt;
  if (player.aiTimer <= 0) {
    player.aiTimer = CONFIG.AI_REACTION + Math.random() * 0.15;

    if (distGoal < CONFIG.AI_SHOT_RANGE && pressure < 0.75) {
      player.facingX = gx - player.x;
      player.facingY = gy - player.y;
      shootBall(ball, player, 0.45 + Math.random() * 0.4, gy + (Math.random() - 0.5) * 40, court);
      return;
    }

    const pick = findPassTarget(
      player,
      players,
      player.facingX || (player.team === 0 ? 1 : -1),
      player.facingY,
    );
    if (pick && (pressure > 0.45 || distGoal > CONFIG.AI_PASS_RANGE) && pick.risk < 0.7) {
      passBall(ball, player, players, 0.35 + Math.random() * 0.4);
      return;
    }
  }

  let tx = gx;
  let ty = gy + Math.sin(performance.now() / 400 + player.id) * 50;
  if (pressure > 0.3) {
    ty = player.y + (player.y < court.midY ? -80 : 80);
    tx = player.x + (player.team === TEAM.HOME ? 40 : -40);
  }

  const dx = tx - player.x;
  const dy = ty - player.y;
  const dist = Math.hypot(dx, dy) || 1;
  movePlayer(player, dx / dist, dy / dist, pressure < 0.5, dt, court);
}

/** Nearest N field players on a team to the ball. */
function nearestOnTeam(players, team, ball, n = 1) {
  return players
    .filter((p) => p.team === team && !p.isGK)
    .sort(
      (a, b) =>
        Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y),
    )
    .slice(0, n);
}

function leadBallPoint(ball) {
  return {
    x: ball.x + ball.vx * 0.12,
    y: ball.y + ball.vy * 0.12,
  };
}

export function updateAI(players, ball, court, dt, humanTeam = TEAM.HOME, formation) {
  const owner = ball.ownerId != null ? players.find((p) => p.id === ball.ownerId) : null;
  // During pass/shot flight, keep attacking team from last possession
  const possessingTeam = owner ? owner.team : ball.lastTeam;
  const loose = ball.ownerId == null;

  // Intended receiver is steered by updatePassReceiver — don't double-move
  const passRecv =
    loose && !ball.isShot && ball.passTargetId != null ? ball.passTargetId : null;

  const homeChasers =
    loose && !passRecv ? nearestOnTeam(players, TEAM.HOME, ball, 1) : [];
  const awayChasers = loose ? nearestOnTeam(players, TEAM.AWAY, ball, 1) : [];
  const chaserIds = new Set([...homeChasers, ...awayChasers].map((p) => p.id));

  for (const p of players) {
    if (p.controlled) continue;

    // GK / field player with the ball
    if (owner && owner.id === p.id) {
      if (p.isGK) gkDistribute(p, players, ball, court, dt);
      else aiWithBall(p, players, ball, court, dt);
      continue;
    }

    if (p.isGK) {
      updateGK(p, ball, players, court, dt, formation);
      continue;
    }

    // Intended pass receiver already moved this frame
    if (passRecv != null && p.id === passRecv) continue;

    // Loose ball: nearest from each team chase it
    if (loose && chaserIds.has(p.id)) {
      const lead = leadBallPoint(ball);
      p.aiTargetX = lead.x;
      p.aiTargetY = lead.y;
      const dx = p.aiTargetX - p.x;
      const dy = p.aiTargetY - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      movePlayer(p, dx / dist, dy / dist, true, dt, court);
      continue;
    }

    const onAttack = possessingTeam === p.team;
    p.aiTimer -= dt;
    if (p.aiTimer <= 0) {
      p.aiTimer = 0.35 + Math.random() * 0.25;
      const t = onAttack
        ? pickRunTarget(p, players, ball, court, formation)
        : defensiveTarget(p, players, ball, court, formation);
      p.aiTargetX = t.x;
      p.aiTargetY = t.y;
    }

    const dx = p.aiTargetX - p.x;
    const dy = p.aiTargetY - p.y;
    const dist = Math.hypot(dx, dy);
    let dirX = 0;
    let dirY = 0;
    if (dist > 8) {
      dirX = dx / dist;
      dirY = dy / dist;
    }
    const sprint = onAttack ? dist > 40 : dist > 55;
    movePlayer(p, dirX, dirY, sprint, dt, court);

    if (p.team !== humanTeam || !p.controlled) {
      if ((!owner || owner.team !== p.team) && Math.random() < 0.02) {
        tryTackle(p, ball, players);
      }
    }
  }
}
