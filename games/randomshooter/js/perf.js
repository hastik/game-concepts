window.RS = window.RS || {};
RS.perf = RS.perf || {};

(function () {
  function ensurePerf() {
    if (!RS.state.perf) {
      RS.state.perf = {
        blurMul: RS.PERF_DEFAULTS.blurMul,
        aiRetargetMs: RS.PERF_DEFAULTS.aiRetargetMs,
        particleCap: RS.PERF_DEFAULTS.particleCap,
        laserChainCache: RS.PERF_DEFAULTS.laserChainCache,
        _aiAccMs: 0,
        _aiDue: true,
      };
    }
    return RS.state.perf;
  }

  /**
   * Apply scaled shadowBlur. Base values stay in call sites; mul=0 disables blur.
   */
  RS.perf.applyBlur = function applyBlur(ctx, base) {
    const p = ensurePerf();
    const m = p.blurMul;
    if (m <= 0 || base <= 0) {
      ctx.shadowBlur = 0;
      return;
    }
    ctx.shadowBlur = base * m;
  };

  /**
   * Tick AI retarget timer. Call once per update frame.
   * When aiRetargetMs === 0, every frame is a retarget frame.
   */
  RS.perf.tickRetarget = function tickRetarget(dt) {
    const p = ensurePerf();
    const ms = p.aiRetargetMs;
    if (ms <= 0) {
      p._aiDue = true;
      return true;
    }
    p._aiAccMs += dt * 1000;
    if (p._aiAccMs >= ms) {
      p._aiAccMs = 0;
      p._aiDue = true;
      return true;
    }
    p._aiDue = false;
    return false;
  };

  /** Whether this frame should recompute heal/gainer/turret targets. */
  RS.perf.shouldRetarget = function shouldRetarget() {
    return ensurePerf()._aiDue;
  };

  RS.perf.setBlurMul = function setBlurMul(v) {
    const p = ensurePerf();
    p.blurMul = Math.max(0, Math.min(1, Math.round(v * 100) / 100));
    return p.blurMul;
  };

  RS.perf.setAiRetargetMs = function setAiRetargetMs(v) {
    const p = ensurePerf();
    p.aiRetargetMs = Math.max(0, Math.min(250, Math.round(v)));
    // Prime so the next tickRetarget() fires immediately.
    p._aiAccMs = p.aiRetargetMs;
    p._aiDue = true;
    return p.aiRetargetMs;
  };

  RS.perf.formatBlur = function formatBlur(v) {
    if (v <= 0) return "0";
    if (v >= 1) return "1.00";
    return v.toFixed(2);
  };
})();
