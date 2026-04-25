// ─── 地図の初期化 ───────────────────────────────────────────────
const map = L.map("map").setView([31.9111, 131.4239], 14);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}).addTo(map);

// ─── カスタムピンアイコン ────────────────────────────────────────
function createIcon(isNew) {
  return L.divIcon({
    className: "",
    html: `<div class="${isNew ? "pin-new" : "pin-normal"}" style="width:18px;height:18px;"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  });
}

// ─── 営業時間フォーマット ────────────────────────────────────────
const DAY_KEYS = ["mon","tue","wed","thu","fri","sat","sun"];
const DAY_LABELS = {mon:"月",tue:"火",wed:"水",thu:"木",fri:"金",sat:"土",sun:"日"};

function formatHoursHTML(hours) {
  if (!hours) return "";
  let parsed;
  try {
    parsed = JSON.parse(hours);
    if (typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
  } catch {
    return `<div class="hours-table hours-legacy">${escapeHtml(hours)}</div>`;
  }
  const rows = DAY_KEYS.map((key) => {
    const d = parsed[key];
    if (!d) return "";
    if (d.closed) {
      return `<div class="hours-row">
        <span class="hours-day">${DAY_LABELS[key]}</span>
        <span class="hours-closed">定休日</span>
      </div>`;
    }
    const time = (d.open && d.close) ? `${d.open}〜${d.close}` : "";
    if (!time) return "";
    const lo = d.lo ? `<span class="hours-lo"> LO ${d.lo}</span>` : "";
    return `<div class="hours-row">
      <span class="hours-day">${DAY_LABELS[key]}</span>
      <span class="hours-time">${time}${lo}</span>
    </div>`;
  }).join("");
  if (!rows) return "";
  return `<div class="hours-table">${rows}</div>`;
}

// ─── ポップアップHTML ────────────────────────────────────────────
function popupHTML(shop) {
  const badge = shop.is_new ? `<span class="badge-new">NEW</span>` : "";
  const status = getBusinessStatus(shop.hours);
  const statusBadge = status ? `<div class="popup-status">${statusBadgeHTML(status)}</div>` : "";
  const hoursHTML = formatHoursHTML(shop.hours);
  const hours = hoursHTML ? `<div class="popup-hours-wrap">${hoursHTML}</div>` : "";
  const note = shop.note
    ? `<div class="popup-note">📝 ${escapeHtml(shop.note)}</div>`
    : "";
  const { morning, lunch } = hasMorningLunch(shop.hours);
  const featureBadges = [
    morning ? '<span class="badge-morning">🌅 朝ラーメン</span>' : "",
    lunch   ? '<span class="badge-lunch">🍱 ランチ</span>'       : "",
  ].filter(Boolean).join("");
  const features = featureBadges ? `<div class="popup-features">${featureBadges}</div>` : "";
  const insta = shop.instagram_url
    ? `<a href="${escapeHtml(shop.instagram_url)}" target="_blank" rel="noopener noreferrer"
         class="popup-insta">📸 Instagram</a>`
    : "";
  const nav = `<a href="https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}"
       target="_blank" rel="noopener noreferrer" class="popup-nav">🗺️ 道案内</a>`;
  return `
    <div class="popup-inner">
      <div class="popup-name">${escapeHtml(shop.name)} ${badge}</div>
      <div class="popup-address">📍 ${escapeHtml(shop.address)}</div>
      ${features}
      ${statusBadge}
      ${hours}
      ${note}
      <div class="popup-actions">${nav}${insta}</div>
    </div>
  `;
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── 朝ラーメン・ランチ判定 ───────────────────────────────────────
function hasMorningLunch(hoursJson) {
  if (!hoursJson) return { morning: false, lunch: false };
  let parsed;
  try {
    parsed = JSON.parse(hoursJson);
    if (typeof parsed !== "object" || Array.isArray(parsed)) return { morning: false, lunch: false };
  } catch { return { morning: false, lunch: false }; }
  return {
    morning: !!(parsed.morning && parsed.morning.available),
    lunch:   !!(parsed.lunch   && parsed.lunch.available),
  };
}

// ─── 営業状況判定 ─────────────────────────────────────────────
function timeToMin(t) {
  if (!t) return null;
  const p = t.split(":");
  return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
}

function getBusinessStatus(hoursJson) {
  if (!hoursJson) return null;
  let parsed;
  try {
    parsed = JSON.parse(hoursJson);
    if (typeof parsed !== "object" || Array.isArray(parsed)) return null;
  } catch (e) { return null; }

  const now      = new Date();
  const DAY_MAP  = ["sun","mon","tue","wed","thu","fri","sat"];
  const todayKey = DAY_MAP[now.getDay()];
  const yestKey  = DAY_MAP[(now.getDay() + 6) % 7];
  const cur      = now.getHours() * 60 + now.getMinutes();

  // 昨日が深夜越え営業で今がその範囲内かチェック
  const dy = parsed[yestKey];
  if (dy && !dy.closed && dy.open && dy.close) {
    const oyM = timeToMin(dy.open), cyM = timeToMin(dy.close);
    if (cyM < oyM && cur < cyM) {
      const lyM = dy.lo ? timeToMin(dy.lo) : null;
      return (lyM !== null && cur >= lyM) ? "lo_passed" : "open";
    }
  }

  const d = parsed[todayKey];
  if (!d) return null;
  if (d.closed) return "holiday";
  if (!d.open || !d.close) return null;

  const oM = timeToMin(d.open), cM = timeToMin(d.close);
  const lM = d.lo ? timeToMin(d.lo) : null;

  // 深夜越えは開店〜深夜まで「営業中」、翌朝〜閉店は昨日チェックで処理済み
  const inHours = cM < oM ? cur >= oM : cur >= oM && cur < cM;
  if (!inHours) return "closed";
  return (lM !== null && cur >= lM) ? "lo_passed" : "open";
}

function statusBadgeHTML(status) {
  if (status === "open")      return '<span class="status-badge status-open">🟢 営業中</span>';
  if (status === "lo_passed") return '<span class="status-badge status-lo">🟡 LO済み</span>';
  if (status === "closed")    return '<span class="status-badge status-closed">🔴 営業時間外</span>';
  if (status === "holiday")   return '<span class="status-badge status-holiday">⚫ 定休日</span>';
  return "";
}

// ─── 詳細モーダル ─────────────────────────────────────────────
let modalEl = null;
let currentModalShop = null;

function initModal() {
  modalEl = document.createElement("div");
  modalEl.className = "detail-modal hidden";
  modalEl.innerHTML = `
    <div class="detail-backdrop"></div>
    <div class="detail-sheet">
      <div class="detail-content"></div>
    </div>
  `;
  document.body.appendChild(modalEl);
  modalEl.querySelector(".detail-backdrop").addEventListener("click", closeModal);
}

function closeModal() {
  if (!modalEl) return;
  modalEl.classList.add("hidden");
  document.body.classList.remove("modal-open");
  currentModalShop = null;
}

function showDetailModal(shop) {
  currentModalShop = shop;
  const content = modalEl.querySelector(".detail-content");
  const status   = getBusinessStatus(shop.hours);
  const hoursHTML = formatHoursHTML(shop.hours);

  const statusBadge = status ? statusBadgeHTML(status) : "";
  const newBadge    = shop.is_new ? '<span class="badge-new">NEW</span>' : "";
  const { morning: hasMorning, lunch: hasLunch } = hasMorningLunch(shop.hours);
  const morningBadge = hasMorning ? '<span class="badge-morning">🌅 朝ラーメン</span>' : "";
  const lunchBadge   = hasLunch   ? '<span class="badge-lunch">🍱 ランチ</span>'       : "";
  const phoneHTML   = shop.phone
    ? `<div class="detail-row">📞 <a href="tel:${escapeHtml(shop.phone)}" class="detail-link">${escapeHtml(shop.phone)}</a></div>`
    : "";
  const noteHTML    = shop.note
    ? `<div class="detail-note">📝 ${escapeHtml(shop.note)}</div>`
    : "";
  const instaBtn    = shop.instagram_url
    ? `<a href="${escapeHtml(shop.instagram_url)}" target="_blank" rel="noopener noreferrer" class="detail-btn detail-btn-insta">📸 Instagram</a>`
    : "";
  const navBtn = `<a href="https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}" target="_blank" rel="noopener noreferrer" class="detail-btn detail-btn-nav">🗺️ 道案内</a>`;

  content.innerHTML = `
    <div class="detail-header">
      <div class="detail-name-row">
        <span class="detail-name">${escapeHtml(shop.name)}</span>
        <div class="detail-badges">${statusBadge}${newBadge}${morningBadge}${lunchBadge}</div>
      </div>
      <button class="detail-close" aria-label="閉じる">✕</button>
    </div>
    <div class="detail-body">
      <div class="detail-address">📍 ${escapeHtml(shop.address)}</div>
      ${hoursHTML ? `<div class="detail-hours">${hoursHTML}</div>` : ""}
      ${phoneHTML}
      ${noteHTML}
      <div class="detail-actions">${navBtn}${instaBtn}</div>
    </div>
  `;

  content.querySelector(".detail-close").addEventListener("click", closeModal);
  modalEl.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

// ─── ピンと店舗カードの生成 ──────────────────────────────────────
const markers = {};
let allShops = [];
const listEl = document.getElementById("shop-list");
const countEl = document.getElementById("shop-count");
function renderShops(shops) {
  allShops = shops;
  if (countEl) countEl.textContent = `宮崎市内 ${shops.length}件掲載`;

  if (shops.length === 0) {
    listEl.innerHTML = `<p class="text-gray-400 text-sm p-4">まだ店舗が登録されていません。</p>`;
    return;
  }

  shops.forEach((shop) => {
    if (shop.lat == null || shop.lng == null) return;

    const marker = L.marker([shop.lat, shop.lng], { icon: createIcon(shop.is_new) })
      .addTo(map)
      .bindPopup(popupHTML(shop), { maxWidth: 240 });

    markers[shop.id] = marker;

    const card = document.createElement("div");
    card.className = "shop-list-item";
    card.setAttribute("data-shop-id", shop.id);

    const s = getBusinessStatus(shop.hours);
    const { morning: hasMorning, lunch: hasLunch } = hasMorningLunch(shop.hours);
    card.innerHTML = `
      <div class="shop-list-main">
        <span class="shop-list-name">${escapeHtml(shop.name)}</span>
        <div class="shop-list-badges">
          <span data-status-id="${shop.id}">${s ? statusBadgeHTML(s) : ""}</span>
          ${shop.is_new ? '<span class="badge-new">NEW</span>' : ""}
          ${hasMorning ? '<span class="badge-morning">🌅 朝ラーメン</span>' : ""}
          ${hasLunch   ? '<span class="badge-lunch">🍱 ランチ</span>'       : ""}
        </div>
      </div>
      <span class="shop-list-arrow">›</span>
    `;

    card.addEventListener("click", () => {
      showDetailModal(shop);
    });

    listEl.appendChild(card);
  });
}

// ─── Supabase からデータ取得 ─────────────────────────────────────
async function loadShops() {
  listEl.innerHTML = `<p class="text-gray-400 text-sm col-span-2 animate-pulse">読み込み中…</p>`;

  const { data, error } = await db
    .from("shops")
    .select("*")
    .eq("is_approved", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("データ取得エラー:", error.message);
    listEl.innerHTML = `<p class="text-red-400 text-sm col-span-2">データの取得に失敗しました。</p>`;
    return;
  }

  listEl.innerHTML = "";
  renderShops(data);
}

// ─── 営業状況の自動更新（1分ごと）───────────────────────────────
function updateAllStatuses() {
  allShops.forEach(function(shop) {
    const s = getBusinessStatus(shop.hours);
    // リストのバッジ更新
    const el = listEl.querySelector("[data-status-id='" + shop.id + "']");
    if (el) { el.innerHTML = s ? statusBadgeHTML(s) : ""; }
    // ポップアップ内容更新（開いていれば即時反映）
    if (markers[shop.id]) {
      markers[shop.id].setPopupContent(popupHTML(shop));
    }
  });
  // 開いているモーダルを再描画
  if (currentModalShop) {
    showDetailModal(currentModalShop);
  }
}

// ─── 検索フィルタ ─────────────────────────────────────────────
const searchInput = document.getElementById("shop-search");
const searchClear = document.getElementById("search-clear");

function filterShops(query) {
  const q = query.trim().toLowerCase();
  allShops.forEach(function(shop) {
    const match = !q || shop.name.toLowerCase().includes(q);
    const card = listEl.querySelector('[data-shop-id="' + shop.id + '"]');
    if (card) { card.style.display = match ? "" : "none"; }
    if (markers[shop.id]) {
      if (match) { markers[shop.id].addTo(map); }
      else        { markers[shop.id].remove();  }
    }
  });
}

if (searchInput) {
  searchInput.addEventListener("input", function() {
    searchClear.classList.toggle("hidden", !this.value);
    filterShops(this.value);
  });
}

if (searchClear) {
  searchClear.addEventListener("click", function() {
    searchInput.value = "";
    searchClear.classList.add("hidden");
    filterShops("");
    searchInput.focus();
  });
}

initModal();
loadShops();
setInterval(updateAllStatuses, 60000);
