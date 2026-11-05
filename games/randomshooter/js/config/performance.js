window.RS = window.RS || {};
RS.config = RS.config || {};

/** Runtime-tunable performance defaults (debug bar can override). */
RS.PERF_DEFAULTS = {
  /** Multiplier for all canvas shadowBlur base values. 0 = off, 1 = current look. */
  blurMul: 1.0,
  /** Healer / gainer / turret retarget interval in ms. 0 = every frame. */
  aiRetargetMs: 0,
  /** Max live particles (pool hard cap). */
  particleCap: 180,
  /** Cache laser primary targets while aim/target count stable. */
  laserChainCache: true,
};

RS.config.performance = RS.PERF_DEFAULTS;
