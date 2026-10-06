(function () {
  var MAIL_API = "https://nae-diary-notify.jjinytm.workers.dev";
  var MAIL_HEADERS = {
    "Content-Type": "application/json",
    "X-Diary-Sync": "575dc6f9f6eafc1d4246ca0c4991655e",
  };
  var MAIL_BADGE_KEY = "mailDockHasNew";
  var MAIL_VISIT_KEY = "mailDockClearedAt";
  var MAIL_NOTIFIED_KEY = "mailDockNotifiedAt";
  var MAIL_CHECK_MS = 10 * 60 * 1000;

  var appIcon = function (id, from, to, glyph) {
    return '<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="6" y1="2" x2="26" y2="30" gradientUnits="userSpaceOnUse"><stop stop-color="' + from + '"/><stop offset="1" stop-color="' + to + '"/></linearGradient></defs><rect x="1" y="1" width="30" height="30" rx="9" fill="url(#' + id + ')"/>' + glyph + "</svg>";
  };
  var home = {
    href: "/",
    label: "홈",
    icon: appIcon("dock-home", "#FF6B2C", "#C0124A", '<path fill="#fff" d="M7.4 15.5 16 8.2l8.6 7.3V23.4c0 .6-.5 1.1-1.1 1.1H8.5c-.6 0-1.1-.5-1.1-1.1V15.5z"/><rect x="14.2" y="18.4" width="3.6" height="6.1" rx="1.2" fill="#9F1239"/>')
  };
  var movable = [
    {
      href: "/schools",
      label: "학교 정보",
      icon: appIcon("dock-school", "#A855F7", "#312E81", '<path fill="#fff" d="M6.2 14.2 16 8.2l9.8 6H6.2z"/><rect x="8" y="14.4" width="16" height="8.6" rx="1.6" fill="#fff"/><circle cx="11.4" cy="17.6" r="1.05" fill="#4C1D95"/><circle cx="20.6" cy="17.6" r="1.05" fill="#4C1D95"/><rect x="14.5" y="17.2" width="3" height="5.8" rx="1" fill="#4C1D95"/>')
    },
    {
      href: "/calendar",
      label: "입학설명회 일정",
      icon: appIcon("dock-cal", "#22D3EE", "#1D4ED8", '<rect x="8" y="9.2" width="16" height="14" rx="2.6" fill="#fff"/><rect x="11" y="6.6" width="1.8" height="4.2" rx=".9" fill="#fff"/><rect x="19.2" y="6.6" width="1.8" height="4.2" rx=".9" fill="#fff"/><circle cx="12.4" cy="16.2" r="1.05" fill="#1E3A8A"/><circle cx="16" cy="16.2" r="1.05" fill="#1E3A8A"/><circle cx="19.6" cy="16.2" r="1.05" fill="#1E3A8A"/>')
    },
    {
      href: "/todos",
      label: "할일 목록",
      icon: appIcon("dock-todo", "#FACC15", "#047857", '<g transform="rotate(-42 16 16)"><rect x="13.1" y="5.4" width="5.8" height="15.2" rx="1.2" fill="#fff"/><rect x="13.1" y="5.4" width="5.8" height="3.4" rx="1.2" fill="#FDE047"/><path d="M13.1 18.4h5.8L16 24.4z" fill="#fff"/></g>')
    },
    {
      href: "/schedule",
      label: "스케쥴관리",
      icon: appIcon("dock-sched", "#FB7185", "#9F1239", '<rect x="7.2" y="8.4" width="17.6" height="15.2" rx="2.6" fill="#fff"/><rect x="7.2" y="8.4" width="17.6" height="4.4" fill="#FFE4E6"/><rect x="11" y="6.2" width="1.7" height="3.8" rx=".8" fill="#fff"/><rect x="19.3" y="6.2" width="1.7" height="3.8" rx=".8" fill="#fff"/><rect x="10.2" y="15.4" width="5.2" height="1.7" rx=".6" fill="#9F1239"/><rect x="10.2" y="18.6" width="9.2" height="1.7" rx=".6" fill="#9F1239"/>')
    },
    {
      href: "/cards",
      label: "법카사용",
      icon: appIcon("dock-card", "#34D399", "#065F46", '<rect x="6.5" y="10" width="19" height="12.5" rx="2.4" fill="#fff"/><rect x="6.5" y="13.2" width="19" height="3.2" fill="#A7F3D0"/><rect x="9" y="18.2" width="7" height="1.8" rx=".6" fill="#065F46"/><rect x="17.5" y="18.2" width="5" height="1.8" rx=".6" fill="#065F46"/>')
    },
    {
      href: "/mail",
      label: "메일",
      icon: appIcon("dock-mail", "#38BDF8", "#0369A1", '<rect x="6.4" y="9.2" width="19.2" height="13.4" rx="2.4" fill="#fff"/><path fill="#BAE6FD" d="M6.4 11.2 16 17.4 25.6 11.2V10.8c0-.9-.7-1.6-1.6-1.6H8c-.9 0-1.6.7-1.6 1.6v.4z"/><path fill="none" stroke="#0369A1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M7.4 11.4 16 17.2l8.6-5.8"/>')
    },
    {
      href: "/settings",
      label: "설정",
      icon: appIcon(
        "dock-settings",
        "#5BA3A8",
        "#2A5A60",
        '<g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 4)"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></g>'
      )
    },
  ];

  function currentPath() {
    var path = location.pathname.replace(/\/$/, "").replace(/\.html$/, "");
    return path || "/";
  }

  function orderedMovable() {
    var saved = [];
    try {
      saved = JSON.parse(localStorage.getItem("dockOrder") || "[]");
    } catch (error) {
      saved = [];
    }
    if (!Array.isArray(saved)) saved = [];
    var byHref = {};
    movable.forEach(function (item) { byHref[item.href] = item; });
    var ordered = [];
    saved.forEach(function (href) {
      if (byHref[href]) {
        ordered.push(byHref[href]);
        delete byHref[href];
      }
    });
    movable.forEach(function (item) {
      if (byHref[item.href]) ordered.push(item);
    });
    return ordered;
  }

  function createItem(item, path, draggable) {
    var el = document.createElement("a");
    el.className = "mac-dock-item";
    el.href = item.href;
    el.setAttribute("aria-label", item.label);
    if (path === item.href) el.setAttribute("aria-current", "page");
    if (draggable) el.draggable = true;
    var icon = document.createElement("span");
    icon.className = "mac-dock-icon";
    icon.innerHTML = item.icon;
    icon.setAttribute("aria-hidden", "true");
    var tip = document.createElement("span");
    tip.className = "mac-tip";
    tip.textContent = item.label;
    el.append(icon, tip);
    if (item.href === "/mail") {
      var badge = document.createElement("span");
      badge.className = "mac-dock-badge";
      badge.hidden = true;
      badge.setAttribute("aria-hidden", "true");
      el.appendChild(badge);
    }
    return el;
  }

  function mailDockItem() {
    return document.querySelector('#mac-dock .mac-dock-item[href="/mail"]');
  }

  function paintMailBadge(on) {
    var el = mailDockItem();
    if (!el) return;
    var badge = el.querySelector(".mac-dock-badge");
    if (!badge) return;
    badge.hidden = !on;
    if (on) {
      el.setAttribute("data-mail-badge", "1");
      el.setAttribute("aria-label", "메일 (새 메일)");
    } else {
      el.removeAttribute("data-mail-badge");
      el.setAttribute("aria-label", "메일");
    }
  }

  function readBadgeFlag() {
    try {
      return localStorage.getItem(MAIL_BADGE_KEY) === "1";
    } catch (error) {
      return false;
    }
  }

  function markMailBadge() {
    try { localStorage.setItem(MAIL_BADGE_KEY, "1"); } catch (error) {}
    if (currentPath() !== "/mail") paintMailBadge(true);
  }

  function clearMailBadge() {
    var now = new Date().toISOString();
    try {
      localStorage.setItem(MAIL_BADGE_KEY, "0");
      localStorage.setItem(MAIL_VISIT_KEY, now);
      localStorage.setItem(MAIL_NOTIFIED_KEY, now);
    } catch (error) {}
    paintMailBadge(false);
  }

  function ensureVisitBaseline(messages) {
    try {
      if (localStorage.getItem(MAIL_VISIT_KEY)) return;
      var latest = "";
      (messages || []).forEach(function (item) {
        if (item.createdAt && item.createdAt > latest) latest = item.createdAt;
      });
      var baseline = latest || new Date().toISOString();
      localStorage.setItem(MAIL_VISIT_KEY, baseline);
      if (!localStorage.getItem(MAIL_NOTIFIED_KEY)) {
        localStorage.setItem(MAIL_NOTIFIED_KEY, baseline);
      }
    } catch (error) {}
  }

  function hasNewSinceVisit(messages) {
    var clearedAt = "";
    try { clearedAt = localStorage.getItem(MAIL_VISIT_KEY) || ""; } catch (error) {}
    if (!clearedAt) return false;
    return (messages || []).some(function (item) {
      return item.createdAt && item.createdAt > clearedAt;
    });
  }

  function messagesSince(messages, since) {
    return (messages || []).filter(function (item) {
      return item.createdAt && (!since || item.createdAt > since);
    });
  }

  function registerMailServiceWorker() {
    if (!("serviceWorker" in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.register("/sw.js").catch(function () {
      return null;
    });
  }

  async function ensureMailNotifyPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    try {
      var result = await Notification.requestPermission();
      return result === "granted";
    } catch (error) {
      return false;
    }
  }

  async function notifyNewMail(messages, opts) {
    opts = opts || {};
    if (currentPath() === "/mail") return;
    if (!("Notification" in window)) return;
    if (!(await ensureMailNotifyPermission())) return;

    var notifiedAt = "";
    var clearedAt = "";
    try {
      notifiedAt = localStorage.getItem(MAIL_NOTIFIED_KEY) || "";
      clearedAt = localStorage.getItem(MAIL_VISIT_KEY) || "";
    } catch (error) {}
    var since = notifiedAt && clearedAt
      ? (notifiedAt > clearedAt ? notifiedAt : clearedAt)
      : (notifiedAt || clearedAt);

    var fresh = messagesSince(messages, since);
    var count = Number(opts.count) || fresh.length;
    if (!count) return;

    var title = count === 1 && fresh[0]
      ? (fresh[0].subject || "새 메일")
      : "새 메일 " + count + "통";
    var body = count === 1 && fresh[0]
      ? (fresh[0].fromAddr || "받은편지함에 새 메일이 있습니다.")
      : (fresh.slice(0, 3).map(function (item) {
          return item.subject || "(제목 없음)";
        }).join(" · ") || "받은편지함에 새 메일이 있습니다.");

    var latest = since || "";
    fresh.forEach(function (item) {
      if (item.createdAt && item.createdAt > latest) latest = item.createdAt;
    });
    if (!latest) latest = new Date().toISOString();
    try { localStorage.setItem(MAIL_NOTIFIED_KEY, latest); } catch (error) {}

    var options = {
      body: body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: "nae-diary-mail",
      renotify: true,
      data: { url: "/mail" },
    };

    try {
      if ("serviceWorker" in navigator) {
        var reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, options);
        return;
      }
    } catch (error) {}
    try {
      new Notification(title, options);
    } catch (error) {}
  }

  async function loadInboxMessages() {
    var listRes = await fetch(MAIL_API + "/mail?folder=inbox", { headers: MAIL_HEADERS });
    if (!listRes.ok) return [];
    var listData = await listRes.json();
    return listData.messages || [];
  }

  async function syncAndCheckMailBadge() {
    if (currentPath() === "/mail") {
      clearMailBadge();
      return;
    }
    var imported = 0;
    try {
      var syncRes = await fetch(MAIL_API + "/mail/sync", {
        method: "POST",
        headers: MAIL_HEADERS,
        body: "{}",
      });
      var syncData = await syncRes.json().catch(function () { return {}; });
      if (syncRes.ok) imported = Number(syncData.imported) || 0;
    } catch (error) {}

    try {
      var messages = await loadInboxMessages();
      ensureVisitBaseline(messages);
      if (imported > 0 || hasNewSinceVisit(messages)) {
        markMailBadge();
        await notifyNewMail(messages, { count: imported || undefined });
      } else if (readBadgeFlag()) {
        paintMailBadge(true);
      } else {
        paintMailBadge(false);
      }
    } catch (error) {
      if (imported > 0) {
        markMailBadge();
        await notifyNewMail([], { count: imported });
      }
    }
  }

  function refreshMailBadgeFromStorage() {
    if (currentPath() === "/mail") {
      clearMailBadge();
      return;
    }
    paintMailBadge(readBadgeFlag());
  }

  function saveOrder(nav) {
    var hrefs = [];
    nav.querySelectorAll(".mac-dock-item[draggable='true']").forEach(function (el) {
      hrefs.push(el.getAttribute("href"));
    });
    localStorage.setItem("dockOrder", JSON.stringify(hrefs));
  }

  function enableDrag(nav) {
    var dragging = null;
    nav.querySelectorAll(".mac-dock-item[draggable='true']").forEach(function (el) {
      el.addEventListener("dragstart", function (event) {
        dragging = el;
        el.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", el.getAttribute("href"));
      });
      el.addEventListener("dragover", function (event) {
        if (!dragging || dragging === el) return;
        event.preventDefault();
        var rect = el.getBoundingClientRect();
        var after = event.clientY > rect.top + rect.height / 2;
        nav.insertBefore(dragging, after ? el.nextSibling : el);
      });
      el.addEventListener("dragend", function () {
        el.classList.remove("is-dragging");
        dragging = null;
        saveOrder(nav);
      });
    });
  }

  var moonIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M14.6 3.1a7.6 7.6 0 1 0 6.4 11.7A6.7 6.7 0 0 1 14.6 3.1z"/></svg>';
  var sunIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="3.2" fill="currentColor"/><path stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 3.1v2.1M12 18.8V21M3.1 12h2.1M18.8 12H21M6 6l1.5 1.5M16.5 16.5 18 18M18 6l-1.5 1.5M7.5 16.5 6 18"/></svg>';

  function themeIsDark() {
    return document.documentElement.classList.contains("theme-dark");
  }

  function paintThemeButton(button) {
    var on = themeIsDark();
    button.setAttribute("aria-pressed", on ? "true" : "false");
    button.setAttribute("aria-label", on ? "라이트 테마" : "다크 테마");
    button.querySelector(".mac-dock-icon").innerHTML = on ? sunIcon : moonIcon;
    button.querySelector(".mac-tip").textContent = on ? "라이트 테마" : "다크 테마";
  }

  function setTheme(on) {
    try { localStorage.setItem("theme", on ? "dark" : "light"); } catch (error) {}
    document.documentElement.classList.toggle("theme-dark", on);
    var button = document.getElementById("theme-toggle");
    if (button) paintThemeButton(button);
  }

  function createThemeToggle() {
    var button = document.createElement("button");
    button.type = "button";
    button.id = "theme-toggle";
    button.className = "mac-dock-theme";
    var icon = document.createElement("span");
    icon.className = "mac-dock-icon";
    var tip = document.createElement("span");
    tip.className = "mac-tip";
    button.append(icon, tip);
    paintThemeButton(button);
    button.addEventListener("click", function () { setTheme(!themeIsDark()); });
    return button;
  }

  function mount() {
    if (document.getElementById("mac-dock")) return;
    var nav = document.createElement("nav");
    nav.id = "mac-dock";
    nav.className = "mac-dock";
    nav.setAttribute("aria-label", "메뉴");
    var path = currentPath();
    nav.appendChild(createItem(home, path, false));
    var rule = document.createElement("span");
    rule.className = "mac-dock-rule";
    nav.appendChild(rule);
    orderedMovable().forEach(function (item) {
      nav.appendChild(createItem(item, path, true));
    });
    enableDrag(nav);
    nav.appendChild(createThemeToggle());
    document.body.appendChild(nav);
    if (path === "/mail") clearMailBadge();
    else refreshMailBadgeFromStorage();
  }

  mount();
  new MutationObserver(function () {
    mount();
  }).observe(document.body, { childList: true });
  new MutationObserver(function () {
    var button = document.getElementById("theme-toggle");
    if (button) paintThemeButton(button);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  window.addEventListener("mail-badge-new", markMailBadge);
  window.addEventListener("mail-badge-clear", clearMailBadge);
  window.addEventListener("storage", function (event) {
    if (event.key === MAIL_BADGE_KEY) refreshMailBadgeFromStorage();
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refreshMailBadgeFromStorage();
  });

  setTimeout(function () {
    registerMailServiceWorker()
      .then(function () { return ensureMailNotifyPermission(); })
      .then(function () { return syncAndCheckMailBadge(); })
      .catch(function () {});
  }, 2500);
  setInterval(function () {
    syncAndCheckMailBadge().catch(function () {});
  }, MAIL_CHECK_MS);
})();
