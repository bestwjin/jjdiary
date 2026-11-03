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
  var accountLabels = { daum: "다음", works: "스마트워크", naver: "네이버", gmail: "Gmail" };
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
  var translateBtn = document.getElementById("mail-translate");
  var translateSeq = 0;
  var translationCache = {};
  var translatedView = null;

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

  function sanitizeMailHtml(html) {
    return String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/\bon\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  }

  function wrapMailHtmlForViewer(html) {
    var cleaned = sanitizeMailHtml(html);
    if (/<html[\s>]/i.test(cleaned)) return cleaned;
    return (
      "<!DOCTYPE html><html><head><meta charset=\"utf-8\">" +
      "<base target=\"_blank\">" +
      "<style>body{font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.7;color:#1e293b;margin:12px;word-break:break-word}" +
      "img{max-width:100%;height:auto}a{color:#2563eb}</style></head><body>" +
      cleaned +
      "</body></html>"
    );
  }

  function resizeMailHtmlFrame(iframe) {
    try {
      var doc = iframe.contentDocument;
      if (!doc) return;
      var h = Math.max(doc.documentElement.scrollHeight, doc.body ? doc.body.scrollHeight : 0);
      iframe.style.height = Math.min(Math.max(h + 12, 120), 4000) + "px";
    } catch (err) {}
  }

  function looksLikeMailHtml(value) {
    var text = String(value || "");
    if (!text) return false;
    return /<(?:!--|!\[if|html|head|body|div|p|table|tr|td|th|br|span|img|a|style|center|font|h[1-6])\b/i.test(text);
  }

  function setMailReaderBody(bodyEl, item) {
    bodyEl.innerHTML = "";
    bodyEl.classList.remove("mail-reader-body--html");
    var html = item.bodyHtml && String(item.bodyHtml).trim();
    var plain = item.body && String(item.body).trim();
    if (!html && looksLikeMailHtml(plain)) {
      html = plain;
      plain = "";
    }
    if (!html && !plain) {
      bodyEl.textContent = "(내용 없음)";
      return;
    }
    if (html) {
      bodyEl.classList.add("mail-reader-body--html");
      var iframe = document.createElement("iframe");
      iframe.className = "mail-reader-html-frame";
      iframe.setAttribute("sandbox", "allow-same-origin allow-popups");
      iframe.setAttribute("title", "메일 본문");
      iframe.srcdoc = wrapMailHtmlForViewer(html);
      bodyEl.appendChild(iframe);
      iframe.addEventListener("load", function () {
        resizeMailHtmlFrame(iframe);
      });
      return;
    }
    bodyEl.textContent = plain;
  }

  function resetTranslation() {
    translateSeq += 1;
    translatedView = null;
    translateBtn.hidden = true;
    translateBtn.disabled = false;
    translateBtn.textContent = "번역";
  }

  function decodeEntities(value) {
    return String(value || "")
      .replace(/&#(\d+);/g, function (_, code) { return String.fromCharCode(Number(code)); })
      .replace(/&#x([0-9a-f]+);/gi, function (_, code) { return String.fromCharCode(parseInt(code, 16)); })
      .replace(/&quot;/g, "\"")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }

  function detectSourceLang(text) {
    if (/[\u3040-\u30ff]/.test(text)) return "ja";
    if (/[\u0400-\u04FF]/.test(text)) return "ru";
    if (/[\u4e00-\u9fff]/.test(text)) return "zh-CN";
    return "en";
  }

  function needsKorean(text) {
    var core = String(text || "").trim();
    if (core.length < 2) return false;
    if (/^https?:\/\/\S+$/i.test(core)) return false;
    if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(core)) return false;
    if (/^[\d\s.,:/\-+%$₩#()]+$/.test(core)) return false;
    var hangul = (core.match(/[가-힣]/g) || []).length;
    var foreign = (core.match(/[A-Za-z\u00C0-\u024F\u0400-\u04FF\u3040-\u30ff\u4e00-\u9fff]/g) || []).length;
    if (!foreign) return false;
    return hangul <= foreign;
  }

  function splitKeepSpace(value) {
    var match = String(value || "").match(/^(\s*)([\s\S]*?)(\s*)$/);
    return { lead: match[1], core: match[2], tail: match[3] };
  }

  function chunkText(text, maxBytes) {
    var encoder = new TextEncoder();
    if (encoder.encode(text).length <= maxBytes) return [text];
    var chunks = [];
    var rest = text;
    while (rest) {
      if (encoder.encode(rest).length <= maxBytes) {
        chunks.push(rest);
        break;
      }
      var end = rest.length;
      var slice = rest;
      while (encoder.encode(slice).length > maxBytes && end > 1) {
        end = Math.max(1, Math.floor(end * 0.85));
        slice = rest.slice(0, end);
      }
      var cut = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(". "), slice.lastIndexOf(" "), slice.lastIndexOf("。"));
      if (cut > 20) slice = rest.slice(0, cut + 1);
      chunks.push(slice);
      rest = rest.slice(slice.length);
    }
    return chunks;
  }

  function translatePiece(text) {
    var key = detectSourceLang(text) + "\n" + text;
    if (translationCache[key]) return Promise.resolve(translationCache[key]);
    var url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text) + "&langpair=" + encodeURIComponent(detectSourceLang(text) + "|ko");
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error("translate");
      return response.json();
    }).then(function (data) {
      var translated = data && data.responseData && data.responseData.translatedText;
      if (!translated || data.responseStatus !== 200 || /MYMEMORY WARNING/i.test(translated) || data.quotaFinished) {
        var quota = data && (data.quotaFinished || /MYMEMORY WARNING/i.test(translated || ""));
        throw new Error(quota ? "quota" : "translate");
      }
      translated = decodeEntities(translated);
      translationCache[key] = translated;
      return translated;
    });
  }

  function translateText(text) {
    var chunks = chunkText(text, 420);
    return Promise.all(chunks.map(translatePiece)).then(function (parts) {
      return parts.join("");
    });
  }

  function mapPool(items, limit, fn) {
    var index = 0;
    var results = new Array(items.length);
    function worker() {
      if (index >= items.length) return Promise.resolve();
      var current = index++;
      return Promise.resolve(fn(items[current], current)).then(function (value) {
        results[current] = value;
        return worker();
      });
    }
    var workers = [];
    var count = Math.min(limit, items.length);
    for (var i = 0; i < count; i++) workers.push(worker());
    return Promise.all(workers).then(function () { return results; });
  }

  function readerTextRoot() {
    var bodyEl = document.getElementById("mail-reader-body");
    var iframe = bodyEl.querySelector("iframe");
    if (!iframe) return Promise.resolve(bodyEl);
    if (iframe.contentDocument && iframe.contentDocument.body) return Promise.resolve(iframe.contentDocument.body);
    return new Promise(function (resolve) {
      iframe.addEventListener("load", function () {
        resolve(iframe.contentDocument && iframe.contentDocument.body ? iframe.contentDocument.body : bodyEl);
      }, { once: true });
    });
  }

  function collectTextNodes(root) {
    var doc = root.ownerDocument || document;
    var walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        var tag = parent.tagName;
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
        if (!needsKorean(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    var nodes = [];
    var node;
    while ((node = walker.nextNode())) nodes.push(node);
    return nodes;
  }

  function restoreTranslation() {
    if (!translatedView) return;
    document.getElementById("mail-reader-subject").textContent = translatedView.subject;
    translatedView.nodes.forEach(function (entry) {
      entry.node.nodeValue = entry.value;
    });
    var iframe = document.querySelector("#mail-reader-body iframe");
    if (iframe) resizeMailHtmlFrame(iframe);
    translatedView = null;
    translateBtn.disabled = false;
    translateBtn.textContent = "번역";
  }

  function showTranslated(subjectEl, nodes, translations) {
    var subjectBefore = subjectEl.textContent;
    var originals = nodes.map(function (node) { return node.nodeValue; });
    var changed = false;
    if (translations[0]) {
      var subjectParts = splitKeepSpace(subjectBefore);
      subjectEl.textContent = subjectParts.lead + translations[0] + subjectParts.tail;
      changed = true;
    }
    nodes.forEach(function (node, index) {
      var translated = translations[index + 1];
      if (!translated) return;
      var parts = splitKeepSpace(originals[index]);
      node.nodeValue = parts.lead + translated + parts.tail;
      changed = true;
    });
    if (!changed) return false;
    translatedView = {
      subject: subjectBefore,
      nodes: nodes.map(function (node, index) {
        return { node: node, value: originals[index] };
      }),
    };
    var iframe = document.querySelector("#mail-reader-body iframe");
    if (iframe) resizeMailHtmlFrame(iframe);
    translateBtn.disabled = false;
    translateBtn.textContent = "원문";
    return true;
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

  var pageEl = document.querySelector(".mail-page");
  var mobileMail = window.matchMedia("(max-width: 760px)");

  function mailScreenOpen() {
    return !reader.hidden || !compose.hidden;
  }

  function syncMailScreen() {
    pageEl.classList.toggle("is-reading", mobileMail.matches && mailScreenOpen());
  }

  function rememberReading() {
    if (!mobileMail.matches || (history.state && history.state.mailReading)) return;
    history.pushState({ mailReading: true }, "");
  }

  function exitReading() {
    if (mobileMail.matches && history.state && history.state.mailReading) {
      history.back();
      return;
    }
    showDetailEmpty();
  }

  function showDetailEmpty() {
    resetTranslation();
    composing = false;
    draftId = null;
    selectedId = null;
    detailEmpty.hidden = false;
    reader.hidden = true;
    compose.hidden = true;
    paintList();
    syncMailScreen();
  }

  function openCompose(opts) {
    opts = opts || {};
    resetTranslation();
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
    rememberReading();
    syncMailScreen();
    if (!mobileMail.matches) toInput.focus();
  }

  async function openMessage(id) {
    var item = null;
    messages.forEach(function (row) {
      if (String(row.id) === String(id)) item = row;
    });
    if (!item) return;
    resetTranslation();
    composing = false;
    draftId = null;
    selectedId = item.id;
    detailEmpty.hidden = true;
    compose.hidden = true;
    reader.hidden = false;
    translateBtn.hidden = item.folder !== "inbox";
    document.getElementById("mail-reader-subject").textContent = item.subject || "(제목 없음)";
    document.getElementById("mail-reader-from").textContent = item.fromAddr || "";
    document.getElementById("mail-reader-to").textContent = item.toAddr || "";
    document.getElementById("mail-reader-date").textContent =
      formatDate(item.createdAt) + (item.account ? " · " + (accountLabels[item.account] || item.account) : "");
    setMailReaderBody(document.getElementById("mail-reader-body"), item);
    paintList();
    rememberReading();
    syncMailScreen();
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
    try {
      localStorage.setItem("mailDockHasNew", "0");
      localStorage.setItem("mailDockClearedAt", new Date().toISOString());
    } catch (err) {}
    window.dispatchEvent(new Event("mail-badge-clear"));
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

  document.getElementById("mail-back").addEventListener("click", exitReading);
  document.getElementById("mail-compose-close").addEventListener("click", exitReading);
  window.addEventListener("popstate", function () {
    if (!mobileMail.matches || (history.state && history.state.mailReading)) return;
    if (!mailScreenOpen()) return;
    showDetailEmpty();
  });
  window.addEventListener("resize", syncMailScreen);

  translateBtn.addEventListener("click", function () {
    if (translateBtn.disabled) return;
    if (translatedView) {
      restoreTranslation();
      return;
    }
    var seq = translateSeq;
    var id = selectedId;
    var subjectEl = document.getElementById("mail-reader-subject");
    translateBtn.disabled = true;
    translateBtn.textContent = "번역 중";
    readerTextRoot().then(function (root) {
      if (seq !== translateSeq || String(selectedId) !== String(id)) return null;
      var nodes = collectTextNodes(root);
      var subjectCore = needsKorean(subjectEl.textContent) ? splitKeepSpace(subjectEl.textContent).core : "";
      var jobs = [subjectCore].concat(nodes.map(function (node) {
        return splitKeepSpace(node.nodeValue).core;
      }));
      var unique = [];
      jobs.forEach(function (text) {
        if (text && unique.indexOf(text) < 0) unique.push(text);
      });
      if (!unique.length) {
        translateBtn.disabled = false;
        translateBtn.textContent = "한국어";
        setTimeout(function () {
          if (translateBtn.textContent === "한국어" && !translatedView) translateBtn.textContent = "번역";
        }, 1200);
        return null;
      }
      return mapPool(unique, 4, function (text) {
        return translateText(text).catch(function (err) {
          if (err && err.message === "quota") throw err;
          return null;
        });
      }).then(function (values) {
        if (seq !== translateSeq || String(selectedId) !== String(id)) return;
        var map = {};
        unique.forEach(function (text, index) { map[text] = values[index]; });
        var translations = jobs.map(function (text) { return text ? (map[text] || null) : null; });
        if (!showTranslated(subjectEl, nodes, translations)) {
          translateBtn.disabled = false;
          translateBtn.textContent = "번역";
          showError("번역에 실패했습니다.");
        }
      });
    }).catch(function (err) {
      if (seq !== translateSeq) return;
      translateBtn.disabled = false;
      translateBtn.textContent = "번역";
      showError(err && err.message === "quota" ? "번역 한도를 초과했습니다. 잠시 후 다시 시도하세요." : "번역에 실패했습니다.");
    });
  });

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
      exitReading();
      await loadMessages();
    } catch (err) {
      showError("메일을 삭제하지 못했습니다.");
    }
  });

  async function syncInbox(opts) {
    opts = opts || {};
    var response = await fetch(API + "/mail/sync", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ account: currentAccount || undefined }),
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var message = (data.message || "메일 받기에 실패했습니다.") + (data.detail ? " (" + data.detail + ")" : "");
      if (!opts.silent) showError(message);
      return { ok: false, message: message };
    }
    await loadMessages();
    try {
      localStorage.setItem("mailDockHasNew", "0");
      localStorage.setItem("mailDockClearedAt", new Date().toISOString());
    } catch (err) {}
    window.dispatchEvent(new Event("mail-badge-clear"));
    if (!opts.silent) showOk(data.message || "받은편지함을 새로고침했습니다.");
    return { ok: true, message: data.message || "", imported: Number(data.imported) || 0 };
  }

  var refreshBtn = document.getElementById("mail-refresh");
  var loadingEl = document.getElementById("mail-loading");

  function setMailLoading(on) {
    loadingEl.hidden = !on;
    refreshBtn.disabled = on;
    refreshBtn.textContent = on ? "받는 중" : "받기";
  }

  refreshBtn.addEventListener("click", async function () {
    if (refreshBtn.disabled) return;
    showError("");
    setMailLoading(true);
    try {
      await syncInbox();
    } catch (err) {
      showError("메일 받기에 실패했습니다.");
    } finally {
      setMailLoading(false);
    }
  });

  setInterval(function () {
    if (document.hidden) return;
    syncInbox({ silent: true }).catch(function () {});
  }, 10 * 60 * 1000);

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
      exitReading();
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
      exitReading();
      await loadMessages();
    } catch (err) {
      showError(err.message === "settings" ? "설정에서 해당 계정 연동 정보를 먼저 입력하세요." : "메일 전송에 실패했습니다. 연동 설정을 확인하세요.");
    }
  });

  loadMessages().catch(function () {
    showError("메일을 불러오지 못했습니다.");
  });
})();
