window.RS = window.RS || {};
RS.config = RS.config || {};

RS.UPGRADE_DEFS = {
  aimSpeed: {
    name: "Rychlost zaměřovače",
    desc: "Jak rychle stíhá kurzor",
    category: "weapon",
    baseCost: 16,
    costScale: 1.5,
    max: 14,
    startLevel: 1,
    icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><path d="M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  },
  power: {
    name: "Síla",
    desc: "Poškození za výstřel",
    category: "weapon",
    baseCost: 15,
    costScale: 1.55,
    max: 12,
    startLevel: 1,
    icon: '<path d="M12 3v14M7 10l5-7 5 7M6 20h12"/>',
  },
  reload: {
    name: "Přebíjení",
    desc: "Rychlejší kadence",
    category: "weapon",
    baseCost: 15,
    costScale: 1.5,
    max: 12,
    startLevel: 1,
    icon: '<path d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5"/><path d="M18 3v4h-4M6 21v-4h4"/>',
  },
  width: {
    name: "Šířka střelby",
    desc: "Větší zásahová zóna",
    category: "weapon",
    baseCost: 20,
    costScale: 1.6,
    max: 10,
    startLevel: 1,
    icon: '<path d="M12 20V8M7 20V11M17 20V11M12 8l-3-4M12 8l3-4M7 11l-2-3M17 11l2-3"/>',
  },
  pierce: {
    name: "Průraz",
    desc: "Kolik cílů jeden výstřel trefí",
    category: "weapon",
    baseCost: 25,
    costScale: 1.7,
    max: 6,
    startLevel: 0,
    icon: '<path d="M12 3l7 7-7 7-7-7 7-7zM8 10h8M10 8v8"/>',
  },
  headshotChance: {
    name: "Headshot chance",
    desc: "Šance na okamžité zničení cíle přesně ve středu zaměřovače",
    category: "weapon",
    baseCost: 28,
    costScale: 1.45,
    max: 20,
    startLevel: 0,
    icon: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
  },
  gravRadius: {
    name: "Poloměr",
    desc: "Dosah gravitačního tahu",
    category: "grav",
    baseCost: 18,
    costScale: 1.55,
    max: 10,
    startLevel: 1,
    icon: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  },
  gravPull: {
    name: "Síla tahu",
    desc: "Rychlost přitahování cílů",
    category: "grav",
    baseCost: 18,
    costScale: 1.55,
    max: 10,
    startLevel: 1,
    icon: '<path d="M12 4c4 3 6 5 6 8a6 6 0 1 1-12 0c0-1.5.6-3 2-4.5"/><path d="M12 12v4"/>',
  },
  gravRegen: {
    name: "Doplňování",
    desc: "Rychlejší nabíjení progressbaru",
    category: "grav",
    baseCost: 18,
    costScale: 1.55,
    max: 10,
    startLevel: 1,
    icon: '<path d="M8 8h8v8H8z"/><path d="M6 6l2 2M18 6l-2 2M6 18l2-2M18 18l-2-2"/>',
  },
  laserPower: {
    name: "Síla laseru",
    desc: "Poškození za sekundu",
    category: "laser",
    baseCost: 20,
    costScale: 1.55,
    max: 12,
    startLevel: 1,
    iconStyle: "color:var(--magenta)",
    icon: '<path d="M4 20L20 4M14 4h6v6"/>',
  },
  laserTargets: {
    name: "Počet cílů",
    desc: "Kolik laserů startuje najednou",
    category: "laser",
    baseCost: 28,
    costScale: 1.65,
    max: 5,
    startLevel: 1,
    iconStyle: "color:var(--magenta)",
    icon: '<circle cx="12" cy="12" r="2"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/>',
  },
  laserJumps: {
    name: "Jumps",
    desc: "Beam: skok (−50 %/hop) · Laser: průrazy paprsku (1+Lv)",
    category: "laser",
    baseCost: 30,
    costScale: 1.6,
    max: 8,
    startLevel: 0,
    iconStyle: "color:var(--magenta)",
    icon: '<path d="M4 12h4l3-6 3 12 3-6h3"/><path d="M17 7l3 3-3 3"/>',
  },
  freezeTime: {
    name: "Doba zmrazení",
    desc: "Jak dlouho vlna zastaví objekty",
    category: "wave",
    baseCost: 22,
    costScale: 1.55,
    max: 10,
    startLevel: 1,
    iconStyle: "color:#ffe066",
    icon: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2"/>',
  },
  autoLaserBeams: {
    name: "Beams",
    desc: "Kolik nepřátelských projektilů zároveň sestřelíš (0 = vypnuto)",
    category: "autolaser",
    baseCost: 24,
    costScale: 1.65,
    max: 6,
    startLevel: 0,
    iconStyle: "color:#00ffc8",
    icon: '<path d="M12 3v6M12 15v6"/><path d="M5 8l7 4 7-4M5 16l7-4 7 4"/>',
  },
  autoLaserPower: {
    name: "Power",
    desc: "Síla obranného laseru proti projektilům",
    category: "autolaser",
    baseCost: 20,
    costScale: 1.55,
    max: 12,
    startLevel: 1,
    iconStyle: "color:#00ffc8",
    icon: '<path d="M12 2l2.5 7H22l-6 4.5 2.5 7.5L12 16l-6.5 5 2.5-7.5L2 9h7.5z"/>',
  },
  autoLaserRadius: {
    name: "Radius",
    desc: "Dosah = násobek poloměru zaměřovače",
    category: "autolaser",
    baseCost: 22,
    costScale: 1.55,
    max: 8,
    startLevel: 1,
    iconStyle: "color:#00ffc8",
    icon: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
  },
};

RS.costOf = function costOf(key, level) {
  const d = RS.UPGRADE_DEFS[key];
  return Math.floor(d.baseCost * Math.pow(d.costScale, level));
};

RS.stats = {
  aimSpeed() { return 280 + (RS.state.upgrades.aimSpeed - 1) * 55; },
  damage() { return 1 + (RS.state.upgrades.power - 1) * 0.85; },
  fireInterval() { return Math.max(0.09, 0.42 - (RS.state.upgrades.reload - 1) * 0.028); },
  shotRadius() { return 22 + (RS.state.upgrades.width - 1) * 10; },
  pierceCount() { return 1 + RS.state.upgrades.pierce; },
  /** 0–20 % chance; level N → N percent. */
  headshotChance() { return (RS.state.upgrades.headshotChance || 0) * 0.01; },
  ampMul() { return RS.state.ampActive ? (RS.AMPLIFIER.mul || 2) : 1; },
  gravRadius() { return (110 + (RS.state.upgrades.gravRadius - 1) * 28) * RS.stats.ampMul(); },
  gravPullStrength() { return (180 + (RS.state.upgrades.gravPull - 1) * 55) * RS.stats.ampMul(); },
  gravDrainRate() { return 0.32; },
  gravRegenRate() { return 0.18 + (RS.state.upgrades.gravRegen - 1) * 0.055; },
  laserDps() { return (2.2 + (RS.state.upgrades.laserPower - 1) * 1.15) * RS.stats.ampMul(); },
  laserTargetCount() { return RS.state.upgrades.laserTargets; },
  laserJumps() { return RS.state.upgrades.laserJumps; },
  laserDamageMul(t) {
    return t.freezeLeft > 0 ? 2 : 1;
  },
  laserDrainRate() { return 0.28; },
  laserRegenRate() { return 0.16; },
  freezeDuration() { return 2 + (RS.state.upgrades.freezeTime - 1) * 0.45; },
  waveCooldownMax() { return 5.5; },
  laserWaveCooldownMax() { return 5.5; },
  laserWaveBaseDamage() {
    return 10 + RS.stats.laserDps() * 2.5 + RS.state.wave * 0.35;
  },
  /** Simultaneous intercept beams (0 = off). */
  autoLaserBeams() { return RS.state.upgrades.autoLaserBeams || 0; },
  autoLaserDps() {
    const lv = Math.max(1, RS.state.upgrades.autoLaserPower || 1);
    return 3.2 + (lv - 1) * 1.35;
  },
  /** Always a multiple of the crosshair shot radius. */
  autoLaserRadius() {
    const mul = Math.max(1, RS.state.upgrades.autoLaserRadius || 1);
    return RS.stats.shotRadius() * mul;
  },
};

RS.config.upgrades = RS.UPGRADE_DEFS;
RS.config.costOf = RS.costOf;
