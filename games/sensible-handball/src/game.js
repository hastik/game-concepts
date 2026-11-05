import { CONFIG, TEAM } from './config.js';
import { createCourt } from './court.js';
import {
  createBall,
  spawnTeams,
  spawnSolo,
  spawnDouble,
  spawnTriple,
  spawnSingleTeam,
  resetKickoff,
} from './entities.js';
import { createInput } from './input.js';
import {
  movePlayer,
  separatePlayers,
  attachBallToOwner,
  updateDribble,
  passBall,
  shootBall,
  updateBallFlight,
  tryPickupAndIntercept,
  tryTackle,
  bounceBallInBounds,
  updatePassReceiver,
} from './physics.js';
import { updateAI } from './ai.js';
import { renderFrame } from './render.js';
import { loadFormation } from './formations.js';
import { passOfferRadius } from './pass.js';

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function applyCanvasOrientation(canvas, orientation) {
  if (orientation === 'portrait') {
    canvas.width = CONFIG.COURT_H;
    canvas.height = CONFIG.COURT_W;
  } else {
    canvas.width = CONFIG.COURT_W;
    canvas.height = CONFIG.COURT_H;
  }
}

function worldMoveFromInput(input, orientation) {
  const move = input.moveVector();
  if (orientation !== 'portrait') return move;
  return { x: -move.y, y: move.x };
}

function worldCurveFromInput(input, orientation) {
  const left = input.isDown('left');
  const right = input.isDown('right');
  return (left ? -1 : 0) + (right ? 1 : 0);
}

