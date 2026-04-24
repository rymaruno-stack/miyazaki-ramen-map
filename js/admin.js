var PASSWORD = "Ganya0308";
var remaining = 0;

var authScreen         = document.getElementById("auth-screen");
var mainScreen         = document.getElementById("main-screen");
var pwInput            = document.getElementById("pw-input");
var pwError            = document.getElementById("pw-error");
var loginBtn           = document.getElementById("login-btn");
var loadingText        = document.getElementById("loading-text");
var errorText          = document.getElementById("error-text");
var shopList           = document.getElementById("shop-list");
var countBadge         = document.getElementById("count-badge");
var emptyText          = document.getElementById("empty-text");
var approvedSection    = document.getElementById("approved-section");
var approvedLoadingText= document.getElementById("approved-loading-text");
var approvedErrorText  = document.getElementById("approved-error-text");
var approvedShopList   = document.getElementById("approved-shop-list");
var approvedCountBadge = document.getElementById("approved-count-badge");

// ---- ログイン ----
loginBtn.addEventListener("click", onLogin);
pwInput.addEventListener("keydown", function(e) {
  if (e.key === "Enter") { onLogin(); }
});

function onLogin() {
  if (pwInput.value === PASSWORD) {
    authScreen.classList.add("hidden");
    mainScreen.classList.remove("hidden");
    approvedSection.classList.remove("hidden");
    fetchShops();
    fetchApprovedShops();
  } else {
    pwError.classList.remove("hidden");
    pwInput.value = "";
    pwInput.focus();
  }
}

// ---- 未承認店舗取得 ----
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

// ---- 未承認カード生成 ----
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
          fetchApprovedShops();
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

// ---- 未承認カード削除 ----
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

// ---- 承認済み店舗取得 ----
function fetchApprovedShops() {
  approvedLoadingText.classList.remove("hidden");
  approvedErrorText.classList.add("hidden");
  approvedShopList.innerHTML = "";

  db.from("shops")
    .select("*")
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .then(function(res) {
      approvedLoadingText.classList.add("hidden");

      if (res.error) {
        approvedErrorText.textContent = "取得エラー: " + res.error.message;
        approvedErrorText.classList.remove("hidden");
        return;
      }

      approvedCountBadge.textContent = res.data.length + "件";

      res.data.forEach(function(shop) {
        approvedShopList.appendChild(buildApprovedCard(shop));
      });
    });
}

// ---- 承認済みカード生成 ----
function buildApprovedCard(shop) {
  var card = document.createElement("div");
  card.className = "bg-white rounded-xl border border-gray-200 shadow-sm p-4";

  var nameEl = document.createElement("p");
  nameEl.className = "font-bold text-gray-800 text-base";
  nameEl.textContent = shop.name || "(名称不明)";

  var addrEl = document.createElement("p");
  addrEl.className = "text-xs text-gray-500 mt-1";
  addrEl.textContent = "住所: " + (shop.address || "未入力");

  var btnRowTop = document.createElement("div");
  btnRowTop.className = "flex gap-2 mt-3";

  var editBtn = document.createElement("button");
  editBtn.textContent = "編集する";
  editBtn.className = "bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold py-1.5 px-4 rounded-xl";

  var delBtn = document.createElement("button");
  delBtn.textContent = "削除する";
  delBtn.className = "bg-gray-100 hover:bg-red-100 text-red-500 text-sm font-bold py-1.5 px-4 rounded-xl";

  btnRowTop.appendChild(editBtn);
  btnRowTop.appendChild(delBtn);

  var msgEl = document.createElement("p");
  msgEl.className = "hidden text-xs text-red-500 text-center mt-2";

  var editForm = buildEditForm(shop);
  editForm.classList.add("hidden");

  var cancelBtn = editForm.querySelector(".edit-cancel-btn");
  var saveBtn   = editForm.querySelector(".edit-save-btn");
  var hoursEditor = editForm.querySelector(".hours-editor");

  editBtn.addEventListener("click", function() {
    editForm.classList.remove("hidden");
    btnRowTop.classList.add("hidden");
    msgEl.classList.add("hidden");
  });

  cancelBtn.addEventListener("click", function() {
    editForm.classList.add("hidden");
    btnRowTop.classList.remove("hidden");
    msgEl.classList.add("hidden");
  });

  delBtn.addEventListener("click", function() {
    if (!confirm("本当に削除しますか？")) { return; }
    delBtn.disabled = true;
    editBtn.disabled = true;
    delBtn.textContent = "削除中...";

    db.from("shops")
      .delete()
      .eq("id", shop.id)
      .then(function(res) {
        if (res.error) {
          msgEl.textContent = "エラー: " + res.error.message;
          msgEl.classList.remove("hidden");
          delBtn.disabled = false;
          editBtn.disabled = false;
          delBtn.textContent = "削除する";
        } else {
          card.style.opacity = "0";
          card.style.transition = "opacity 0.3s";
          setTimeout(function() {
            if (card.parentNode) { card.parentNode.removeChild(card); }
            var current = parseInt(approvedCountBadge.textContent, 10) || 0;
            approvedCountBadge.textContent = Math.max(0, current - 1) + "件";
          }, 300);
        }
      });
  });

  saveBtn.addEventListener("click", function() {
    var nameInput  = editForm.querySelector(".edit-name");
    var addrInput  = editForm.querySelector(".edit-address");
    var phoneInput = editForm.querySelector(".edit-phone");
    var instaInput = editForm.querySelector(".edit-instagram");
    var noteInput  = editForm.querySelector(".edit-note");
    var isNewCb    = editForm.querySelector(".edit-is-new");

    var newName = nameInput.value.trim();
    if (!newName) {
      msgEl.textContent = "店名を入力してください";
      msgEl.classList.remove("hidden");
      return;
    }

    msgEl.classList.add("hidden");
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    saveBtn.textContent = "保存中...";

    var newHoursJson = JSON.stringify(getHoursFromEditor(hoursEditor));

    db.from("shops")
      .update({
        name:          newName,
        address:       addrInput.value.trim() || null,
        hours:         newHoursJson,
        phone:         phoneInput.value.trim() || null,
        instagram_url: instaInput.value.trim() || null,
        note:          noteInput.value.trim() || null,
        is_new:        isNewCb.checked,
      })
      .eq("id", shop.id)
      .then(function(res) {
        saveBtn.disabled = false;
        cancelBtn.disabled = false;
        saveBtn.textContent = "保存する";

        if (res.error) {
          msgEl.textContent = "エラー: " + res.error.message;
          msgEl.classList.remove("hidden");
        } else {
          nameEl.textContent = newName;
          addrEl.textContent = "住所: " + (addrInput.value.trim() || "未入力");
          shop.name          = newName;
          shop.address       = addrInput.value.trim() || null;
          shop.hours         = newHoursJson;
          shop.phone         = phoneInput.value.trim() || null;
          shop.instagram_url = instaInput.value.trim() || null;
          shop.note          = noteInput.value.trim() || null;
          shop.is_new        = isNewCb.checked;

          editForm.classList.add("hidden");
          editBtn.classList.remove("hidden");
        }
      });
  });

  card.appendChild(nameEl);
  card.appendChild(addrEl);
  card.appendChild(btnRowTop);
  card.appendChild(editForm);
  card.appendChild(msgEl);

  return card;
}

