import { CONFIG, COLORS } from './config.js';

function pointToSegmentDist(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 < 1e-6) return Math.hypot(apx, apy);
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx;
  const cy = ay + t * aby;
  return Math.hypot(px - cx, py - cy);
}

/**
 * S-pass offer radius from hold time (exponential growth).
 * v(t) = v0·e^(αt)  →  r(t) = r0 + (v0/α)(e^(αt) − 1)
 * α→0 falls back to linear r0 + v0·t
 */
export function passOfferRadius(holdTime) {
  const t = Math.max(0, holdTime || 0);
  const r0 = CONFIG.PASS_RANGE_MIN;
  const v0 = CONFIG.PASS_RANGE_GROW;
  const alpha = CONFIG.PASS_RANGE_EXPO;
  let r;
  if (alpha < 1e-4) {
    r = r0 + v0 * t;
  } else {
    r = r0 + (v0 / alpha) * (Math.exp(alpha * t) - 1);
  }
  return Math.min(CONFIG.PASS_RANGE_MAX, r);
}

/**
 * All teammates in the facing cone, scored for AI / risk display.
 * @param {{ maxDist?: number }} [opts]
 */
export function findPassCandidates(passer, players, facingX, facingY, opts = {}) {
  const fl = Math.hypot(facingX, facingY) || 1;
  const fx = facingX / fl;
  const fy = facingY / fl;
  const coneCos = Math.cos((CONFIG.PASS_CONE_DEG * Math.PI) / 180);
  const maxDist = opts.maxDist ?? CONFIG.PASS_MAX_DIST;
  const list = [];

  for (const p of players) {
    if (p.id === passer.id || p.team !== passer.team || p.isGK) continue;

    const dx = p.x - passer.x;
    const dy = p.y - passer.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 20 || dist > maxDist) continue;

    const nx = dx / dist;
    const ny = dy / dist;
    const dot = nx * fx + ny * fy;
    if (dot < coneCos) continue;

    const angleScore = (dot - coneCos) / (1 - coneCos);
    const distScore = 1 - dist / Math.max(maxDist, 1);

    let risk = 0;
    for (const opp of players) {
      if (opp.team === passer.team || opp.isGK) continue;
      const d = pointToSegmentDist(opp.x, opp.y, passer.x, passer.y, p.x, p.y);
      if (d < 40) {
        const proximity = 1 - d / 40;
        const along = ((opp.x - passer.x) * dx + (opp.y - passer.y) * dy) / (dist * dist);
        if (along > 0.1 && along < 0.95) {
          risk = Math.max(risk, proximity * (0.5 + along * 0.5));
        }
      }
    }

    const score = angleScore * 0.55 + distScore * 0.25 + (1 - risk) * 0.2;
    list.push({ target: p, risk, score, dist });
  }

  return list;
}

/**
 * Near = closest in cone, far = second-closest. Used for S / A passes.
 * @param {{ maxDist?: number }} [opts]
 */
export function findPassTargets(passer, players, facingX, facingY, opts = {}) {
  const list = findPassCandidates(passer, players, facingX, facingY, opts);
  list.sort((a, b) => a.dist - b.dist);
  return {
    near: list[0] || null,
    far: list[1] || null,
  };
}

/** Best AI pick by score (legacy). */
export function findPassTarget(passer, players, facingX, facingY) {
  const list = findPassCandidates(passer, players, facingX, facingY);
  let best = null;
  for (const c of list) {
    if (!best || c.score > best.score) best = c;
  }
  return best;
}

export function riskColor(risk) {
  if (risk < 0.33) return COLORS.passSafe;
  if (risk < 0.66) return COLORS.passMid;
  return COLORS.passRisk;
}

/** Lead pass aim point slightly ahead of target movement / facing */
export function leadPassPoint(passer, target) {
  const lead = 18;
  const dx = target.x - passer.x;
  const dy = target.y - passer.y;
  const dist = Math.hypot(dx, dy) || 1;
  const mx = target.vx * 0.12 + target.facingX * lead * 0.4;
  const my = target.vy * 0.12 + target.facingY * lead * 0.4;
  return {
    x: target.x + mx,
    y: target.y + my,
    dist,
  };
}
