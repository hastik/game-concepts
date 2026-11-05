import { CONFIG } from './config.js';

const STORAGE_KEY = 'handball.tuners.v7';

const DEFAULTS = {
  playerSpeed: CONFIG.BASE_SPEED,
  passSpeed: CONFIG.PASS_SPEED_MAX,
  dribbleSpeed: CONFIG.DRIBBLE_BOUNCE_HZ_MOVE,
  throwSpread: CONFIG.THROW_SPREAD_PCT,
  throwAlpha: CONFIG.THROW_CONE_ALPHA,
  throwFade: CONFIG.THROW_CONE_FADE_DIST,
  visionDirect: CONFIG.VISION_DIRECT_DEG,
  visionPeriph: CONFIG.VISION_PERIPH_DEG,
  visionAlpha: CONFIG.VISION_CONE_ALPHA,
  passRangeMin: CONFIG.PASS_RANGE_MIN,
  passRangeGrow: CONFIG.PASS_RANGE_GROW,
  passRangeExpo: CONFIG.PASS_RANGE_EXPO,
  passRangeMax: CONFIG.PASS_RANGE_MAX,
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function applyTuners({
  playerSpeed,
  passSpeed,
  dribbleSpeed,
  throwSpread,
  throwAlpha,
  throwFade,
  visionDirect,
  visionPeriph,
  visionAlpha,
  passRangeMin,
  passRangeGrow,
  passRangeExpo,
  passRangeMax,
}) {
  const speed = clamp(Number(playerSpeed) || DEFAULTS.playerSpeed, 40, 400);
  const pass = clamp(Number(passSpeed) || DEFAULTS.passSpeed, 80, 800);
  const dribble = clamp(Number(dribbleSpeed) || DEFAULTS.dribbleSpeed, 1, 20);
  const spread = clamp(Number(throwSpread) || DEFAULTS.throwSpread, 0.5, 40);
  const alpha = clamp(Number(throwAlpha) || DEFAULTS.throwAlpha, 0.05, 1);
  const fade = clamp(Number(throwFade) || DEFAULTS.throwFade, 40, 400);
  const direct = clamp(Number(visionDirect) || DEFAULTS.visionDirect, 2, 90);
  const periph = clamp(Number(visionPeriph) || DEFAULTS.visionPeriph, 5, 180);
  const vAlpha = clamp(Number(visionAlpha) || DEFAULTS.visionAlpha, 0.05, 1);
  const rangeMin = clamp(Number(passRangeMin) || DEFAULTS.passRangeMin, 5, 200);
  const rangeGrow = clamp(Number(passRangeGrow) || DEFAULTS.passRangeGrow, 20, 600);
  const expoRaw = Number(passRangeExpo);
  const rangeExpo = clamp(
    Number.isFinite(expoRaw) ? expoRaw : DEFAULTS.passRangeExpo,
    0,
    5,
  );
  const rangeMax = clamp(Number(passRangeMax) || DEFAULTS.passRangeMax, 40, 600);

  CONFIG.BASE_SPEED = speed;
  CONFIG.PASS_SPEED_MAX = pass;
  CONFIG.PASS_SPEED_MIN = Math.round(pass * 0.55);

  CONFIG.DRIBBLE_BOUNCE_HZ_MOVE = dribble;
  CONFIG.DRIBBLE_BOUNCE_HZ_STILL = Math.max(1, Math.round(dribble * 0.7 * 10) / 10);

  CONFIG.THROW_SPREAD_PCT = spread;
  CONFIG.THROW_CONE_ALPHA = alpha;
  CONFIG.THROW_CONE_FADE_DIST = fade;

  CONFIG.VISION_DIRECT_DEG = direct;
  CONFIG.VISION_PERIPH_DEG = Math.max(periph, direct);
  CONFIG.VISION_CONE_ALPHA = vAlpha;

  CONFIG.PASS_RANGE_MIN = rangeMin;
  CONFIG.PASS_RANGE_GROW = rangeGrow;
  CONFIG.PASS_RANGE_EXPO = rangeExpo;
  CONFIG.PASS_RANGE_MAX = Math.max(rangeMax, rangeMin);

  return {
    playerSpeed: speed,
    passSpeed: pass,
    dribbleSpeed: dribble,
    throwSpread: spread,
    throwAlpha: alpha,
    throwFade: fade,
    visionDirect: direct,
    visionPeriph: CONFIG.VISION_PERIPH_DEG,
    visionAlpha: vAlpha,
    passRangeMin: rangeMin,
    passRangeGrow: rangeGrow,
    passRangeExpo: rangeExpo,
    passRangeMax: CONFIG.PASS_RANGE_MAX,
  };
}

export function loadTuners() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return applyTuners(DEFAULTS);
    return applyTuners({ ...DEFAULTS, ...JSON.parse(raw) });
  } catch {
    return applyTuners(DEFAULTS);
  }
}

export function saveTuners(values) {
  const applied = applyTuners(values);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applied));
  return applied;
}

const TUNER_IDS = [
  ['tuner-player-speed', 'playerSpeed'],
  ['tuner-pass-speed', 'passSpeed'],
  ['tuner-dribble-speed', 'dribbleSpeed'],
  ['tuner-throw-spread', 'throwSpread'],
  ['tuner-throw-alpha', 'throwAlpha'],
  ['tuner-throw-fade', 'throwFade'],
  ['tuner-vision-direct', 'visionDirect'],
  ['tuner-vision-periph', 'visionPeriph'],
  ['tuner-vision-alpha', 'visionAlpha'],
  ['tuner-pass-range-min', 'passRangeMin'],
  ['tuner-pass-range-grow', 'passRangeGrow'],
  ['tuner-pass-range-expo', 'passRangeExpo'],
  ['tuner-pass-range-max', 'passRangeMax'],
];

export function bindTuners() {
  const inputs = {};
  for (const [id, key] of TUNER_IDS) {
    const el = document.getElementById(id);
    if (!el) return loadTuners();
    inputs[key] = el;
  }

  const current = loadTuners();
  for (const [, key] of TUNER_IDS) {
    inputs[key].value = String(current[key]);
  }

  const commit = () => {
    const applied = saveTuners({
      playerSpeed: inputs.playerSpeed.value,
      passSpeed: inputs.passSpeed.value,
      dribbleSpeed: inputs.dribbleSpeed.value,
      throwSpread: inputs.throwSpread.value,
      throwAlpha: inputs.throwAlpha.value,
      throwFade: inputs.throwFade.value,
      visionDirect: inputs.visionDirect.value,
      visionPeriph: inputs.visionPeriph.value,
      visionAlpha: inputs.visionAlpha.value,
      passRangeMin: inputs.passRangeMin.value,
      passRangeGrow: inputs.passRangeGrow.value,
      passRangeExpo: inputs.passRangeExpo.value,
      passRangeMax: inputs.passRangeMax.value,
    });
    for (const [, key] of TUNER_IDS) {
      inputs[key].value = String(applied[key]);
    }
  };

  for (const el of Object.values(inputs)) {
    el.addEventListener('change', commit);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
        el.blur();
      }
    });
  }

  return current;
}
