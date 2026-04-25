const form = document.getElementById("submit-form");
const successMessage = document.getElementById("success-message");
const submitBtn = document.getElementById("submit-btn");

// ─── 国土地理院ジオコーディング API（日本専用・無料・APIキー不要）──
async function geocode(address) {
  const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    console.error("ジオコーディング fetch エラー:", err);
    throw new Error("座標取得APIへの接続に失敗しました（タイムアウトまたはネットワークエラー）");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    console.error("ジオコーディング HTTPエラー:", res.status);
    throw new Error("座標取得APIへの接続に失敗しました");
  }

  const data = await res.json();
  console.log("国土地理院ジオコーディング結果:", data);

  if (!data || data.length === 0) {
    throw new Error("住所から座標を取得できませんでした。住所を確認して再度お試しください。");
  }

  // GeoJSON形式で返る: geometry.coordinates = [lng, lat]
  const [lng, lat] = data[0].geometry.coordinates;
  return { lat, lng };
}

// ─── 営業時間 UI ─────────────────────────────────────────────────
const DAYS = ["mon","tue","wed","thu","fri","sat","sun"];

function updateRowState(row) {
  const closed = row.querySelector(".day-closed").checked;
  const times = row.querySelector(".day-times");
  const loRow = row.querySelector(".day-lo-row");
  if (closed) {
    times.classList.add("opacity-30", "pointer-events-none");
    loRow.classList.add("hidden");
  } else {
    times.classList.remove("opacity-30", "pointer-events-none");
    loRow.classList.remove("hidden");
  }
}

document.querySelectorAll(".day-closed").forEach((cb) => {
  cb.addEventListener("change", () => updateRowState(cb.closest(".day-row")));
});

// 朝ラーメン・ランチのあり/なし切り替え
function updateSlotState(cb, timesEl) {
  if (cb.checked) {
    timesEl.classList.remove("opacity-30", "pointer-events-none");
  } else {
    timesEl.classList.add("opacity-30", "pointer-events-none");
  }
}

document.getElementById("morning-available").addEventListener("change", function() {
  updateSlotState(this, document.getElementById("morning-times"));
});

document.getElementById("lunch-available").addEventListener("change", function() {
  updateSlotState(this, document.getElementById("lunch-times"));
});

document.getElementById("copy-weekday").addEventListener("click", () => {
  const mon = document.querySelector("[data-day='mon']");
  const vals = {
    open: mon.querySelector(".day-open").value,
    close: mon.querySelector(".day-close").value,
    lo: mon.querySelector(".day-lo").value,
    closed: mon.querySelector(".day-closed").checked,
  };
  ["tue","wed","thu","fri"].forEach((day) => {
    const row = document.querySelector(`[data-day="${day}"]`);
    row.querySelector(".day-open").value = vals.open;
    row.querySelector(".day-close").value = vals.close;
    row.querySelector(".day-lo").value = vals.lo;
    row.querySelector(".day-closed").checked = vals.closed;
    updateRowState(row);
  });
});

document.getElementById("copy-sat-to-sun").addEventListener("click", () => {
  const sat = document.querySelector("[data-day='sat']");
  const sun = document.querySelector("[data-day='sun']");
  sun.querySelector(".day-open").value   = sat.querySelector(".day-open").value;
  sun.querySelector(".day-close").value  = sat.querySelector(".day-close").value;
  sun.querySelector(".day-lo").value     = sat.querySelector(".day-lo").value;
  sun.querySelector(".day-closed").checked = sat.querySelector(".day-closed").checked;
  updateRowState(sun);
});

function getHoursData() {
  const result = {};
  DAYS.forEach((day) => {
    const row = document.querySelector(`[data-day="${day}"]`);
    const closed = row.querySelector(".day-closed").checked;
    if (closed) {
      result[day] = { closed: true };
    } else {
      result[day] = {
        open: row.querySelector(".day-open").value || null,
        close: row.querySelector(".day-close").value || null,
        lo: row.querySelector(".day-lo").value || null,
        closed: false,
      };
    }
  });

  const morningAvail = document.getElementById("morning-available").checked;
  result.morning = {
    available: morningAvail,
    open: morningAvail ? document.getElementById("morning-open").value || null : null,
    close: morningAvail ? document.getElementById("morning-close").value || null : null,
  };

  const lunchAvail = document.getElementById("lunch-available").checked;
  result.lunch = {
    available: lunchAvail,
    open: lunchAvail ? document.getElementById("lunch-open").value || null : null,
    close: lunchAvail ? document.getElementById("lunch-close").value || null : null,
  };

  return result;
}

// ─── フォーム送信 ────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const address = document.getElementById("address").value.trim();
  const instagramUrl = document.getElementById("instagram_url").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const note = document.getElementById("note").value.trim();
  const isNew = document.getElementById("is_new").checked;

  // バリデーション
  let hasError = false;
  if (!name) { showError("name-error"); hasError = true; } else { hideError("name-error"); }
  if (!address) { showError("address-error"); hasError = true; } else { hideError("address-error"); }
  if (hasError) return;

  // ボタンをローディング状態に
  submitBtn.disabled = true;
  submitBtn.textContent = "座標を取得中…";
  hideGeoError();

  try {
    // ジオコーディング
    const { lat, lng } = await geocode(address);

    submitBtn.textContent = "登録中…";

    // Supabase に INSERT
    const { error } = await db.from("shops").insert({
      name,
      address,
      hours: JSON.stringify(getHoursData()),
      note: note || null,
      phone: phone || null,
      instagram_url: instagramUrl || null,
      is_new: isNew,
      lat,
      lng,
      is_approved: true, // TODO: false に戻す（審査フロー復活時）
      // is_approved: false,
    });

    if (error) throw new Error(error.message);

    // 完了表示
    form.classList.add("hidden");
    successMessage.classList.remove("hidden");

  } catch (err) {
    showGeoError(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = "登録する";
  }
});

// ─── エラー表示ヘルパー ──────────────────────────────────────────
function showError(id) {
  document.getElementById(id).classList.remove("hidden");
  const inputId = id.replace("-error", "");
  document.getElementById(inputId).classList.add("border-red-400", "ring-1", "ring-red-400");
}

function hideError(id) {
  document.getElementById(id).classList.add("hidden");
  const inputId = id.replace("-error", "");
  document.getElementById(inputId).classList.remove("border-red-400", "ring-1", "ring-red-400");
}

function showGeoError(msg) {
  const el = document.getElementById("geo-error");
  el.textContent = "⚠️ " + msg;
  el.classList.remove("hidden");
}

function hideGeoError() {
  document.getElementById("geo-error").classList.add("hidden");
}
