window.RS = window.RS || {};

RS.sfx = {
  unlocked: false,
  muted: false,
  lastHeal: 0,
  ready: false,
  gravWasOn: false,
  gravWasRepel: false,
  laserWasOn: false,
  nodes: null,
  /** Per-instrument last scheduled time — prevents Tone "Start time must be strictly greater" crashes. */
  _lastT: Object.create(null),

  async unlock() {
    if (typeof Tone === "undefined") return;
    try {
      await Tone.start();
      if (!this.ready) this._build();
      this.unlocked = true;
      if (!this.muted) {
        Tone.getDestination().volume.rampTo(-6, 0.05);
        this.startAmbient();
      }
    } catch (_) {}
  },

  /** Monotonic schedule time for a given instrument key. */
  _t(key, pad = 0.002) {
    const now = Tone.now();
    const prev = this._lastT[key] || 0;
    const next = Math.max(now, prev + pad);
    this._lastT[key] = next;
    return next;
  },

  /** Never throw into the game loop. */
  _safe(fn) {
    try { fn(); } catch (_) { /* ignore Tone schedule races */ }
  },

  _build() {
    if (this.nodes || typeof Tone === "undefined") return;

    const master = new Tone.Volume(-4).toDestination();
    const reverb = new Tone.Reverb({ decay: 3.2, preDelay: 0.02, wet: 0.42 });
    const chorus = new Tone.Chorus({ frequency: 0.35, delayTime: 3.2, depth: 0.45, wet: 0.25 }).start();
    const filter = new Tone.Filter({ frequency: 5200, type: "lowpass", Q: 0.6 });
    filter.chain(chorus, reverb, master);

    const ambient = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 6,
      oscillator: { type: "sine" },
      envelope: { attack: 2.5, decay: 1.2, sustain: 0.85, release: 4 },
      volume: -18,
    });
    const ambFilter = new Tone.Filter(480, "lowpass");
    const ambLfo = new Tone.LFO({ frequency: 0.06, min: 320, max: 720 }).start();
    ambLfo.connect(ambFilter.frequency);
    ambient.chain(ambFilter, filter);

    // Polyphonic so overlapping shots/kills don't collide on one voice
    const shoot = new Tone.PolySynth(Tone.FMSynth, {
      maxPolyphony: 8,
      harmonicity: 2.4,
      modulationIndex: 8,
      oscillator: { type: "sine" },
      modulation: { type: "sine" },
      envelope: { attack: 0.004, decay: 0.12, sustain: 0.05, release: 0.18 },
      modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.15 },
      volume: -10,
    }).connect(filter);

    const ui = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 8,
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.1, release: 0.25 },
      volume: -12,
    }).connect(filter);

    const grav = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.35, decay: 0.2, sustain: 0.9, release: 0.6 },
      filter: { type: "lowpass", Q: 1, frequency: 420 },
      filterEnvelope: { attack: 0.4, decay: 0.2, sustain: 0.7, release: 0.5, baseFrequency: 120, octaves: 2.2 },
      volume: -12,
    });
    const gravGain = new Tone.Volume(-8);
    const gravLfo = new Tone.LFO({ frequency: 0.4, min: -6, max: 2 }).start();
    gravLfo.connect(gravGain.volume);
    grav.chain(gravGain, filter);

    const laser = new Tone.AMSynth({
      harmonicity: 1.5,
      oscillator: { type: "sine" },
      modulation: { type: "sine" },
      envelope: { attack: 0.12, decay: 0.1, sustain: 0.85, release: 0.35 },
      volume: -14,
    });
    const laserFilter = new Tone.Filter(2400, "lowpass");
    laser.chain(laserFilter, filter);

    // Small pool so rapid kills don't re-trigger the same NoiseSynth
    const makeNoise = () => {
      const n = new Tone.NoiseSynth({
        noise: { type: "pink" },
        envelope: { attack: 0.02, decay: 0.35, sustain: 0, release: 0.2 },
        volume: -14,
      });
      const f = new Tone.Filter(800, "bandpass");
      n.chain(f, filter);
      return n;
    };
    const noises = [makeNoise(), makeNoise(), makeNoise()];
    let noiseIdx = 0;

    const makeBoom = () => new Tone.MembraneSynth({
      pitchDecay: 0.08,
      octaves: 4,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.45, sustain: 0.01, release: 0.35 },
      volume: -8,
    }).connect(filter);
    const booms = [makeBoom(), makeBoom(), makeBoom()];
    let boomIdx = 0;

    const bell = new Tone.MetalSynth({
      frequency: 220,
      envelope: { attack: 0.001, decay: 0.55, release: 0.25 },
      harmonicity: 4.2,
      modulationIndex: 18,
      resonance: 2800,
      octaves: 1.2,
      volume: -22,
    }).connect(filter);

    this.nodes = {
      master, reverb, chorus, filter,
      ambient, ambFilter, ambLfo,
      shoot, ui, grav, gravGain, gravLfo,
      laser, laserFilter,
      noises,
      nextNoise() {
        const i = noiseIdx++ % noises.length;
        return { synth: noises[i], key: "noise" + i };
      },
      booms,
      nextBoom() {
        const i = boomIdx++ % booms.length;
        return { synth: booms[i], key: "boom" + i };
      },
      bell,
      ambientOn: false,
      gravOn: false,
      laserOn: false,
    };
    reverb.generate().catch(() => {});
    this.ready = true;
  },

  _ok() {
    return this.unlocked && this.ready && !this.muted && this.nodes;
  },

  shoot(hit) {
    if (!this._ok()) return;
    this._safe(() => {
      if (hit) {
        const t = this._t("shoot");
        this.nodes.shoot.triggerAttackRelease("A5", 0.09, t, 0.7);
        this.nodes.shoot.triggerAttackRelease("E6", 0.06, this._t("shoot"), 0.35);
      } else {
        this.nodes.shoot.triggerAttackRelease("E5", 0.07, this._t("shoot"), 0.45);
      }
    });
  },

  /** Crisp high hit — distinct from normal kill. */
  headshot() {
    if (!this._ok()) return;
    this._safe(() => {
      const t = this._t("shoot");
      this.nodes.bell.frequency.value = 880;
      this.nodes.bell.triggerAttackRelease(0.22, this._t("bell"), 0.55);
      this.nodes.shoot.triggerAttackRelease("C6", 0.12, t, 0.85);
      this.nodes.shoot.triggerAttackRelease("G6", 0.1, this._t("shoot"), 0.55);
      this.nodes.ui.triggerAttackRelease("E6", 0.16, this._t("ui"), 0.4);
      const n = this.nodes.nextNoise();
      n.synth.triggerAttackRelease(0.12, this._t(n.key), 0.35);
    });
  },

  gravityOn(repel = false) {
    if (!this._ok()) return;
    this._safe(() => {
      const b = this.nodes.nextBoom();
      const n = this.nodes.nextNoise();
      // Pull: deep down · Repel: brighter upward “whoosh”
      b.synth.triggerAttackRelease(repel ? "G3" : "C2", 0.35, this._t(b.key), repel ? 0.45 : 0.55);
      n.synth.triggerAttackRelease(repel ? 0.18 : 0.28, this._t(n.key), repel ? 0.45 : 0.35);
      if (repel) {
        this.nodes.ui.triggerAttackRelease("E4", 0.2, this._t("ui"), 0.28);
      }
    });
  },
  gravityOff(repel = false) {
    if (!this._ok()) return;
    this._safe(() => {
      this.nodes.ui.triggerAttackRelease(repel ? "C3" : "G2", 0.18, this._t("ui"), 0.3);
    });
  },

  /** Invert grav drone (pitch + LFO) for repel vs pull. */
  applyGravMode(repel) {
    if (!this.ready || this.muted || !this.nodes) return;
    this._safe(() => {
      const lfo = this.nodes.gravLfo;
      if (repel) {
        lfo.min = 2;
        lfo.max = -6;
        lfo.frequency.value = 0.55;
      } else {
        lfo.min = -6;
        lfo.max = 2;
        lfo.frequency.value = 0.4;
      }
      if (this.nodes.gravOn) {
        const note = Tone.Frequency(repel ? "A2" : "C2").toFrequency();
        this.nodes.grav.frequency.rampTo(note, 0.12);
        if (this.nodes.grav.filter && this.nodes.grav.filter.frequency) {
          this.nodes.grav.filter.frequency.rampTo(repel ? 980 : 420, 0.15);
        }
      }
    });
  },

  laserOn() {
    if (!this._ok()) return;
    this._safe(() => {
      this.nodes.ui.triggerAttackRelease("C6", 0.12, this._t("ui"), 0.35);
      this.nodes.bell.frequency.value = 640;
      this.nodes.bell.triggerAttackRelease(0.18, this._t("bell"), 0.25);
    });
  },
  laserOff() {
    if (!this._ok()) return;
    this._safe(() => {
      this.nodes.ui.triggerAttackRelease("G5", 0.1, this._t("ui"), 0.25);
    });
  },

  shockwave() {
    if (!this._ok()) return;
    this._safe(() => {
      const n = this.nodes.nextNoise();
      const b = this.nodes.nextBoom();
      n.synth.triggerAttackRelease(0.5, this._t(n.key), 0.7);
      b.synth.triggerAttackRelease("A1", 0.7, this._t(b.key), 0.85);
      this.nodes.ui.triggerAttackRelease("C3", 0.4, this._t("ui"), 0.25);
    });
  },

  laserWave() {
    if (!this._ok()) return;
    this._safe(() => {
      const n = this.nodes.nextNoise();
      n.synth.triggerAttackRelease(0.4, this._t(n.key), 0.45);
      this.nodes.bell.frequency.value = 480;
      this.nodes.bell.triggerAttackRelease(0.45, this._t("bell"), 0.4);
      this.nodes.shoot.triggerAttackRelease("C5", 0.3, this._t("shoot"), 0.4);
      this.nodes.shoot.triggerAttackRelease("G5", 0.25, this._t("shoot"), 0.3);
    });
  },

  kill(kind) {
    if (!this._ok()) return;
    this._safe(() => {
      if (kind === "healer") {
        this.nodes.bell.frequency.value = 520;
        this.nodes.bell.triggerAttackRelease(0.35, this._t("bell"), 0.35);
        this.nodes.ui.triggerAttackRelease("E5", 0.2, this._t("ui"), 0.3);
      } else if (kind === "gainer") {
        this.nodes.bell.frequency.value = 380;
        this.nodes.bell.triggerAttackRelease(0.28, this._t("bell"), 0.3);
        this.nodes.ui.triggerAttackRelease("C5", 0.16, this._t("ui"), 0.28);
      } else if (kind === "tank" || kind === "mothership") {
        const n = this.nodes.nextNoise();
        const b = this.nodes.nextBoom();
        n.synth.triggerAttackRelease(kind === "mothership" ? 0.45 : 0.32, this._t(n.key), 0.65);
        b.synth.triggerAttackRelease(kind === "mothership" ? "F1" : "A1", 0.5, this._t(b.key), 0.75);
        if (kind === "mothership") {
          this.nodes.ui.triggerAttackRelease("G3", 0.35, this._t("ui"), 0.3);
        }
      } else {
        const n = this.nodes.nextNoise();
        const b = this.nodes.nextBoom();
        n.synth.triggerAttackRelease(0.22, this._t(n.key), 0.5);
        b.synth.triggerAttackRelease("E2", 0.28, this._t(b.key), 0.55);
      }
    });
  },

  wave() {
    if (!this._ok()) return;
    this._safe(() => {
      const t0 = this._t("ui");
      this.nodes.ui.triggerAttackRelease("C4", 0.35, t0, 0.4);
      this.nodes.ui.triggerAttackRelease("E4", 0.35, t0 + 0.18, 0.38);
      this.nodes.ui.triggerAttackRelease("G4", 0.5, t0 + 0.36, 0.42);
      this._lastT.ui = t0 + 0.36;
      const n = this.nodes.nextNoise();
      n.synth.triggerAttackRelease(0.35, this._t(n.key), 0.25);
    });
  },

  buy() {
    if (!this._ok()) return;
    this._safe(() => {
      const t = this._t("ui");
      this.nodes.ui.triggerAttackRelease("A5", 0.12, t, 0.4);
      this.nodes.ui.triggerAttackRelease("E6", 0.16, t + 0.08, 0.35);
      this._lastT.ui = t + 0.08;
    });
  },
  boot() {
    if (!this._ok()) return;
    this._safe(() => {
      const n = this.nodes.nextNoise();
      const b = this.nodes.nextBoom();
      n.synth.triggerAttackRelease(0.55, this._t(n.key), 0.3);
      b.synth.triggerAttackRelease("C2", 0.6, this._t(b.key), 0.5);
      this.nodes.ui.triggerAttackRelease("G3", 0.45, this._t("ui"), 0.3);
    });
  },
  heal() {
    if (!this._ok()) return;
    const now = performance.now();
    if (now - this.lastHeal < 200) return;
    this.lastHeal = now;
    this._safe(() => {
      this.nodes.ui.triggerAttackRelease("B5", 0.1, this._t("ui"), 0.18);
    });
  },
  deny() {
    if (!this._ok()) return;
    this._safe(() => {
      this.nodes.ui.triggerAttackRelease("D3", 0.15, this._t("ui"), 0.35);
    });
  },

  startAmbient() {
    if (!this.ready || this.muted || !this.nodes || this.nodes.ambientOn) return;
    this._safe(() => {
      this.nodes.ambient.triggerAttack(["C2", "G2", "C3", "D3", "G3"], this._t("ambient", 0.05), 0.35);
      this.nodes.ambientOn = true;
    });
  },

  stopAmbient() {
    if (!this.nodes || !this.nodes.ambientOn) return;
    this._safe(() => { this.nodes.ambient.releaseAll(); });
    this.nodes.ambientOn = false;
  },

  setLoop(kind, on, repel = false) {
    if (!this.ready || this.muted || !this.nodes) return;
    this._safe(() => {
      if (kind === "grav") {
        if (on && !this.nodes.gravOn) {
          this.nodes.grav.triggerAttack(repel ? "A2" : "C2", this._t("grav", 0.01), 0.7);
          this.nodes.gravOn = true;
          this.applyGravMode(repel);
        } else if (!on && this.nodes.gravOn) {
          this.nodes.grav.triggerRelease(Math.max(Tone.now(), (this._lastT.grav || 0) + 0.01));
          this.nodes.gravOn = false;
        } else if (on && this.nodes.gravOn) {
          this.applyGravMode(repel);
        }
      } else if (kind === "laser") {
        if (on && !this.nodes.laserOn) {
          this.nodes.laser.triggerAttack("E5", this._t("laser", 0.01), 0.55);
          this.nodes.laserFilter.frequency.rampTo(3600, 0.4);
          this.nodes.laserOn = true;
        } else if (!on && this.nodes.laserOn) {
          this.nodes.laser.triggerRelease(Math.max(Tone.now(), (this._lastT.laser || 0) + 0.01));
          this.nodes.laserFilter.frequency.rampTo(1800, 0.2);
          this.nodes.laserOn = false;
        }
      }
    });
  },

  syncLoops(gravityHold, laserHold, gravityActive, laserActive, gravityRepel = false) {
    const gravAudio = !!(gravityHold && gravityActive);
    const laserAudio = !!(laserHold && laserActive);
    const repel = !!gravityRepel;
    if (gravAudio && !this.gravWasOn) this.gravityOn(repel);
    if (!gravAudio && this.gravWasOn) this.gravityOff(this.gravWasRepel);
    if (laserAudio && !this.laserWasOn) this.laserOn();
    if (!laserAudio && this.laserWasOn) this.laserOff();
    // Mode flip while held → re-trigger one-shot cue
    if (gravAudio && this.gravWasOn && repel !== this.gravWasRepel) {
      this.gravityOn(repel);
    }
    this.gravWasOn = gravAudio;
    this.gravWasRepel = repel;
    this.laserWasOn = laserAudio;
    this.setLoop("grav", gravAudio, repel);
    this.setLoop("laser", laserAudio);
  },

  stopAllLoops() {
    this.setLoop("grav", false);
    this.setLoop("laser", false);
    this.gravWasOn = false;
    this.gravWasRepel = false;
    this.laserWasOn = false;
  },

  setMuted(m) {
    this.muted = m;
    if (m) {
      this.stopAllLoops();
      this.stopAmbient();
      if (typeof Tone !== "undefined") {
        try { Tone.getDestination().volume.value = -Infinity; } catch (_) {}
      }
    } else if (typeof Tone !== "undefined") {
      try { Tone.getDestination().volume.rampTo(-6, 0.05); } catch (_) {}
      this.startAmbient();
    }
  },
};


