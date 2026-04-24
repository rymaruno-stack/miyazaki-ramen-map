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

// ─── ピンと店舗カードの生成 ──────────────────────────────────────
const markers = {};
let allShops = [];
const listEl = document.getElementById("shop-list");
const countEl = document.getElementById("shop-count");
function renderShops(shops) {
  allShops = shops;
  if (countEl) countEl.textContent = `宮崎市内 ${shops.length}件掲載`;

  if (shops.length === 0) {
    listEl.innerHTML = `<p class="text-gray-400 text-sm col-span-2">まだ店舗が登録されていません。</p>`;
    return;
  }

  shops.forEach((shop) => {
    if (shop.lat == null || shop.lng == null) return;

    const marker = L.marker([shop.lat, shop.lng], { icon: createIcon(shop.is_new) })
      .addTo(map)
      .bindPopup(popupHTML(shop), { maxWidth: 240 });

    markers[shop.id] = marker;

    const card = document.createElement("div");
    card.className =
      "shop-card bg-white rounded-xl border border-gray-200 shadow-sm p-4 cursor-pointer hover:shadow-md";
    const instaBtn = shop.instagram_url
      ? `<a href="${escapeHtml(shop.instagram_url)}" target="_blank" rel="noopener noreferrer"
            class="card-insta" onclick="event.stopPropagation()">📸 Instagram</a>`
      : "";
    const navBtn = `<a href="https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}"
          target="_blank" rel="noopener noreferrer"
          class="card-nav" onclick="event.stopPropagation()">🗺️ 道案内</a>`;
    const hoursHTML = formatHoursHTML(shop.hours);
    const noteHTML = shop.note
      ? `<div class="text-xs text-gray-500 mt-1">📝 ${escapeHtml(shop.note)}</div>`
      : "";
    const s = getBusinessStatus(shop.hours);
    const statusDiv = `<div class="mt-1" data-status-id="${shop.id}">${s ? statusBadgeHTML(s) : ""}</div>`;
    card.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="min-w-0 flex-1">
          <div class="font-bold text-gray-800 text-sm">${escapeHtml(shop.name)}</div>
          <div class="text-xs text-gray-500 mt-1">📍 ${escapeHtml(shop.address)}</div>
          ${statusDiv}
          ${hoursHTML ? `<div class="mt-2">${hoursHTML}</div>` : ""}
          ${noteHTML}
          <div class="card-actions">${navBtn}${instaBtn}</div>
        </div>
        ${shop.is_new ? `<span class="badge-new shrink-0 mt-0.5 ml-2">NEW</span>` : ""}
      </div>
    `;

    card.addEventListener("click", () => {
      map.setView([shop.lat, shop.lng], 16, { animate: true });
      markers[shop.id].openPopup();
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
    // カードバッジ更新
    const el = listEl.querySelector("[data-status-id='" + shop.id + "']");
    if (el) { el.innerHTML = s ? statusBadgeHTML(s) : ""; }
    // ポップアップ内容更新（開いていれば即時反映）
    if (markers[shop.id]) {
      markers[shop.id].setPopupContent(popupHTML(shop));
    }
  });
}

loadShops();
setInterval(updateAllStatuses, 60000);