// ---- 編集フォーム生成 ----
function buildEditForm(shop) {
  var form = document.createElement("div");
  form.className = "mt-4 border-t border-gray-100 pt-4 space-y-3";

  form.appendChild(buildFieldGroup("店名",          "edit-name",      "text", shop.name || ""));
  form.appendChild(buildFieldGroup("住所",          "edit-address",   "text", shop.address || ""));

  // 営業時間
  var hoursLabel = document.createElement("p");
  hoursLabel.className = "text-xs font-bold text-gray-600";
  hoursLabel.textContent = "営業時間";

  var hoursEditor = buildHoursEditor(shop.hours);
  hoursEditor.className = hoursEditor.className + " hours-editor mt-1";

  var hoursGroup = document.createElement("div");
  hoursGroup.appendChild(hoursLabel);
  hoursGroup.appendChild(hoursEditor);
  form.appendChild(hoursGroup);

  form.appendChild(buildFieldGroup("電話番号",      "edit-phone",     "tel", shop.phone || ""));
  form.appendChild(buildFieldGroup("Instagram URL", "edit-instagram", "url", shop.instagram_url || ""));

  // 備考
  var noteLabel = document.createElement("p");
  noteLabel.className = "text-xs font-bold text-gray-600";
  noteLabel.textContent = "備考";

  var noteTextarea = document.createElement("textarea");
  noteTextarea.className = "edit-note w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none mt-1";
  noteTextarea.rows = 2;
  noteTextarea.value = shop.note || "";

  var noteGroup = document.createElement("div");
  noteGroup.appendChild(noteLabel);
  noteGroup.appendChild(noteTextarea);
  form.appendChild(noteGroup);

  // is_new
  var isNewLabel = document.createElement("label");
  isNewLabel.className = "flex items-center gap-2 cursor-pointer select-none";

  var isNewCb = document.createElement("input");
  isNewCb.type = "checkbox";
  isNewCb.className = "edit-is-new w-4 h-4 rounded border-gray-300";
  isNewCb.checked = shop.is_new === true;

  var isNewSpan = document.createElement("span");
  isNewSpan.className = "text-sm text-gray-700";
  isNewSpan.textContent = "NEWバッジを表示";

  isNewLabel.appendChild(isNewCb);
  isNewLabel.appendChild(isNewSpan);
  form.appendChild(isNewLabel);

  // ボタン行
  var btnRow = document.createElement("div");
  btnRow.className = "flex gap-3 pt-1";

  var saveBtn = document.createElement("button");
  saveBtn.textContent = "保存する";
  saveBtn.className = "edit-save-btn flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold py-2 rounded-xl";

  var cancelBtn = document.createElement("button");
  cancelBtn.textContent = "キャンセル";
  cancelBtn.className = "edit-cancel-btn flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold py-2 rounded-xl";

  btnRow.appendChild(saveBtn);
  btnRow.appendChild(cancelBtn);
  form.appendChild(btnRow);

  return form;
}

