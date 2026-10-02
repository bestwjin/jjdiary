(function () {
  var API = "https://nae-diary-notify.jjinytm.workers.dev";
  var headers = {
    "Content-Type": "application/json",
    "X-Diary-Sync": "575dc6f9f6eafc1d4246ca0c4991655e",
  };
  var folders = {
    inbox: "받은편지함",
    sent: "보낸편지함",
    drafts: "임시보관함",
    trash: "휴지통",
  };
  var accountLabels = { daum: "다음", naver: "네이버", gmail: "Gmail" };
  var messages = [];
  var counts = { inbox: 0, sent: 0, drafts: 0, trash: 0 };
  var accounts = [];
  var currentFolder = "inbox";
  var currentAccount = "";
  var selectedId = null;
  var composing = false;
  var draftId = null;
  var account = { address: "", displayName: "", configured: false };

  var listEl = document.getElementById("mail-list");
  var emptyEl = document.getElementById("mail-empty");
  var errorEl = document.getElementById("mail-error");
  var titleEl = document.getElementById("mail-list-title");
  var searchEl = document.getElementById("mail-search");
  var accountAddr = document.getElementById("mail-account-addr");
  var detailEmpty = document.getElementById("mail-detail-empty");
  var reader = document.getElementById("mail-reader");
  var compose = document.getElementById("mail-compose");
  var composeTitle = document.getElementById("mail-compose-title");
  var fromAccount = document.getElementById("mail-from-account");
  var toInput = document.getElementById("mail-to");
  var subjectInput = document.getElementById("mail-subject");
  var bodyInput = document.getElementById("mail-body");

  function showError(message) {
    errorEl.hidden = !message;
    errorEl.style.color = "";
    errorEl.textContent = message || "";
  }

  function showOk(message) {
    errorEl.hidden = !message;
    errorEl.style.color = "#0c8f55";
    errorEl.textContent = message || "";
    setTimeout(function () {
      errorEl.style.color = "";
      showError("");
    }, 2400);
  }

  function formatDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char];
    });
  }

  function updateCounts() {
    Object.keys(folders).forEach(function (folder) {
      var el = document.querySelector('[data-count="' + folder + '"]');
      if (!el) return;
      var n = counts[folder] || 0;
      el.textContent = n ? String(n) : "";
      el.hidden = !n;
    });
  }

  function updateAccount() {
    if (account.address) {
      accountAddr.textContent = account.displayName
        ? account.displayName + " <" + account.address + ">"
        : account.address;
    } else {
      accountAddr.textContent = "설정에서 다음/네이버/Gmail을 연동하세요";
    }
    var enabled = accounts.filter(function (item) { return item.enabled; });
    Array.prototype.forEach.call(fromAccount.options, function (opt) {
      var found = accounts.find(function (item) { return item.id === opt.value; });
      opt.disabled = !(found && found.enabled);
      opt.textContent = accountLabels[opt.value] + (found && found.address ? " · " + found.address : "");
    });
    if (enabled.length) {
      if (!enabled.some(function (item) { return item.id === fromAccount.value; })) {
        fromAccount.value = enabled[0].id;
      }
    }
  }

  function filteredMessages() {
    var q = searchEl.value.trim().toLowerCase();
    return messages.filter(function (item) {
      if (item.folder !== currentFolder) return false;
      if (!q) return true;
      return [item.subject, item.fromAddr, item.toAddr, item.body, accountLabels[item.account] || ""]
        .join(" ")
        .toLowerCase()
        .indexOf(q) >= 0;
    });
  }

  function paintList() {
    var label = folders[currentFolder] || currentFolder;
    if (currentAccount) label += " · " + (accountLabels[currentAccount] || currentAccount);
    titleEl.textContent = label;
    var rows = filteredMessages();
    listEl.innerHTML = "";
    emptyEl.hidden = rows.length > 0;
    rows.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "mail-item" + (item.isRead ? "" : " is-unread") + (String(item.id) === String(selectedId) ? " is-active" : "");
      li.dataset.id = item.id;
      var peer = currentFolder === "sent" || currentFolder === "drafts" ? item.toAddr : item.fromAddr;
      var badge = accountLabels[item.account] || item.account || "";
      li.innerHTML =
        '<div class="mail-item-top"><span class="mail-item-from">' + escapeHtml(peer || "(주소 없음)") +
        '</span><span class="mail-item-date">' + escapeHtml(formatDate(item.createdAt)) +
        '</span></div><div class="mail-item-subject">' + escapeHtml(item.subject || "(제목 없음)") +
        '</div><div class="mail-item-preview"><span class="mail-item-account">' + escapeHtml(badge) +
        "</span> " + escapeHtml(String(item.body || "").replace(/\s+/g, " ").slice(0, 80)) + "</div>";
      listEl.appendChild(li);
    });
  }

  function showDetailEmpty() {
    composing = false;
    draftId = null;
    selectedId = null;
    detailEmpty.hidden = false;
    reader.hidden = true;
    compose.hidden = true;
    paintList();
  }

  function openCompose(opts) {
    opts = opts || {};
    composing = true;
    draftId = opts.id || null;
    selectedId = null;
    detailEmpty.hidden = true;
    reader.hidden = true;
    compose.hidden = false;
    composeTitle.textContent = opts.id ? "임시보관 메일" : "새 메일";
    if (opts.account && !fromAccount.querySelector('option[value="' + opts.account + '"]').disabled) {
      fromAccount.value = opts.account;
    } else if (currentAccount) {
      fromAccount.value = currentAccount;
    }
    toInput.value = opts.toAddr || "";
    subjectInput.value = opts.subject || "";
    bodyInput.value = opts.body || "";
    paintList();
    toInput.focus();
  }

  async function openMessage(id) {
    var item = null;
    messages.forEach(function (row) {
      if (String(row.id) === String(id)) item = row;
    });
    if (!item) return;
    composing = false;
    draftId = null;
    selectedId = item.id;
    detailEmpty.hidden = true;
    compose.hidden = true;
    reader.hidden = false;
    document.getElementById("mail-reader-subject").textContent = item.subject || "(제목 없음)";
    document.getElementById("mail-reader-from").textContent = item.fromAddr || "";
    document.getElementById("mail-reader-to").textContent = item.toAddr || "";
    document.getElementById("mail-reader-date").textContent =
      formatDate(item.createdAt) + (item.account ? " · " + (accountLabels[item.account] || item.account) : "");
    var bodyEl = document.getElementById("mail-reader-body");
    bodyEl.textContent = item.body && String(item.body).trim() ? item.body : "(내용 없음)";
    paintList();
    if (!item.isRead && item.folder === "inbox") {
      try {
        var response = await fetch(API + "/mail/" + item.id, {
          method: "PUT",
          headers: headers,
          body: JSON.stringify({ isRead: true }),
        });
        if (response.ok) {
          var data = await response.json();
          if (data.message) Object.assign(item, data.message);
          paintList();
        }
      } catch (err) {}
    }
  }

  function mailQuery() {
    var q = "folder=" + encodeURIComponent(currentFolder);
    if (currentAccount) q += "&account=" + encodeURIComponent(currentAccount);
    return q;
  }

  async function loadMessages() {
    showError("");
    var response = await fetch(API + "/mail?" + mailQuery(), { headers: headers });
    if (!response.ok) throw new Error("load");
    var data = await response.json();
    messages = data.messages || [];
    counts = data.counts || counts;
    accounts = data.accounts || accounts;
    account = data.account || account;
    updateCounts();
    updateAccount();
    paintList();
    if (selectedId) {
      var still = messages.some(function (item) { return String(item.id) === String(selectedId); });
      if (!still) showDetailEmpty();
    }
  }

  document.getElementById("mail-account-switch").addEventListener("click", function (event) {
    var button = event.target.closest(".mail-account-chip");
    if (!button) return;
    document.querySelectorAll(".mail-account-chip").forEach(function (el) {
      el.classList.toggle("is-active", el === button);
    });
    currentAccount = button.dataset.account || "";
    showDetailEmpty();
    loadMessages().catch(function () {
      showError("메일을 불러오지 못했습니다.");
    });
  });

  document.getElementById("mail-folders").addEventListener("click", function (event) {
    var button = event.target.closest(".mail-folder");
    if (!button) return;
    document.querySelectorAll(".mail-folder").forEach(function (el) {
      el.classList.toggle("is-active", el === button);
    });
    currentFolder = button.dataset.folder;
    showDetailEmpty();
    loadMessages().catch(function () {
      showError("메일을 불러오지 못했습니다.");
    });
  });

  listEl.addEventListener("click", function (event) {
    var item = event.target.closest(".mail-item");
    if (!item) return;
    var id = item.dataset.id;
    var found = null;
    messages.forEach(function (row) {
      if (String(row.id) === String(id)) found = row;
    });
    if (found && found.folder === "drafts") {
      openCompose(found);
      return;
    }
    openMessage(id);
  });

  searchEl.addEventListener("input", paintList);

  document.getElementById("mail-compose-btn").addEventListener("click", function () {
    openCompose({});
  });

  document.getElementById("mail-compose-close").addEventListener("click", showDetailEmpty);

  document.getElementById("mail-reply").addEventListener("click", function () {
    var item = null;
    messages.forEach(function (row) {
      if (String(row.id) === String(selectedId)) item = row;
    });
    if (!item) return;
    openCompose({
      account: item.account,
      toAddr: item.fromAddr,
      subject: (item.subject || "").indexOf("Re:") === 0 ? item.subject : "Re: " + (item.subject || ""),
      body: "\n\n----- 원본 메일 -----\n보낸사람: " + (item.fromAddr || "") + "\n제목: " + (item.subject || "") + "\n\n" + (item.body || ""),
    });
  });

  document.getElementById("mail-trash").addEventListener("click", async function () {
    if (!selectedId) return;
    showError("");
    try {
      if (currentFolder === "trash") {
        var del = await fetch(API + "/mail/" + selectedId, { method: "DELETE", headers: headers });
        if (!del.ok) throw new Error("delete");
      } else {
        var response = await fetch(API + "/mail/" + selectedId, {
          method: "PUT",
          headers: headers,
          body: JSON.stringify({ folder: "trash" }),
        });
        if (!response.ok) throw new Error("trash");
      }
      showDetailEmpty();
      await loadMessages();
    } catch (err) {
      showError("메일을 삭제하지 못했습니다.");
    }
  });

  document.getElementById("mail-refresh").addEventListener("click", async function () {
    showError("");
    try {
      var response = await fetch(API + "/mail/sync", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ account: currentAccount || undefined }),
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        showError((data.message || "메일 받기에 실패했습니다.") + (data.detail ? " (" + data.detail + ")" : ""));
        return;
      }
      await loadMessages();
      showOk(data.message || "받은편지함을 새로고침했습니다.");
    } catch (err) {
      showError("메일 받기에 실패했습니다.");
    }
  });

  async function saveMail(payload) {
    var response = await fetch(API + "/mail" + (draftId ? "/" + draftId : ""), {
      method: draftId ? "PUT" : "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      var data = await response.json().catch(function () { return {}; });
      throw new Error(data.message || "save");
    }
    return response.json();
  }

  document.getElementById("mail-save-draft").addEventListener("click", async function () {
    showError("");
    try {
      await saveMail({
        account: fromAccount.value,
        folder: "drafts",
        toAddr: toInput.value.trim(),
        subject: subjectInput.value.trim(),
        body: bodyInput.value,
      });
      currentFolder = "drafts";
      document.querySelectorAll(".mail-folder").forEach(function (el) {
        el.classList.toggle("is-active", el.dataset.folder === "drafts");
      });
      showDetailEmpty();
      await loadMessages();
    } catch (err) {
      showError("임시저장에 실패했습니다.");
    }
  });

  compose.addEventListener("submit", async function (event) {
    event.preventDefault();
    showError("");
    if (!toInput.value.trim()) {
      showError("받는사람을 입력하세요.");
      toInput.focus();
      return;
    }
    try {
      await saveMail({
        account: fromAccount.value,
        folder: "sent",
        toAddr: toInput.value.trim(),
        subject: subjectInput.value.trim(),
        body: bodyInput.value,
        send: true,
      });
      currentFolder = "sent";
      document.querySelectorAll(".mail-folder").forEach(function (el) {
        el.classList.toggle("is-active", el.dataset.folder === "sent");
      });
      showDetailEmpty();
      await loadMessages();
    } catch (err) {
      showError(err.message === "settings" ? "설정에서 해당 계정 연동 정보를 먼저 입력하세요." : "메일 전송에 실패했습니다. 연동 설정을 확인하세요.");
    }
  });

  loadMessages().catch(function () {
    showError("메일을 불러오지 못했습니다.");
  });
})();
