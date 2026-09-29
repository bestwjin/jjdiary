(function () {
  var svg = function (inner) {
    return '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">' + inner + "</svg>";
  };
  var home = {
    href: "/",
    label: "홈",
    icon: svg('<path d="M4.2 11.4 12 5.2l7.8 6.2" fill="none" stroke="#ffd7a8" stroke-width="1.7" stroke-linejoin="round"/><path d="M6.2 10.8V19h11.6v-8.2" fill="#fff"/><path d="M10.5 19v-4.1h3v4.1" fill="#f4a261"/>')
  };
  var movable = [
    {
      href: "/schools",
      label: "학교 정보",
      icon: svg('<path d="M3.8 11 12 6.2 20.2 11 12 15.8z" fill="#8ec5ff"/><rect x="6.2" y="12.2" width="11.6" height="6.6" rx="1.2" fill="#fff"/><rect x="10.7" y="14.4" width="2.6" height="4.4" rx=".4" fill="#4458c4"/><path d="M12 6.2V4" stroke="#ffd166" stroke-width="1.4" stroke-linecap="round"/><circle cx="12" cy="3.3" r="1.15" fill="#ffd166"/>')
    },
    {
      href: "/calendar",
      label: "입학설명회 일정",
      icon: svg('<rect x="4" y="5.2" width="16" height="14.2" rx="2.4" fill="#fff"/><path d="M4 9.4h16v-.2c0-1.3 0-2-.2-2.2A2.4 2.4 0 0 0 17.6 5.2H6.4A2.4 2.4 0 0 0 4 7.6V9.4z" fill="#ff6b6b"/><rect x="8" y="3.6" width="1.5" height="3.2" rx=".7" fill="#ffd7a8"/><rect x="14.5" y="3.6" width="1.5" height="3.2" rx=".7" fill="#ffd7a8"/><circle cx="8.6" cy="13" r="1" fill="#4458c4"/><circle cx="12" cy="13" r="1" fill="#4458c4"/><circle cx="15.4" cy="13" r="1" fill="#4458c4"/><circle cx="8.6" cy="16.2" r="1" fill="#c9d4ff"/><circle cx="12" cy="16.2" r="1" fill="#c9d4ff"/>')
    },
    {
      href: "/todos",
      label: "할일 목록",
      icon: svg('<rect x="5" y="3.4" width="14" height="17.2" rx="2.6" fill="#fff"/><path d="M9.2 8.4h7.2M9.2 12h7.2M9.2 15.6h4.4" stroke="#d5dcf8" stroke-width="1.4" stroke-linecap="round"/><path d="M6.7 8.2 7.7 9.2 9.4 7.2" fill="none" stroke="#3dbe7a" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>')
    },
  ];

  function currentPath() {
    var path = location.pathname.replace(/\/$/, "");
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
    document.body.appendChild(nav);
  }

  mount();
  new MutationObserver(function () {
    mount();
  }).observe(document.body, { childList: true });
})();
