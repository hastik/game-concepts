window.RS = window.RS || {};
RS.config = RS.config || {};

RS.STRUCTURE_DEFS = {
  laserTurret: {
    name: "Laser Turret",
    tag: "Auto-laser",
    desc: "Malá věžička. V dosahu sama střílí laserem na nejbližší cíl.",
    cost: 40,
    size: 34,
    range: 190,
    dps: 3.2,
    color: "#ff2bd6",
    iconStyle: "color:var(--magenta)",
    icon: '<rect x="8" y="10" width="8" height="8" rx="1"/><path d="M12 10V5M10 5h4"/><path d="M12 5l6-2"/>',
  },
  antigravitron: {
    name: "Antigravitron",
    tag: "Odraz",
    desc: "Trvalé pole. Odpuzuje nepřátele od středu (opak gravitace).",
    cost: 55,
    size: 40,
    range: 130,
    push: 200,
    color: "#ffe066",
    icon: '<circle cx="12" cy="12" r="7"/><path d="M12 5v2M12 17v2M5 12h2M17 12h2"/><path d="M8 8l2 2M14 14l2 2M16 8l-2 2M10 14l-2 2"/>',
  },
};

RS.config.structures = RS.STRUCTURE_DEFS;
