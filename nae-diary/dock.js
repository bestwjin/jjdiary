(function () {
  var home = { href: "/", icon: "🏠", label: "홈" };
  var movable = [
    { href: "/schools", icon: "🏫", label: "학교 정보" },
    { href: "/calendar", icon: "📅", label: "입학설명회 일정" },
    { href: "/todos", icon: "📝", label: "할일 목록" },
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
    icon.textContent = item.icon;
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
