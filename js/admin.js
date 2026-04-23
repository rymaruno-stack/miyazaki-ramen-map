var PASSWORD = "Ganya0308";
var remaining = 0;

var authScreen  = document.getElementById("auth-screen");
var mainScreen  = document.getElementById("main-screen");
var pwInput     = document.getElementById("pw-input");
var pwError     = document.getElementById("pw-error");
var loginBtn    = document.getElementById("login-btn");
var loadingText = document.getElementById("loading-text");
var errorText   = document.getElementById("error-text");
var shopList    = document.getElementById("shop-list");
var countBadge  = document.getElementById("count-badge");
var emptyText   = document.getElementById("empty-text");

// ---- ログイン ----
loginBtn.addEventListener("click", onLogin);
pwInput.addEventListener("keydown", function(e) {
  if (e.key === "Enter") { onLogin(); }
});

function onLogin() {
  if (pwInput.value === PASSWORD) {
    authScreen.classList.add("hidden");
    mainScreen.classList.remove("hidden");
    fetchShops();
  } else {
    pwError.classList.remove("hidden");
    pwInput.value = "";
    pwInput.focus();
  }
}

// ---- 店舗取得 ----
function fetchShops() {
  loadingText.classList.remove("hidden");
  errorText.classList.add("hidden");
  shopList.innerHTML = "";
  emptyText.classList.add("hidden");

  db.from("shops")
    .select("*")
    .eq("is_approved", false)
    .order("created_at", { ascending: false })
    .then(function(res) {
      loadingText.classList.add("hidden");

      if (res.error) {
        console.error("fetch error:", res.error);
        errorText.textContent = "取得エラー: " + res.error.message;
        errorText.classList.remove("hidden");
        return;
      }

      remaining = res.data.length;
      countBadge.textContent = remaining + "件";

      if (remaining === 0) {
        emptyText.classList.remove("hidden");
        return;
      }

      res.data.forEach(function(shop) {
        shopList.appendChild(buildCard(shop));
      });
    });
}

// ---- カード生成 ----
function buildCard(shop) {
  var card = document.createElement("div");
  card.className = "bg-white rounded-xl border border-gray-200 shadow-sm p-4";

  var name = document.createElement("p");
  name.className = "font-bold text-gray-800 text-base";
  name.textContent = shop.name || "(名称不明)";

  var addr = document.createElement("p");
  addr.className = "text-xs text-gray-500 mt-1";
  addr.textContent = "住所: " + (shop.address || "未入力");

  var date = document.createElement("p");
  date.className = "text-xs text-gray-400 mt-1";
  date.textContent = "投稿: " + new Date(shop.created_at).toLocaleString("ja-JP");

  var approveBtn = document.createElement("button");
  approveBtn.textContent = "承認する";
  approveBtn.className = "flex-1 bg-green-500 hover:bg-green-600 text-white text-sm font-bold py-2 rounded-xl";

  var deleteBtn = document.createElement("button");
  deleteBtn.textContent = "削除する";
  deleteBtn.className = "flex-1 bg-gray-100 hover:bg-red-100 text-red-500 text-sm font-bold py-2 rounded-xl";

  var msgEl = document.createElement("p");
  msgEl.className = "hidden text-xs text-red-500 text-center mt-2";

  approveBtn.addEventListener("click", function() {
    console.log("[admin] approve id:", shop.id);
    approveBtn.disabled = true;
    deleteBtn.disabled = true;
    approveBtn.textContent = "処理中...";

    db.from("shops")
      .update({ is_approved: true })
      .eq("id", shop.id)
      .then(function(res) {
        console.log("[admin] approve result:", res);
        if (res.error) {
          console.error("[admin] approve error:", res.error);
          msgEl.textContent = "エラー: " + res.error.message;
          msgEl.classList.remove("hidden");
          approveBtn.disabled = false;
          deleteBtn.disabled = false;
          approveBtn.textContent = "承認する";
        } else {
          removeCard(card);
        }
      });
  });

  deleteBtn.addEventListener("click", function() {
    if (!confirm("削除しますか?")) { return; }
    console.log("[admin] delete id:", shop.id);
    approveBtn.disabled = true;
    deleteBtn.disabled = true;
    deleteBtn.textContent = "処理中...";

    db.from("shops")
      .delete()
      .eq("id", shop.id)
      .then(function(res) {
        console.log("[admin] delete result:", res);
        if (res.error) {
          console.error("[admin] delete error:", res.error);
          msgEl.textContent = "エラー: " + res.error.message;
          msgEl.classList.remove("hidden");
          approveBtn.disabled = false;
          deleteBtn.disabled = false;
          deleteBtn.textContent = "削除する";
        } else {
          removeCard(card);
        }
      });
  });

  var btnRow = document.createElement("div");
  btnRow.className = "flex gap-3 mt-4";
  btnRow.appendChild(approveBtn);
  btnRow.appendChild(deleteBtn);

  card.appendChild(name);
  card.appendChild(addr);
  card.appendChild(date);
  card.appendChild(btnRow);
  card.appendChild(msgEl);

  return card;
}

// ---- カード削除 ----
function removeCard(card) {
  card.style.opacity = "0";
  card.style.transition = "opacity 0.3s";
  setTimeout(function() {
    if (card.parentNode) {
      card.parentNode.removeChild(card);
    }
    remaining = remaining - 1;
    countBadge.textContent = remaining + "件";
    if (remaining <= 0) {
      emptyText.classList.remove("hidden");
    }
  }, 300);
}
