window.RS = window.RS || {};
RS.shop = RS.shop || {};

(function () {
  const state = RS.state;
  const el = RS.dom.el;
  const canvas = RS.dom.canvas;
  const ctx = RS.dom.ctx;
  const radarCtx = RS.dom.radarCtx;

/** Lightweight mid-combat HUD (score / credits / wave / bars). */
function updateHudStats() {
  el.score.textContent = String(state.kills);
  el.credits.textContent = String(Math.floor(state.credits));
  el.waveNum.textContent = String(Math.max(1, state.wave));
  const waveInput = document.getElementById("debugWaveInput");
  if (waveInput && document.activeElement !== waveInput) {
    waveInput.value = String(Math.max(1, state.wave));
  }
  RS.combat.updateResourceBars();
}

function updateShopUI() {
  for (const key of Object.keys(RS.UPGRADE_DEFS)) {
    const def = RS.UPGRADE_DEFS[key];
    const lv = state.upgrades[key];
    const lvlEl = document.getElementById(`lvl-${key}`);
    if (lvlEl) lvlEl.textContent = `Lv ${lv}`;
    const maxed = lv >= def.max;
    const cost = RS.costOf(key, lv);
    const btn = document.getElementById(`btn-${key}`);
    if (btn) {
      btn.textContent = maxed ? "MAX" : `Koupit — ${cost}`;
      btn.disabled = maxed || state.credits < cost;
    }
    const bar = document.getElementById(`bar-${key}`);
    if (bar) bar.style.width = `${(lv / def.max) * 100}%`;
  }
  for (const key of Object.keys(RS.STRUCTURE_DEFS)) {
    const def = RS.STRUCTURE_DEFS[key];
    const btn = document.getElementById(`btn-struct-${key}`);
    if (!btn) continue;
    btn.textContent = `Postavit — ${def.cost}`;
    btn.disabled = state.credits < def.cost || !!state.placingStructure;
  }
  updateHudStats();
}

function buy(key) {
  const def = RS.UPGRADE_DEFS[key];
  const lv = state.upgrades[key];
  if (lv >= def.max) { RS.sfx.deny(); return; }
  const cost = RS.costOf(key, lv);
  if (state.credits < cost) { RS.sfx.deny(); return; }
  state.credits -= cost;
  state.upgrades[key] += 1;
  RS.sfx.buy();
  updateShopUI();
}

function isShopOpen() {
  return el.shopBackdrop.classList.contains("open");
}

function setShopOpen(open, opts = {}) {
  el.shopBackdrop.classList.toggle("open", open);
  el.shopBackdrop.setAttribute("aria-hidden", open ? "false" : "true");
  el.upgradesBtn.classList.toggle("open", open);
  if (open) {
    RS.combat.clearButtons();
    updateShopUI();
    updateResultsPanel();
    const title = document.getElementById("shop-title");
    if (title) {
      title.textContent = state.waveUpgradePending ? `Vlna ${state.wave}` : "Hangar";
    }
    const defaultTab = opts.tab || (state.waveUpgradePending ? "results" : "upgrades");
    setShopTab(defaultTab);
    if (el.shopClose) {
      if (!state.waveUpgradePending) {
        el.shopClose.textContent = "Zavřít";
      } else if (state.waveRetryPending) {
        el.shopClose.textContent = `Znovu vlnu ${state.wave}`;
      } else {
        el.shopClose.textContent = "Další vlna";
      }
    }
  } else {
    if (el.shopClose) el.shopClose.textContent = "Zavřít";
    if (state.skipWaveStartOnShopClose) {
      state.skipWaveStartOnShopClose = false;
    } else if (state.waveUpgradePending) {
      state.waveUpgradePending = false;
      RS.waves.startWave();
    }
  }
}

function toggleShop() {
  setShopOpen(!isShopOpen(), { tab: "upgrades" });
}

function uiBlocksGameplay(target) {
  if (!target || !target.closest) return false;
  return !!(
    target.closest("#shop-backdrop") ||
    target.closest("#upgrades-btn") ||
    target.closest("#debug-bar") ||
    target.closest("#game-menu") ||
    target.closest("#tools-menu") ||
    target.closest("#btn-laser-mode") ||
    target.closest("#msg-popup")
  );
}

function showMsgPopup(title, text) {
  const titleEl = document.getElementById("msg-popup-title");
  if (titleEl) titleEl.textContent = title || "Chyba";
  if (el.msgPopupText) el.msgPopupText.textContent = text || "";
  if (el.msgPopup) {
    el.msgPopup.classList.add("open");
    el.msgPopup.setAttribute("aria-hidden", "false");
  }
  RS.combat.clearButtons();
}

function hideMsgPopup() {
  if (el.msgPopup) {
    el.msgPopup.classList.remove("open");
    el.msgPopup.setAttribute("aria-hidden", "true");
  }
}

function isMsgPopupOpen() {
  return !!(el.msgPopup && el.msgPopup.classList.contains("open"));
}

function updateResultsPanel() {
  const r = state.lastWaveResults;
  const hero = document.getElementById("results-hero");
  const sub = document.getElementById("results-sub");
  if (!r) {
    if (hero) hero.textContent = "Žádné výsledky";
    if (sub) sub.textContent = "Dokonči vlnu, aby se tu zobrazilo shrnutí.";
    return;
  }
  if (hero) hero.textContent = `Vlna ${r.wave} dokončena`;
  if (sub) sub.textContent = `Celkem sestřeleno ${r.killCount} nepřátel`;
  const durEl = document.getElementById("results-duration");
  const avgEl = document.getElementById("results-avg");
  const scoreEl = document.getElementById("results-score");
  const credEl = document.getElementById("results-credits");
  if (durEl) durEl.textContent = RS.waves.formatSeconds(r.duration);
  if (avgEl) {
    avgEl.textContent = r.killCount > 0
      ? RS.waves.formatSeconds(r.duration / r.killCount)
      : "—";
  }
  if (scoreEl) scoreEl.textContent = String(Math.floor(r.scoreGained));
  if (credEl) credEl.textContent = String(Math.floor(r.creditsGained));
  for (const kind of RS.LOOT_KINDS) {
    const kEl = document.getElementById(`results-kill-${kind}`);
    const lEl = document.getElementById(`results-loot-${kind}`);
    if (kEl) kEl.textContent = String(r.killsByKind[kind] || 0);
    if (lEl) lEl.textContent = String(r.lootGained[kind] || 0);
  }
}

function setShopTab(tabId) {
  const tabs = el.shop ? el.shop.querySelectorAll(".shop-tab") : [];
  const panels = el.shop ? el.shop.querySelectorAll(".shop-panel") : [];
  tabs.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabId);
  });
}

  RS.shop.updateShopUI = updateShopUI;
  RS.shop.updateHudStats = updateHudStats;
  RS.shop.buy = buy;
  RS.shop.isShopOpen = isShopOpen;
  RS.shop.setShopOpen = setShopOpen;
  RS.shop.toggleShop = toggleShop;
  RS.shop.uiBlocksGameplay = uiBlocksGameplay;
  RS.shop.showMsgPopup = showMsgPopup;
  RS.shop.hideMsgPopup = hideMsgPopup;
  RS.shop.isMsgPopupOpen = isMsgPopupOpen;
  RS.shop.updateResultsPanel = updateResultsPanel;
  RS.shop.setShopTab = setShopTab;


  RS.shop.buildShopUI = function buildShopUI() {
    const grid = document.getElementById("shop-upgrades-grid");
    const structGrid = document.getElementById("shop-structures-grid");
    if (!grid || !structGrid) return;

    const cats = [
      { id: "weapon", title: "Zbraň", className: "" },
      { id: "grav", title: "Gravitace", className: "sub grav" },
      { id: "laser", title: "Laser", className: "sub laser" },
      { id: "autolaser", title: "Projectile autolaser", className: "sub autolaser" },
      { id: "wave", title: "Rázová vlna", className: "sub wave" },
    ];

    grid.innerHTML = "";
    for (const cat of cats) {
      const h2 = document.createElement("h2");
      if (cat.className) h2.className = cat.className;
      h2.textContent = cat.title;
      grid.appendChild(h2);

      for (const [key, def] of Object.entries(RS.UPGRADE_DEFS)) {
        if (def.category !== cat.id) continue;
        const div = document.createElement("div");
        div.className = "upgrade";
        div.dataset.key = key;
        const style = def.iconStyle ? ` style="${def.iconStyle}"` : "";
        div.innerHTML =
          `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"${style}>${def.icon}</svg>` +
          `<span class="name">${def.name}</span>` +
          `<span class="lvl" id="lvl-${key}">Lv ${def.startLevel}</span>` +
          `<span class="desc">${def.desc}</span>` +
          `<div class="bar"><i id="bar-${key}"></i></div>` +
          `<button type="button" id="btn-${key}">Koupit — ${def.baseCost}</button>`;
        grid.appendChild(div);
        div.querySelector("button").addEventListener("click", (e) => {
          e.stopPropagation();
          RS.shop.buy(key);
        });
      }
    }

    structGrid.innerHTML = "";
    for (const [key, def] of Object.entries(RS.STRUCTURE_DEFS)) {
      const div = document.createElement("div");
      div.className = "structure";
      div.dataset.struct = key;
      const style = def.iconStyle ? ` style="${def.iconStyle}"` : "";
      div.innerHTML =
        `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"${style}>${def.icon}</svg>` +
        `<span class="name">${def.name}</span>` +
        `<span class="tag">${def.tag}</span>` +
        `<span class="desc">${def.desc}</span>` +
        `<button type="button" id="btn-struct-${key}">Postavit — ${def.cost}</button>`;
      structGrid.appendChild(div);
      div.querySelector("button").addEventListener("click", (e) => {
        e.stopPropagation();
        RS.structures.beginPlaceStructure(key);
      });
    }
  };

})();
