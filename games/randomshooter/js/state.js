window.RS = window.RS || {};

(function () {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const el = {
    score: document.getElementById("score"),
    credits: document.getElementById("credits"),
    waveNum: document.getElementById("waveNum"),
    banner: document.getElementById("wave-banner"),
    overlay: document.getElementById("overlay"),
    startBtn: document.getElementById("startBtn"),
    shop: document.getElementById("shop"),
    shopBackdrop: document.getElementById("shop-backdrop"),
    shopClose: document.getElementById("shop-close"),
    upgradesBtn: document.getElementById("upgrades-btn"),
    waveUpgradesToggle: document.getElementById("waveUpgradesToggle"),
    waveUpgradesLabel: document.getElementById("waveUpgradesLabel"),
    radar: document.getElementById("radar"),
    msgPopup: document.getElementById("msg-popup"),
    msgPopupText: document.getElementById("msg-popup-text"),
    msgPopupOk: document.getElementById("msg-popup-ok"),
    btnSave: document.getElementById("btn-save"),
    btnLoad: document.getElementById("btn-load"),
    gravWrap: document.getElementById("grav-bar-wrap"),
    gravFill: document.getElementById("grav-bar-fill"),
    laserWrap: document.getElementById("laser-bar-wrap"),
    laserFill: document.getElementById("laser-bar-fill"),
    zoomValue: document.getElementById("debugZoomValue"),
  };
  const radarCtx = el.radar.getContext("2d");
  RS.dom = { canvas, ctx, el, radarCtx };

RS.state = {
  running: false,
  /** Viewport size in CSS pixels (window / canvas). */
  w: 0,
  h: 0,
  dpr: 1,
  mouse: { x: 0, y: 0 },
  aim: { x: 0, y: 0 },
  /** Playfield size in world units (WU). Origin top-left. */
  arenaW: 0,
  arenaH: 0,
  /** World top-left of what the viewport shows. */
  cam: { x: 0, y: 0 },
  /** Screen px per WU; normally = fitZoom so the whole arena is visible. */
  zoom: 1,
  fitZoom: 3,
  /** When true, debug/CTRL zoom overrides auto-fit until next wave/resize. */
  zoomManual: false,
  shooting: false,
  gravityHold: false,
  gravityOn: false,
  /** True when aim touches defense target — gravity pushes instead of pulls. */
  gravityRepel: false,
  laserHold: false,
  laserOn: false,
  /** "beam" = chain jumps (default); "laser" = piercing ray to arena edge. */
  laserMode: "beam",
  gravFuel: 1,
  laserFuel: 1,
  cooldown: 0,
  score: 0,
  credits: 0,
  kills: 0,
  wave: 0,
  waveGen: 0,
  betweenWaves: 0,
  targets: [],
  structures: [],
  structureBeams: [],
  particles: [],
  creditDrops: [],
  /** Collected typed loot credits (no shop use yet). */
  loot: { normal: 0, healer: 0, tank: 0, guidedTank: 0, gainer: 0, mothership: 0, rammer: 0, sniper: 0, splitter: 0, cloaker: 0, guidedCloaker: 0 },
  /** Projectiles fired by sniper enemies at the defense Target. */
  enemyProjectiles: [],
  /** Structure key while placing ghost on map, or null. */
  placingStructure: null,
  /** True while placing a defense target (Tools → Add target). */
  placingDefenseTarget: false,
  /** Objective marker enemies can bump into; null when none. */
  defenseTarget: null,
  /** True while placing an amplifier pad (Tools → Add Amplifier). */
  placingAmplifier: false,
  /** Buff pad; while aim is over it, grav/laser are amplified. */
  amplifier: null,
  /** True this frame while aim overlaps the amplifier. */
  ampActive: false,
  /** After defense target dies, shop continue restarts the same wave. */
  waveRetryPending: false,
  skipWaveStartOnShopClose: false,
  reopenStructuresAfterPlace: false,
  flashes: [],
  laserBeams: [],
  /** Defensive intercept rays (visual + targeting). */
  autoLaserRays: [],
  healBeams: [],
  shieldBeams: [],
  shockwaves: [],
  laserWaves: [],
  stars: [],
  upgrades: {
    aimSpeed: 1,
    power: 1, reload: 1, width: 1, pierce: 0, headshotChance: 0,
    gravRadius: 1, gravPull: 1, gravRegen: 1,
    laserPower: 1, laserTargets: 1, laserJumps: 0,
    freezeTime: 1,
    autoLaserBeams: 0, autoLaserPower: 1, autoLaserRadius: 1,
  },
  bannerT: 0,
  gravPulse: 0,
  laserPulse: 0,
  time: 0,
  waveCooldown: 0,
  laserWaveCooldown: 0,
  bothButtonsPrev: false,
  gravLaserPrev: false,
  targetSizePct: 100,
  bulletTimeEffect: false,
  bulletTimeLeft: 0,
  /** Sandbox: one of each enemy; no auto next wave. */
  debugLevel: false,
  /** Debug bar: reveal Cloakers + range rings. */
  debugReveal: false,
  /** After each wave, pause and open upgrades before next wave. */
  waveUpgrades: true,
  waveUpgradePending: false,
  /** Pull all floating loot to the crosshair after the last enemy dies. */
  lootVacuum: false,
  /** Seconds left before opening upgrades popup (after vacuum). */
  waveUpgradeDelay: 0,
  /** True once at least one enemy existed this wave (avoids clear-check during spawn delay). */
  waveHadTargets: false,
  /** Per-wave stats for Results tab. */
  waveStats: null,
  lastWaveResults: null,
  /** Tunable performance (see js/config/performance.js). */
  perf: {
    blurMul: (RS.PERF_DEFAULTS && RS.PERF_DEFAULTS.blurMul) || 1,
    aiRetargetMs: (RS.PERF_DEFAULTS && RS.PERF_DEFAULTS.aiRetargetMs) || 0,
    particleCap: (RS.PERF_DEFAULTS && RS.PERF_DEFAULTS.particleCap) || 180,
    laserChainCache: !(RS.PERF_DEFAULTS && RS.PERF_DEFAULTS.laserChainCache === false),
    _aiAccMs: 0,
    _aiDue: true,
  },
};
})();

