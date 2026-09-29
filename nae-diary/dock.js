(function () {
  var appIcon = function (id, from, to, glyph) {
    return '<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="6" y1="2" x2="26" y2="30" gradientUnits="userSpaceOnUse"><stop stop-color="' + from + '"/><stop offset="1" stop-color="' + to + '"/></linearGradient></defs><rect x="1" y="1" width="30" height="30" rx="9" fill="url(#' + id + ')"/>' + glyph + "</svg>";
  };
  var home = {
    href: "/",
    label: "홈",
    icon: appIcon("dock-home", "#FFC4A6", "#FF7A59", '<path fill="#fff" d="M7.4 15.5 16 8.2l8.6 7.3V23.4c0 .6-.5 1.1-1.1 1.1H8.5c-.6 0-1.1-.5-1.1-1.1V15.5z"/><rect x="14.2" y="18.4" width="3.6" height="6.1" rx="1.2" fill="#FF8B68"/>')
  };
  var movable = [
    {
      href: "/schools",
      label: "학교 정보",
      icon: appIcon("dock-school", "#C4B5FD", "#7C6BF2", '<path fill="#fff" d="M6.2 14.2 16 8.2l9.8 6H6.2z"/><rect x="8" y="14.4" width="16" height="8.6" rx="1.6" fill="#fff"/><circle cx="11.4" cy="17.6" r="1.05" fill="#8B7CF6"/><circle cx="20.6" cy="17.6" r="1.05" fill="#8B7CF6"/><rect x="14.5" y="17.2" width="3" height="5.8" rx="1" fill="#8B7CF6"/>')
    },
    {
      href: "/calendar",
      label: "입학설명회 일정",
      icon: appIcon("dock-cal", "#9CC6FF", "#4C86F5", '<rect x="8" y="9.2" width="16" height="14" rx="2.6" fill="#fff"/><rect x="11" y="6.6" width="1.8" height="4.2" rx=".9" fill="#fff"/><rect x="19.2" y="6.6" width="1.8" height="4.2" rx=".9" fill="#fff"/><circle cx="12.4" cy="16.2" r="1.05" fill="#5B8EF0"/><circle cx="16" cy="16.2" r="1.05" fill="#5B8EF0"/><circle cx="19.6" cy="16.2" r="1.05" fill="#5B8EF0"/>')
    },
    {
      href: "/todos",
      label: "할일 목록",
      icon: appIcon("dock-todo", "#B6F0C0", "#3CCB6C", '<g transform="rotate(-42 16 16)"><rect x="13.1" y="5.4" width="5.8" height="15.2" rx="1.2" fill="#fff"/><rect x="13.1" y="5.4" width="5.8" height="3.4" rx="1.2" fill="#FFE08A"/><path d="M13.1 18.4h5.8L16 24.4z" fill="#fff"/></g>')
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
