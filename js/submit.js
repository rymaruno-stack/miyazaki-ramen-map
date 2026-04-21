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

// ─── フォーム送信 ────────────────────────────────────────────────
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const address = document.getElementById("address").value.trim();
  const hours = document.getElementById("hours").value.trim();
  const instagramUrl = document.getElementById("instagram_url").value.trim();
  const phone = document.getElementById("phone").value.trim();
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
      hours: hours || null,
      phone: phone || null,
      instagram_url: instagramUrl || null,
      is_new: isNew,
      lat,
      lng,
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
