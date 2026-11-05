import { CONFIG, TEAM } from './config.js';
import { ROLES, getSlot, toWorld, loadFormation } from './formations.js';

let nextId = 1;

export function createPlayer({ x, y, team, isGK = false, role = 'field' }) {
  return {
    id: nextId++,
    x,
    y,
    vx: 0,
    vy: 0,
    team,
    isGK,
    role,
    radius: isGK ? CONFIG.GK_RADIUS : CONFIG.PLAYER_RADIUS,
    facingX: team === TEAM.HOME ? 1 : -1,
    facingY: 0,
    stamina: CONFIG.STAMINA_MAX,
    controlled: false,
    hasBall: false,
    aiTargetX: x,
    aiTargetY: y,
    aiTimer: 0,
    tackleCooldown: 0,
    standStillTime: 0,
  };
}

export function createBall(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    ownerId: null,
    inFlight: false,
    isShot: false,
    lastPasserId: null,
    lastTeam: null, // team that last possessed / passed — kept during flight
    passTargetId: null, // intended receiver — runs to the ball during flight
    flightAge: 0,
    height: 0, // visual/arc height (px)
    arcPeak: 0,
    flightDuration: 0,
    flightProgress: 0,
    dribblePhase: 0,
    dribbleScale: 1,
  };
}

/** Single player + ball for Solo test mode. */
export function spawnSolo(court) {
  nextId = 1;
  const player = createPlayer({
    x: court.midX,
    y: court.midY,
    team: TEAM.HOME,
    role: 'backC',
  });
  player.controlled = true;
  player.hasBall = true;
  player.facingX = 1;
  player.facingY = 0;
  return [player];
}

/** Controlled player + teammate on the away 9 m line (center). */
export function spawnDouble(court) {
  nextId = 1;
  const player = createPlayer({
    x: court.midX,
    y: court.midY,
    team: TEAM.HOME,
    role: 'backC',
  });
  player.controlled = true;
  player.hasBall = true;
  player.facingX = 1;
  player.facingY = 0;

  const mate = createPlayer({
    x: court.w - court.marks.r9,
    y: court.midY,
    team: TEAM.HOME,
    role: 'pivot',
  });
  mate.facingX = 1;
  mate.facingY = 0;

  return [player, mate];
}

/**
 * Controlled + mate in front of 9 m + mate on 9 m (center line).
 * Near = před 9m, far = na 9m when facing the goal.
 */
export function spawnTriple(court) {
  nextId = 1;
  const player = createPlayer({
    x: court.midX,
    y: court.midY,
    team: TEAM.HOME,
    role: 'backC',
  });
  player.controlled = true;
  player.hasBall = true;
  player.facingX = 1;
  player.facingY = 0;

  const onNine = court.w - court.marks.r9;
  const beforeNine = onNine - CONFIG.METER * 3;

  const mateNear = createPlayer({
    x: beforeNine,
    y: court.midY,
    team: TEAM.HOME,
    role: 'backR',
  });
  mateNear.facingX = 1;
  mateNear.facingY = 0;

  const mateFar = createPlayer({
    x: onNine,
    y: court.midY,
    team: TEAM.HOME,
    role: 'pivot',
  });
  mateFar.facingX = 1;
  mateFar.facingY = 0;

  return [player, mateNear, mateFar];
}

/**
 * Full home attack shape without GK — center back has the ball.
 * Uses saved attack slots from the formation editor.
 */
export function spawnSingleTeam(court, formation = loadFormation()) {
  nextId = 1;
  const players = [];

  for (const role of ROLES) {
    if (role === 'gk') continue;
    const slot = getSlot(formation, role, 'attack');
    const pos = toWorld(slot, TEAM.HOME, court);
    const p = createPlayer({
      x: pos.x,
      y: pos.y,
      team: TEAM.HOME,
      role,
    });
    p.facingX = 1;
    p.facingY = 0;
    players.push(p);
  }

  const backC =
    players.find((p) => p.role === 'backC') ||
    players.find((p) => p.role.startsWith('back')) ||
    players[0];
  if (backC) {
    backC.controlled = true;
    backC.hasBall = true;
  }

  return players;
}

/**
 * 7v7 from formation: roles gk, wingL/R, backL/C/R, pivot.
 * Kickoff places teams on their defense-ish half via defense slots (home) / mirrored.
 */
export function spawnTeams(court, formation = loadFormation()) {
  const players = [];

  for (const role of ROLES) {
    const slot = getSlot(formation, role, 'defense');
    const pos = toWorld(slot, TEAM.HOME, court);
    players.push(
      createPlayer({
        x: pos.x,
        y: pos.y,
        team: TEAM.HOME,
        isGK: role === 'gk',
        role,
      }),
    );
  }

  for (const role of ROLES) {
    const slot = getSlot(formation, role, 'defense');
    const pos = toWorld(slot, TEAM.AWAY, court);
    players.push(
      createPlayer({
        x: pos.x,
        y: pos.y,
        team: TEAM.AWAY,
        isGK: role === 'gk',
        role,
      }),
    );
  }

  return players;
}

export function resetKickoff(players, ball, court, attackingTeam = TEAM.HOME, formation = loadFormation()) {
  nextId = 1;
  const fresh = spawnTeams(court, formation);

  ball.x = court.midX;
  ball.y = court.midY;
  ball.vx = 0;
  ball.vy = 0;
  ball.inFlight = false;
  ball.isShot = false;
  ball.flightAge = 0;
  ball.lastPasserId = null;
  ball.passTargetId = null;
  ball.lastTeam = null;

  for (const p of fresh) {
    p.controlled = false;
    p.hasBall = false;
  }

  // Place attacking team slightly more forward using attack slots for backs
  if (attackingTeam === TEAM.HOME) {
    for (const p of fresh) {
      if (p.team !== TEAM.HOME || p.isGK) continue;
      const slot = getSlot(formation, p.role, 'attack');
      // Blend toward attack for kickoff shape on own half
      const atk = toWorld(slot, TEAM.HOME, court);
      const def = toWorld(getSlot(formation, p.role, 'defense'), TEAM.HOME, court);
      p.x = def.x * 0.55 + atk.x * 0.45;
      p.y = def.y * 0.55 + atk.y * 0.45;
    }
  }

  const receiver =
    fresh.find((p) => p.team === attackingTeam && p.role === 'backC') ||
    fresh.find((p) => p.team === attackingTeam && p.role.startsWith('back')) ||
    fresh.find((p) => p.team === attackingTeam && !p.isGK);

  if (receiver) {
    ball.ownerId = receiver.id;
    ball.lastTeam = receiver.team;
    receiver.hasBall = true;
    if (attackingTeam === TEAM.HOME) receiver.controlled = true;
    else {
      const homeCtrl =
        fresh.find((p) => p.team === TEAM.HOME && p.role === 'backC') ||
        fresh.find((p) => p.team === TEAM.HOME && !p.isGK);
      if (homeCtrl) homeCtrl.controlled = true;
    }
  } else {
    ball.ownerId = null;
    ball.lastTeam = null;
    const homeCtrl = fresh.find((p) => p.team === TEAM.HOME && !p.isGK);
    if (homeCtrl) homeCtrl.controlled = true;
  }

  if (!fresh.some((p) => p.controlled)) {
    const any = fresh.find((p) => p.team === TEAM.HOME && !p.isGK);
    if (any) any.controlled = true;
  }

  players.length = 0;
  players.push(...fresh);
  return fresh.find((p) => p.controlled);
}
