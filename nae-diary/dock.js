(function () {
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
    return el;
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
  }

  mount();
  new MutationObserver(function () {
    mount();
  }).observe(document.body, { childList: true });
  new MutationObserver(function () {
    var button = document.getElementById("theme-toggle");
    if (button) paintThemeButton(button);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
})();