export function createGame(canvas) {
  const ctx = canvas.getContext('2d');
  const court = createCourt();
  const input = createInput();
  const wrap = document.getElementById('wrap');

  let formation = loadFormation();
  const players = spawnTeams(court, formation);
  const ball = createBall(court.midX, court.midY);

  const starter =
    players.find((p) => p.team === TEAM.HOME && p.role === 'backC') ||
    players.find((p) => p.team === TEAM.HOME && !p.isGK);
  for (const p of players) {
    p.controlled = starter ? p.id === starter.id : false;
    p.hasBall = false;
  }
  if (starter) {
    ball.ownerId = starter.id;
    ball.lastTeam = starter.team;
    starter.hasBall = true;
    starter.controlled = true;
    attachBallToOwner(ball, players);
  }

  const hud = {
    scoreHome: document.getElementById('score-home'),
    scoreAway: document.getElementById('score-away'),
    clock: document.getElementById('clock'),
    overlay: document.getElementById('overlay'),
    overlayMsg: document.getElementById('overlay-msg'),
  };

  const state = {
    court,
    players,
    ball,
    scoreHome: 0,
    scoreAway: 0,
    timeLeft: CONFIG.MATCH_SECONDS,
    running: false,
    matchStarted: false,
    kickoffTimer: 0,
    passNearCharge: 0,
    passFarCharge: 0,
    passNearHoldTime: 0,
    passNearRange: 0,
    shotCharge: 0,
    passNearWasDown: false,
    passFarWasDown: false,
    shootWasDown: false,
    /** Loose-ball S cycle: -1 = next S picks nearest to ball */
    looseSwitchIdx: -1,
    orientation: 'portrait',
    screen: 'settings',
    mode: 'match', // 'match' | 'solo' | 'double' | 'triple' | 'single'
  };

  function isTestMode() {
    return (
      state.mode === 'solo' ||
      state.mode === 'double' ||
      state.mode === 'triple' ||
      state.mode === 'single'
    );
  }

  function canSwitchInMode() {
    return (
      state.mode === 'match' ||
      state.mode === 'double' ||
      state.mode === 'triple' ||
      state.mode === 'single'
    );
  }

  function setOrientation(orientation) {
    if (orientation !== 'landscape' && orientation !== 'portrait') return;
    state.orientation = orientation;
    applyCanvasOrientation(canvas, orientation);
    wrap.classList.toggle('orient-landscape', orientation === 'landscape');
    wrap.classList.toggle('orient-portrait', orientation === 'portrait');
    document.querySelectorAll('.orient-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.orient === orientation);
    });
  }

  document.querySelectorAll('.orient-btn').forEach((btn) => {
    btn.addEventListener('click', () => setOrientation(btn.dataset.orient));
  });
  setOrientation('portrait');

  function updateHud() {
    hud.scoreHome.textContent = String(state.scoreHome);
    hud.scoreAway.textContent = String(state.scoreAway);
    hud.clock.textContent = formatTime(state.timeLeft);
    const title = document.getElementById('title');
    if (title) {
      const titles = {
        solo: 'SOLO',
        double: 'DOUBLE',
        triple: 'TRIPLE',
        single: 'SINGLE TEAM',
        match: 'HAND•BALL',
      };
      title.textContent = titles[state.mode] || 'HAND•BALL';
    }
    document.getElementById('help-match')?.classList.toggle('hidden', isTestMode());
    document.getElementById('help-solo')?.classList.toggle('hidden', !isTestMode());
    wrap.classList.toggle('mode-solo', isTestMode());
    wrap.classList.toggle('mode-match', state.mode === 'match');
  }

  function showOverlay(msg) {
    hud.overlay.classList.remove('hidden');
    hud.overlayMsg.textContent = msg;
  }

  function hideOverlay() {
    hud.overlay.classList.add('hidden');
  }

  function switchPlayer() {
    const homeField = state.players.filter((p) => p.team === TEAM.HOME && !p.isGK);
    if (!homeField.length) return;

    const owner =
      state.ball.ownerId != null
        ? state.players.find((p) => p.id === state.ball.ownerId)
        : null;

    // Someone has the ball → control them; reset loose-ball cycle
    if (owner && owner.team === TEAM.HOME) {
      state.looseSwitchIdx = -1;
      for (const p of state.players) p.controlled = p.id === owner.id;
      return;
    }

    // No owner: S cycles nearest → further → … → nearest
    homeField.sort(
      (a, b) =>
        Math.hypot(a.x - state.ball.x, a.y - state.ball.y) -
        Math.hypot(b.x - state.ball.x, b.y - state.ball.y),
    );
    state.looseSwitchIdx = (state.looseSwitchIdx + 1) % homeField.length;
    const next = homeField[state.looseSwitchIdx];
    for (const p of state.players) p.controlled = p.id === next.id;
  }

  function restartMatch() {
    state.mode = 'match';
    formation = loadFormation();
    state.scoreHome = 0;
    state.scoreAway = 0;
    state.timeLeft = CONFIG.MATCH_SECONDS;
    state.running = true;
    state.matchStarted = true;
    state.kickoffTimer = CONFIG.KICKOFF_DELAY;
    state.passNearCharge = 0;
    state.passFarCharge = 0;
    state.passNearHoldTime = 0;
    state.passNearRange = 0;
    state.shotCharge = 0;
    state.passNearWasDown = false;
    state.passFarWasDown = false;
    state.shootWasDown = false;
    resetKickoff(state.players, state.ball, court, TEAM.HOME, formation);
    hideOverlay();
    updateHud();
  }

  function startMatch() {
    restartMatch();
  }

  function spawnForTest(mode) {
    if (mode === 'single') {
      formation = loadFormation();
      return spawnSingleTeam(court, formation);
    }
    if (mode === 'triple') return spawnTriple(court);
    if (mode === 'double') return spawnDouble(court);
    return spawnSolo(court);
  }

  function startTest(mode) {
    state.mode = mode;
    state.scoreHome = 0;
    state.scoreAway = 0;
    state.timeLeft = CONFIG.MATCH_SECONDS;
    state.running = true;
    state.matchStarted = true;
    state.kickoffTimer = 0;
    state.passNearCharge = 0;
    state.passFarCharge = 0;
    state.passNearHoldTime = 0;
    state.passNearRange = 0;
    state.shotCharge = 0;
    state.passNearWasDown = false;
    state.passFarWasDown = false;
    state.shootWasDown = false;

    const spawned = spawnForTest(mode);
    state.players.length = 0;
    state.players.push(...spawned);

    const withBall = spawned.find((p) => p.hasBall) || spawned[0];
    state.ball.x = withBall.x;
    state.ball.y = withBall.y;
    state.ball.vx = 0;
    state.ball.vy = 0;
    state.ball.inFlight = false;
    state.ball.isShot = false;
    state.ball.flightAge = 0;
    state.ball.lastPasserId = null;
    state.ball.passTargetId = null;
    state.ball.height = 0;
    state.ball.ownerId = withBall.id;
    state.ball.lastTeam = TEAM.HOME;
    withBall.hasBall = true;
    withBall.controlled = true;
    attachBallToOwner(state.ball, state.players);

    hideOverlay();
    updateHud();
  }

  function startSolo() {
    startTest('solo');
  }

  function startDouble() {
    startTest('double');
  }

  function startTriple() {
    startTest('triple');
  }

  function startSingle() {
    startTest('single');
  }

  function resetTest() {
    startTest(state.mode);
  }

  function onGoal(scoringTeam) {
    if (isTestMode()) {
      // Reset test layout; controlled player gets the ball at midfield
      startTest(state.mode);
      return;
    }
    if (scoringTeam === TEAM.HOME) state.scoreHome += 1;
    else state.scoreAway += 1;
    updateHud();
    state.kickoffTimer = CONFIG.KICKOFF_DELAY;
    const restartAttack = scoringTeam === TEAM.HOME ? TEAM.AWAY : TEAM.HOME;
    resetKickoff(state.players, state.ball, court, restartAttack, formation);
  }

  function handleHuman(dt) {
    const controlled = state.players.find((p) => p.controlled);
    if (!controlled) return;

    const move = worldMoveFromInput(input, state.orientation);
    const sprint = input.isDown('shift');
    movePlayer(controlled, move.x, move.y, sprint, dt, court);

    const hasBall = state.ball.ownerId === controlled.id;
    controlled.hasBall = hasBall;

    // S = growing offer circle; pass to nearest teammate inside it (facing cone)
    const passNearDown = input.isDown('pass');
    if (passNearDown) {
      if (hasBall) {
        // Radius starts at PASS_RANGE_MIN on first frame, then grows
        state.passNearRange = passOfferRadius(state.passNearHoldTime);
        state.passNearHoldTime += dt;
        state.passNearCharge = Math.min(
          1,
          state.passNearCharge + dt / CONFIG.CHARGE_TIME,
        );
        state.passNearWasDown = true;
      } else if (!state.passNearWasDown) {
        if (canSwitchInMode()) switchPlayer();
        state.passNearWasDown = true;
      }
    } else if (state.passNearWasDown) {
      if (hasBall) {
        passBall(
          state.ball,
          controlled,
          state.players,
          Math.max(0.2, state.passNearCharge),
          'near',
          { maxDist: state.passNearRange || CONFIG.PASS_RANGE_MIN },
        );
      }
      state.passNearCharge = 0;
      state.passNearHoldTime = 0;
      state.passNearRange = 0;
      state.passNearWasDown = false;
    }

    // A = pass to second (further) teammate in cone
    const passFarDown = input.isDown('passFast');
    if (passFarDown) {
      if (hasBall) {
        state.passFarCharge = Math.min(
          1,
          state.passFarCharge + dt / CONFIG.CHARGE_TIME,
        );
        state.passFarWasDown = true;
      } else {
        state.passFarWasDown = true;
      }
    } else if (state.passFarWasDown) {
      if (hasBall) {
        passBall(
          state.ball,
          controlled,
          state.players,
          Math.max(0.2, state.passFarCharge),
          'far',
        );
      }
      state.passFarCharge = 0;
      state.passFarWasDown = false;
    }

    if (input.isDown('shoot')) {
      if (hasBall) {
        state.shotCharge = Math.min(1, state.shotCharge + dt / CONFIG.CHARGE_TIME);
        state.shootWasDown = true;
      } else if (!state.shootWasDown) {
        if (state.mode === 'match') tryTackle(controlled, state.ball, state.players);
        state.shootWasDown = true;
      }
    } else if (state.shootWasDown) {
      if (hasBall) {
        const goal = court.awayGoal;
        const aimY = goal.y + goal.h / 2 + controlled.facingY * 30;
        shootBall(state.ball, controlled, Math.max(0.25, state.shotCharge), aimY, court);
      }
      state.shotCharge = 0;
      state.shootWasDown = false;
    }
  }

  function setScreen(screen) {
    state.screen = screen;
    const playEl = document.getElementById('play-screen');
    const settingsEl = document.getElementById('settings-screen');
    const testEl = document.getElementById('test-screen');
    const navPlay = document.getElementById('nav-play');
    const navSettings = document.getElementById('nav-settings');
    const navTest = document.getElementById('nav-test');

    const isPlay = screen === 'play';
    const isSettings = screen === 'settings';
    const isTest = screen === 'test';

    playEl?.classList.toggle('hidden', !isPlay);
    settingsEl?.classList.toggle('hidden', !isSettings);
    testEl?.classList.toggle('hidden', !isTest);
    navPlay?.classList.toggle('active', isPlay && state.mode === 'match');
    navTest?.classList.toggle('active', isTest || (isPlay && isTestMode()));
    navSettings?.classList.toggle('active', isSettings);
    wrap.classList.toggle('screen-play', isPlay);
    wrap.classList.toggle('screen-settings', isSettings);
    wrap.classList.toggle('screen-test', isTest);

    if (isPlay) {
      applyCanvasOrientation(canvas, state.orientation);
      if (state.mode === 'match') {
        formation = loadFormation();
        if (!state.matchStarted || !state.running) {
          startMatch();
        }
      }
    }
  }

  function setFormation(next) {
    formation = next;
  }

  function update(dt) {
    if (state.screen !== 'play') {
      input.endFrame();
      return;
    }

    if (input.wasPressed('r')) {
      if (isTestMode()) resetTest();
      else restartMatch();
      input.endFrame();
      return;
    }

    if (!state.running) {
      input.endFrame();
      return;
    }

    if (state.kickoffTimer > 0) {
      state.kickoffTimer -= dt;
      attachBallToOwner(state.ball, state.players);
      updateDribble(state.ball, state.players, dt);
      input.endFrame();
      return;
    }

    if (state.mode === 'match') {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        state.running = false;
        const msg =
          state.scoreHome === state.scoreAway
            ? 'DRAW'
            : state.scoreHome > state.scoreAway
              ? 'HOME WINS'
              : 'AWAY WINS';
        showOverlay(msg);
        updateHud();
        input.endFrame();
        return;
      }
    }

    handleHuman(dt);
    // Pass target always runs to the ball (tests + match)
    updatePassReceiver(state.players, state.ball, court, dt);
    if (state.mode === 'match') {
      updateAI(state.players, state.ball, court, dt, TEAM.HOME, formation);
      separatePlayers(state.players);
    }
    for (const p of state.players) court.clampPlayer(p);

    // Auto-switch to field receiver only (not GK — AI distributes the ball out)
    if (state.ball.ownerId != null) {
      state.looseSwitchIdx = -1;
      if (canSwitchInMode()) {
        const owner = state.players.find((p) => p.id === state.ball.ownerId);
        if (owner && owner.team === TEAM.HOME && !owner.controlled && !owner.isGK) {
          for (const p of state.players) p.controlled = p.id === owner.id;
        }
      }
    }

    if (state.ball.ownerId != null) {
      attachBallToOwner(state.ball, state.players);
      updateDribble(state.ball, state.players, dt);
    } else {
      state.ball.dribbleScale = 1;
      state.ball.dribblePhase = 0;
      const curve = worldCurveFromInput(input, state.orientation);
      updateBallFlight(state.ball, dt, state.ball.isShot ? curve : 0);
      bounceBallInBounds(state.ball, court);
      tryPickupAndIntercept(state.ball, state.players);
    }

    const scored = court.checkGoal(state.ball);
    if (scored != null) {
      onGoal(scored);
    }

    if (state.mode === 'match') updateHud();
    input.endFrame();
  }

  function render() {
    if (state.screen !== 'play') return;
    renderFrame(ctx, state);
  }

  updateHud();
  hideOverlay();
  setScreen('settings');

  return {
    update,
    render,
    setOrientation,
    setScreen,
    setFormation,
    startMatch,
    startSolo,
    startDouble,
    startTriple,
    startSingle,
    destroy() {
      input.destroy();
    },
  };
}
