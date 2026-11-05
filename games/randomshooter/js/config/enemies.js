window.RS = window.RS || {};
RS.config = RS.config || {};

RS.ENEMY_DEFS = {
  normal: {
    sizeMin: 28,
    sizeMax: 48,
    hp: (w, extraHp) => 2 + Math.floor(w * 0.85) + extraHp,
    speedMul: () => 1,
    kindScoreBonus: 0,
    burstColor: "#ff2bd6",
  },
  healer: {
    sizeMin: 30,
    sizeMax: 42,
    hp: (w, extraHp) => 3 + Math.floor(w * 0.7) + extraHp,
    speedMul: (w) => 1.15 + w * 0.09,
    countForWave: (wave) => Math.min(10, 1 + Math.floor((wave - 1) * 0.55)),
    healRate: (wave) => 1.1 + wave * 0.38,
    beamRange: (wave) => 160 + wave * 14,
    kindScoreBonus: 8,
    burstColor: "#3dff8a",
  },
  tank: {
    sizeMin: 52,
    sizeMax: 72,
    hp: (w, extraHp) => 6 + Math.floor(w * 1.4) + extraHp,
    speedMul: (w) => 0.45 + w * 0.015,
    countForWave: (wave) => Math.min(6, Math.floor(wave * 0.35)),
    kindScoreBonus: 12,
    burstColor: "#ff9a3d",
  },
  /** Tank stats + seeks Target; pointed hull (guided). */
  guidedTank: {
    sizeMin: 52,
    sizeMax: 72,
    hp: (w, extraHp) => 6 + Math.floor(w * 1.4) + extraHp,
    speedMul: (w) => 0.45 + w * 0.015,
    countForWave: (wave) => {
      if (wave < 4) return 0;
      return Math.min(4, Math.floor((wave - 3) * 0.3));
    },
    guided: true,
    chaseSpeed: (wave) => 70 + wave * 5,
    turnRate: 2.2,
    kindScoreBonus: 14,
    burstColor: "#ff9a3d",
  },
  gainer: {
    sizeMin: 32,
    sizeMax: 44,
    hp: (w, extraHp) => 4 + Math.floor(w * 0.9) + extraHp,
    speedMul: (w) => 0.95 + w * 0.03,
    countForWave: (wave) => Math.min(5, Math.floor((wave - 1) * 0.35)),
    shieldRange: (wave) => 140 + wave * 12,
    kindScoreBonus: 10,
    burstColor: "#4dc9ff",
  },
  mothership: {
    sizeWMin: 88,
    sizeWMax: 118,
    sizeHMin: 42,
    sizeHMax: 56,
    hp: (w, extraHp) => 14 + Math.floor(w * 2.2) + extraHp,
    speedMul: () => 0.35,
    countForWave: (wave) => {
      if (wave < 3) return 0;
      return Math.min(2, 1 + Math.floor((wave - 3) / 5));
    },
    spawnInterval: (wave) => Math.max(0.35, 1.0 - (wave - 1) * 0.045),
    kindScoreBonus: 25,
    burstColor: "#c9a0ff",
  },
  /** Guided kamikaze — only spawns while a defense Target exists. */
  rammer: {
    sizeMin: 24,
    sizeMax: 34,
    hp: (w, extraHp) => 2 + Math.floor(w * 0.55) + extraHp,
    speedMul: (w) => 1.35 + w * 0.04,
    countForWave: (wave) => {
      if (!RS.state.defenseTarget) return 0;
      if (wave < 1) return 0;
      return Math.min(7, 1 + Math.floor(wave * 0.45));
    },
    guided: true,
    chaseSpeed: (wave) => 160 + wave * 12,
    turnRate: 4.2,
    /** HP removed from Target on impact. */
    impactDamage: (wave) => 8 + Math.floor(wave * 0.6),
    kindScoreBonus: 6,
    burstColor: "#ff4d6d",
  },
  /** Random flight; fires at Target when in range. */
  sniper: {
    sizeMin: 26,
    sizeMax: 36,
    hp: (w, extraHp) => 3 + Math.floor(w * 0.75) + extraHp,
    speedMul: (w) => 0.85 + w * 0.02,
    countForWave: (wave) => {
      if (wave < 2) return 0;
      return Math.min(5, 1 + Math.floor((wave - 2) * 0.4));
    },
    fireRange: (wave) => 260 + wave * 16,
    fireCooldown: (wave) => Math.max(1.1, 2.4 - wave * 0.06),
    projectileSpeed: (wave) => 280 + wave * 10,
    projectileDamage: (wave) => 4 + Math.floor(wave * 0.45),
    kindScoreBonus: 9,
    burstColor: "#ffe566",
  },
  /** Splits into normals unless killed while shockwave-stunned. */
  splitter: {
    sizeMin: 34,
    sizeMax: 46,
    hp: (w, extraHp) => 4 + Math.floor(w * 1.05) + extraHp,
    speedMul: (w) => 0.9 + w * 0.025,
    countForWave: (wave) => {
      if (wave < 2) return 0;
      return Math.min(4, 1 + Math.floor((wave - 2) * 0.35));
    },
    splitCount: (wave) => Math.min(5, 2 + Math.floor(wave / 4)),
    kindScoreBonus: 11,
    burstColor: "#ff8c42",
  },
  /**
   * Cloaks nearby enemies: inside innerR = invisible;
   * between innerR–outerR = fade (99%→1% transparency).
   * Does not hide healer/gainer beams.
   */
  cloaker: {
    sizeMin: 30,
    sizeMax: 40,
    hp: (w, extraHp) => 5 + Math.floor(w * 1.1) + extraHp,
    speedMul: (w) => 0.7 + w * 0.02,
    countForWave: (wave) => {
      if (wave < 5) return 0;
      return Math.min(3, 1 + Math.floor((wave - 5) / 4));
    },
    cloakInner: (wave) => 100 + wave * 4,
    cloakOuter: (wave) => 200 + wave * 8,
    kindScoreBonus: 15,
    burstColor: "#b8c4ff",
  },
  /**
   * Cloaker + guided escort: sticks to strongest allies by priority
   * (Mothership → Gainer → GuidedTank → Sniper/Shooter → Rammer).
   */
  guidedCloaker: {
    sizeMin: 30,
    sizeMax: 40,
    hp: (w, extraHp) => 5 + Math.floor(w * 1.1) + extraHp,
    speedMul: (w) => 0.85 + w * 0.025,
    countForWave: (wave) => {
      if (wave < 6) return 0;
      return Math.min(2, 1 + Math.floor((wave - 6) / 5));
    },
    guided: true,
    chaseSpeed: (wave) => 95 + wave * 6,
    turnRate: 2.8,
    /** Prefer higher-priority kinds; among equals, closer wins. */
    escortPriority: ["mothership", "gainer", "guidedTank", "sniper", "rammer"],
    cloakInner: (wave) => 100 + wave * 4,
    cloakOuter: (wave) => 200 + wave * 8,
    kindScoreBonus: 17,
    burstColor: "#b8c4ff",
  },
};

RS.config.enemies = RS.ENEMY_DEFS;
