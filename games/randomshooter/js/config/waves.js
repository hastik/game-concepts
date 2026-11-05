window.RS = window.RS || {};
RS.config = RS.config || {};

/**
 * Wave spawn groups — matches startWave() in randomshooter9 exactly.
 * delay between normals: max(180, 420 - wave*12); then healers @240, tanks @280, gainers @260, motherships @400.
 */
RS.WAVE_RULES = {
  normalCount: (wave) => 6 + wave * 2,
  normalExtraHpEvery: 4, // i % 4 === 0 → extraHp 2
  normalSpacing: (wave) => Math.max(180, 420 - wave * 12),
  groups: [
    { kind: "normal", count: (w) => 6 + w * 2, spacing: (w) => Math.max(180, 420 - w * 12), extraHp: (i) => (i % 4 === 0 ? 2 : 0) },
    { kind: "healer", count: (w) => RS.ENEMY_DEFS.healer.countForWave(w), spacing: () => 240 },
    { kind: "tank", count: (w) => RS.ENEMY_DEFS.tank.countForWave(w), spacing: () => 280 },
    { kind: "guidedTank", count: (w) => RS.ENEMY_DEFS.guidedTank.countForWave(w), spacing: () => 300 },
    { kind: "gainer", count: (w) => RS.ENEMY_DEFS.gainer.countForWave(w), spacing: () => 260 },
    { kind: "mothership", count: (w) => RS.ENEMY_DEFS.mothership.countForWave(w), spacing: () => 400 },
    { kind: "rammer", count: (w) => RS.ENEMY_DEFS.rammer.countForWave(w), spacing: () => 220 },
    { kind: "sniper", count: (w) => RS.ENEMY_DEFS.sniper.countForWave(w), spacing: () => 300 },
    { kind: "splitter", count: (w) => RS.ENEMY_DEFS.splitter.countForWave(w), spacing: () => 340 },
    { kind: "cloaker", count: (w) => RS.ENEMY_DEFS.cloaker.countForWave(w), spacing: () => 360 },
    { kind: "guidedCloaker", count: (w) => RS.ENEMY_DEFS.guidedCloaker.countForWave(w), spacing: () => 380 },
  ],
};

RS.config.waves = RS.WAVE_RULES;
