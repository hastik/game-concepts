import { TEAM } from './config.js';

export const STORAGE_KEY = 'handball.formations.v1';

export const ROLES = ['gk', 'wingL', 'wingR', 'backL', 'backC', 'backR', 'pivot'];

export const ROLE_LABELS = {
  gk: 'GK',
  wingL: 'LW',
  wingR: 'RW',
  backL: 'LB',
  backC: 'CB',
  backR: 'RB',
  pivot: 'PV',
};

/** Canonical: own goal at ny=0, attack toward ny=1; nx 0=left 1=right facing attack. */
export function defaultFormation() {
  return {
    gk: { attack: { nx: 0.5, ny: 0.08 }, defense: { nx: 0.5, ny: 0.06 } },
    wingL: { attack: { nx: 0.12, ny: 0.82 }, defense: { nx: 0.18, ny: 0.35 } },
    wingR: { attack: { nx: 0.88, ny: 0.82 }, defense: { nx: 0.82, ny: 0.35 } },
    backL: { attack: { nx: 0.32, ny: 0.68 }, defense: { nx: 0.35, ny: 0.28 } },
    backC: { attack: { nx: 0.5, ny: 0.62 }, defense: { nx: 0.5, ny: 0.25 } },
    backR: { attack: { nx: 0.68, ny: 0.68 }, defense: { nx: 0.65, ny: 0.28 } },
    pivot: { attack: { nx: 0.5, ny: 0.88 }, defense: { nx: 0.5, ny: 0.42 } },
  };
}

function clamp01(v) {
  return Math.max(0.02, Math.min(0.98, v));
}

function normalizeSlot(slot, fallback) {
  if (!slot || typeof slot !== 'object') return { ...fallback };
  return {
    nx: clamp01(Number(slot.nx) || fallback.nx),
    ny: clamp01(Number(slot.ny) || fallback.ny),
  };
}

export function normalizeFormation(raw) {
  const base = defaultFormation();
  const out = {};
  for (const role of ROLES) {
    const src = raw?.[role] || {};
    out[role] = {
      attack: normalizeSlot(src.attack, base[role].attack),
      defense: normalizeSlot(src.defense, base[role].defense),
    };
  }
  return out;
}

export function loadFormation() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultFormation();
    return normalizeFormation(JSON.parse(raw));
  } catch {
    return defaultFormation();
  }
}

export function saveFormation(formation) {
  const normalized = normalizeFormation(formation);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

/**
 * Map canonical slot to world coordinates.
 * Home attacks +x (right / portrait "up"); away mirrors.
 */
export function toWorld(slot, team, court) {
  const nx = clamp01(slot.nx);
  const ny = clamp01(slot.ny);
  if (team === TEAM.HOME) {
    return {
      x: ny * court.w,
      y: nx * court.h,
    };
  }
  return {
    x: (1 - ny) * court.w,
    y: (1 - nx) * court.h,
  };
}

export function getSlot(formation, role, phase) {
  const entry = formation[role] || defaultFormation()[role];
  return phase === 'attack' ? entry.attack : entry.defense;
}
