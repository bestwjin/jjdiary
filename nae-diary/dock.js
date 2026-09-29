(function () {
  var items = [
    { href: "/", icon: "🏠", label: "홈" },
    { href: "/schools", icon: "🏫", label: "학교 정보" },
    { href: "/calendar", icon: "📅", label: "입학설명회 일정" },
    { href: "/todos", icon: "📝", label: "할일 목록" },
  ];

  function currentPath() {
    var path = location.pathname.replace(/\/$/, "");
    return path || "/";
  }

  function mount() {
    if (document.getElementById("mac-dock")) return;
    var nav = document.createElement("nav");
    nav.id = "mac-dock";
    nav.className = "mac-dock";
    nav.setAttribute("aria-label", "메뉴");
    var path = currentPath();
    items.forEach(function (item, index) {
      var el = item.disabled ? document.createElement("span") : document.createElement("a");
      el.className = "mac-dock-item" + (item.disabled ? " is-disabled" : "");
      if (!item.disabled) {
        el.href = item.href;
        if (path === item.href) el.setAttribute("aria-current", "page");
      }
      el.setAttribute("aria-label", item.label);
      var icon = document.createElement("span");
      icon.className = "mac-dock-icon";
      icon.textContent = item.icon;
      icon.setAttribute("aria-hidden", "true");
      var tip = document.createElement("span");
      tip.className = "mac-tip";
      tip.textContent = item.label;
      el.appendChild(icon);
      el.appendChild(tip);
      nav.appendChild(el);
      if (index === 0) {
        var rule = document.createElement("span");
        rule.className = "mac-dock-rule";
        nav.appendChild(rule);
      }
    });
    document.body.appendChild(nav);
  }

  mount();
  new MutationObserver(function () {
    mount();
  }).observe(document.body, { childList: true });
})();
