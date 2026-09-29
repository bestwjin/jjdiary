(function () {
  var svg = function (inner) {
    return '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">' + inner + "</svg>";
  };
  var tile = function (fill) {
    return '<rect x="1" y="1" width="22" height="22" rx="8" fill="' + fill + '"/>';
  };
  var home = {
    href: "/",
    label: "홈",
    icon: svg(tile("#ffe4d4") + '<path d="M6.2 12.4 12 7.6l5.8 4.8v5.2a.8.8 0 0 1-.8.8H7a.8.8 0 0 1-.8-.8z" fill="#fff"/><path d="M5.4 12.6 12 7l6.6 5.6" fill="none" stroke="#f29a62" stroke-width="1.5" stroke-linejoin="round"/><rect x="10.7" y="14.2" width="2.6" height="4.2" rx="1.2" fill="#f29a62"/><circle cx="15.6" cy="10.2" r=".7" fill="#ffb7c5"/>')
  };
  var movable = [
    {
      href: "/schools",
      label: "학교 정보",
      icon: svg(tile("#dceeff") + '<path d="M5.2 11.4 12 7.2l6.8 4.2-6.8 3.2z" fill="#7eb6ff"/><rect x="7.1" y="12" width="9.8" height="5.8" rx="1.3" fill="#fff"/><rect x="10.8" y="13.8" width="2.4" height="4" rx=".7" fill="#5b8def"/><circle cx="9.2" cy="13.5" r=".55" fill="#b9d7ff"/><circle cx="14.8" cy="13.5" r=".55" fill="#b9d7ff"/><circle cx="12" cy="6.2" r="1.05" fill="#ffd166"/>')
    },
    {
      href: "/calendar",
      label: "입학설명회 일정",
      icon: svg(tile("#ffe3e8") + '<rect x="5.2" y="6.6" width="13.6" height="11.4" rx="2.2" fill="#fff"/><path d="M5.2 9.6h13.6V8.8a2.2 2.2 0 0 0-2.2-2.2H7.4A2.2 2.2 0 0 0 5.2 8.8v.8z" fill="#ff8fa3"/><rect x="8.3" y="5.2" width="1.4" height="2.8" rx=".7" fill="#ffb3c2"/><rect x="14.3" y="5.2" width="1.4" height="2.8" rx=".7" fill="#ffb3c2"/><path d="M12 12.6c-.55-.48-1.45-.15-1.45.62 0 .78 1.45 1.85 1.45 1.85s1.45-1.07 1.45-1.85c0-.77-.9-1.1-1.45-.62z" fill="#ff8fa3"/>')
    },
    {
      href: "/todos",
      label: "할일 목록",
      icon: svg(tile("#e4f7ee") + '<rect x="6.1" y="4.4" width="11.8" height="15.2" rx="2.3" fill="#fff"/><path d="M9.4 10.2h6.2M9.4 13.1h6.2M9.4 16h3.8" stroke="#b7e4cc" stroke-width="1.25" stroke-linecap="round"/><circle cx="8.5" cy="8.2" r="1.55" fill="#5dcca0"/><path d="M7.7 8.2 8.3 8.9 9.4 7.6" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>')
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