// ---- フィールドグループ生成 ----
function buildFieldGroup(labelText, inputClass, type, value) {
  var group = document.createElement("div");

  var labelEl = document.createElement("p");
  labelEl.className = "text-xs font-bold text-gray-600";
  labelEl.textContent = labelText;

  var input = document.createElement("input");
  input.type = type;
  input.className = inputClass + " w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 mt-1";
  input.value = value;

  group.appendChild(labelEl);
  group.appendChild(input);

  return group;
}

// ---- 営業時間エディタ生成 ----
function buildHoursEditor(hoursJson) {
  var DAY_KEYS   = ["mon","tue","wed","thu","fri","sat","sun"];
  var DAY_LABELS = {mon:"月", tue:"火", wed:"水", thu:"木", fri:"金", sat:"土", sun:"日"};

  var parsed = {};
  if (hoursJson) {
    try { parsed = JSON.parse(hoursJson); } catch(e) {}
  }

  var container = document.createElement("div");
  container.className = "border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100";

  DAY_KEYS.forEach(function(day) {
    var d = parsed[day] || {};
    var isClosed = d.closed === true;

    var row = document.createElement("div");
    row.className = "flex flex-wrap items-center gap-2 px-3 py-2 bg-white";
    row.setAttribute("data-day", day);

    var dayLabel = document.createElement("span");
    dayLabel.className = "text-sm font-bold text-gray-700 w-5 shrink-0";
    dayLabel.textContent = DAY_LABELS[day];

    var closedLabel = document.createElement("label");
    closedLabel.className = "flex items-center gap-1.5 cursor-pointer shrink-0";

    var closedCb = document.createElement("input");
    closedCb.type = "checkbox";
    closedCb.className = "edit-day-closed w-4 h-4 rounded border-gray-300 cursor-pointer";
    closedCb.checked = isClosed;

    var closedSpan = document.createElement("span");
    closedSpan.className = "text-xs text-gray-500";
    closedSpan.textContent = "定休";

    closedLabel.appendChild(closedCb);
    closedLabel.appendChild(closedSpan);

    var timesDiv = document.createElement("div");
    timesDiv.className = "edit-day-times flex items-center gap-1";
    if (isClosed) {
      timesDiv.classList.add("opacity-30", "pointer-events-none");
    }

    var openInput = document.createElement("input");
    openInput.type = "time";
    openInput.className = "edit-day-open w-[74px] text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400";
    openInput.value = d.open || "";

    var sepSpan = document.createElement("span");
    sepSpan.className = "text-xs text-gray-400";
    sepSpan.textContent = "〜";

    var closeInput = document.createElement("input");
    closeInput.type = "time";
    closeInput.className = "edit-day-close w-[74px] text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400";
    closeInput.value = d.close || "";

    var loSpan = document.createElement("span");
    loSpan.className = "text-xs text-gray-400 ml-2";
    loSpan.textContent = "LO";

    var loInput = document.createElement("input");
    loInput.type = "time";
    loInput.className = "edit-day-lo w-[74px] text-xs border border-gray-200 rounded-lg px-1.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400";
    loInput.value = d.lo || "";

    timesDiv.appendChild(openInput);
    timesDiv.appendChild(sepSpan);
    timesDiv.appendChild(closeInput);
    timesDiv.appendChild(loSpan);
    timesDiv.appendChild(loInput);

    closedCb.addEventListener("change", function() {
      if (closedCb.checked) {
        timesDiv.classList.add("opacity-30", "pointer-events-none");
      } else {
        timesDiv.classList.remove("opacity-30", "pointer-events-none");
      }
    });

    row.appendChild(dayLabel);
    row.appendChild(closedLabel);
    row.appendChild(timesDiv);
    container.appendChild(row);
  });

  return container;
}

// ---- 営業時間エディタからデータ取得 ----
function getHoursFromEditor(container) {
  var DAY_KEYS = ["mon","tue","wed","thu","fri","sat","sun"];
  var result = {};
  DAY_KEYS.forEach(function(day) {
    var row = container.querySelector("[data-day='" + day + "']");
    if (!row) return;
    var closed = row.querySelector(".edit-day-closed").checked;
    if (closed) {
      result[day] = { closed: true };
    } else {
      result[day] = {
        open:   row.querySelector(".edit-day-open").value  || null,
        close:  row.querySelector(".edit-day-close").value || null,
        lo:     row.querySelector(".edit-day-lo").value    || null,
        closed: false,
      };
    }
  });
  return result;
}
