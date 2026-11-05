/** Tunable arcade feel constants
 * Court scale: official 40m × 20m → 960 × 480 px (1 m = 24 px)
 */

export const CONFIG = {
  COURT_W: 960,
  COURT_H: 480,
  METER: 24,

  // Official markings (metres → set from METER in court.js)
  GOAL_WIDTH_M: 3,
  GOAL_DEPTH_PX: 14,
  LINE_6_M: 6,
  LINE_7_M: 7,
  LINE_9_M: 9,
  LINE_4_M: 4,
  PENALTY_LINE_M: 1,
  GK_LINE_M: 0.15,

  // Players
  PLAYER_RADIUS: 10,
  GK_RADIUS: 11,
  BASE_SPEED: 145,
  SPRINT_MULT: 1.55,
  STAMINA_MAX: 100,
  STAMINA_DRAIN: 28,
  STAMINA_REGEN: 18,
  STAMINA_MIN_SPRINT: 8,

  // Ball
  BALL_RADIUS: 5,
  BALL_HOLD_OFFSET: 14,
  BALL_FRICTION: 0.988,
  PASS_SPEED_MIN: 220,
  PASS_SPEED_MAX: 420,
  SHOT_SPEED_MIN: 280,
  SHOT_SPEED_MAX: 520,
  SHOT_CURVE: 95,
  INTERCEPT_RADIUS: 14,
  PICKUP_RADIUS: 16,
  TACKLE_RADIUS: 18,
  // Flight arc: peak height grows with pass distance; ball draw scale follows height
  ARC_HEIGHT_PER_PX: 0.09,
  ARC_HEIGHT_BASE: 4,
  ARC_HEIGHT_MAX: 56,
  BALL_SCALE_PER_HEIGHT: 0.045,
  // Dribble bounce (held ball)
  DRIBBLE_STILL_DELAY: 1.0,
  DRIBBLE_MOVE_SPEED: 12,
  DRIBBLE_SCALE_MIN: 0.55,
  DRIBBLE_BOUNCE_HZ_MOVE: 7,
  DRIBBLE_BOUNCE_HZ_STILL: 5,

  // Pass targeting
  PASS_CONE_DEG: 70,
  PASS_MAX_DIST: 380,
  // S hold: offer circle — r(t) = r0 + (v0/α)(e^(αt)−1), capped at MAX
  PASS_RANGE_MIN: 30,
  PASS_RANGE_GROW: 160,
  PASS_RANGE_EXPO: 1.2,
  PASS_RANGE_MAX: 380,

  // Throw accuracy cone (sector % of full circle; ball lands randomly inside)
  THROW_SPREAD_PCT: 6,
  THROW_CONE_ALPHA: 0.28,
  THROW_CONE_FADE_DIST: 140,

  // Player vision cones (full aperture in degrees; visual only for now)
  VISION_DIRECT_DEG: 14,
  VISION_PERIPH_DEG: 40,
  VISION_CONE_ALPHA: 0.22,
  VISION_CONE_DIST: 200,

  // Charge
  CHARGE_TIME: 0.55,

  // Match
  MATCH_SECONDS: 180,
  KICKOFF_DELAY: 0.8,

  // AI
  AI_REACTION: 0.12,
  AI_SHOT_RANGE: 160,
  AI_PASS_RANGE: 220,
};

export const TEAM = {
  HOME: 0,
  AWAY: 1,
};

export const COLORS = {
  court: '#1a6b42',
  courtDark: '#165c39',
  courtLine: 'rgba(255,255,255,0.9)',
  crease: 'rgba(255,255,255,0.10)',
  creaseAlert: 'rgba(255,255,255,0.38)',
  goalFill: 'rgba(255,255,255,0.18)',
  goalStroke: '#ffffff',
  home: '#3aa0ff',
  away: '#ff5a4a',
  gkHome: '#1e6fd4',
  gkAway: '#d43a2c',
  ball: '#f5f0e6',
  ballStroke: '#2a2418',
  controlled: '#ffe566',
  passSafe: '#5dff8a',
  passMid: '#ffe066',
  passRisk: '#ff5a4a',
};
