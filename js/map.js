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

// ─── ピンと店舗カードの生成 ──────────────────────────────────────
const markers = {};
const listEl = document.getElementById("shop-list");
const countEl = document.getElementById("shop-count");
function renderShops(shops) {
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
    card.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="min-w-0 flex-1">
          <div class="font-bold text-gray-800 text-sm">${escapeHtml(shop.name)}</div>
          <div class="text-xs text-gray-500 mt-1">📍 ${escapeHtml(shop.address)}</div>
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

loadShops();
