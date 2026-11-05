import { CONFIG } from './config.js';

function pointInGoalArea(x, y, side, midY, goalHalf, r6, courtW) {
  const postTop = midY - goalHalf;
  const postBot = midY + goalHalf;

  if (side === 'home') {
    if (x < 0) return false;
    if (y >= postTop && y <= postBot) return x <= r6;
    if (y < postTop) return Math.hypot(x - 0, y - postTop) <= r6;
    return Math.hypot(x - 0, y - postBot) <= r6;
  }

  // away
  if (x > courtW) return false;
  if (y >= postTop && y <= postBot) return x >= courtW - r6;
  if (y < postTop) return Math.hypot(x - courtW, y - postTop) <= r6;
  return Math.hypot(x - courtW, y - postBot) <= r6;
}

export function createCourt() {
  const w = CONFIG.COURT_W;
  const h = CONFIG.COURT_H;
  const midX = w / 2;
  const midY = h / 2;
  const m = CONFIG.METER;

  const goalW = CONFIG.GOAL_WIDTH_M * m;
  const goalHalf = goalW / 2;
  const goalDepth = CONFIG.GOAL_DEPTH_PX;
  const r6 = CONFIG.LINE_6_M * m;
  const r7 = CONFIG.LINE_7_M * m;
  const r9 = CONFIG.LINE_9_M * m;
  const r4 = CONFIG.LINE_4_M * m;
  const penaltyLen = CONFIG.PENALTY_LINE_M * m;
  const gkLineLen = Math.max(6, CONFIG.GK_LINE_M * m);

  const homeGoal = {
    x: -goalDepth + 2,
    y: midY - goalHalf,
    w: goalDepth,
    h: goalW,
    team: 0,
  };

  const awayGoal = {
    x: w - 2,
    y: midY - goalHalf,
    w: goalDepth,
    h: goalW,
    team: 1,
  };

  // Approximate crease refs for AI / GK (D-area)
  const homeCrease = {
    cx: r6 * 0.45,
    cy: midY,
    r: r6,
    postTop: midY - goalHalf,
    postBot: midY + goalHalf,
    goalLineX: 0,
    team: 0,
  };
  const awayCrease = {
    cx: w - r6 * 0.45,
    cy: midY,
    r: r6,
    postTop: midY - goalHalf,
    postBot: midY + goalHalf,
    goalLineX: w,
    team: 1,
  };

  const marks = {
    goalW,
    goalHalf,
    goalDepth,
    r6,
    r7,
    r9,
    r4,
    penaltyLen,
    gkLineLen,
    postTop: midY - goalHalf,
    postBot: midY + goalHalf,
  };

  return {
    w,
    h,
    midX,
    midY,
    homeGoal,
    awayGoal,
    homeCrease,
    awayCrease,
    marks,

    inCrease(x, y, team) {
      return pointInGoalArea(x, y, team === 0 ? 'home' : 'away', midY, goalHalf, r6, w);
    },

    inForbiddenCrease(x, y, team) {
      return pointInGoalArea(x, y, team === 0 ? 'away' : 'home', midY, goalHalf, r6, w);
    },

    /** Which creases currently have a field player with the ball inside (not GK). */
    creaseIntrusions(players) {
      let home = false;
      let away = false;
      for (const p of players) {
        if (p.isGK || !p.hasBall) continue;
        if (pointInGoalArea(p.x, p.y, 'home', midY, goalHalf, r6, w)) home = true;
        if (pointInGoalArea(p.x, p.y, 'away', midY, goalHalf, r6, w)) away = true;
      }
      return { home, away };
    },

    clampPlayer(player) {
      const r = player.radius;
      let { x, y } = player;
      x = Math.max(r + 2, Math.min(w - r - 2, x));
      y = Math.max(r + 2, Math.min(h - r - 2, y));
      player.x = x;
      player.y = y;

      if (player.isGK) {
        const ownSide = player.team === 0 ? 'home' : 'away';
        const own = player.team === 0 ? homeCrease : awayCrease;
        // Keep GK inside own goal area (with small margin outside ok)
        if (!pointInGoalArea(player.x, player.y, ownSide, midY, goalHalf, r6 * 1.05, w)) {
          const dx = own.cx - player.x;
          const dy = own.cy - player.y;
          const dist = Math.hypot(dx, dy) || 1;
          player.x += (dx / dist) * 4;
          player.y += (dy / dist) * 4;
        }
        if (player.team === 0) player.x = Math.min(player.x, r6 * 0.95);
        else player.x = Math.max(player.x, w - r6 * 0.95);
      }
      // Field players may enter the crease (visual foul warning blinks in render)

      player.x = Math.max(r + 2, Math.min(w - r - 2, player.x));
      player.y = Math.max(r + 2, Math.min(h - r - 2, player.y));
    },

    ballOutOfBounds(ball) {
      const pad = CONFIG.BALL_RADIUS;
      return ball.x < -pad || ball.x > w + pad || ball.y < -pad || ball.y > h + pad;
    },

    checkGoal(ball) {
      if (
        ball.x <= 2 &&
        ball.y >= homeGoal.y &&
        ball.y <= homeGoal.y + homeGoal.h &&
        ball.vx < 0
      ) {
        return 1;
      }
      if (
        ball.x >= w - 2 &&
        ball.y >= awayGoal.y &&
        ball.y <= awayGoal.y + awayGoal.h &&
        ball.vx > 0
      ) {
        return 0;
      }
      return null;
    },
  };
}
