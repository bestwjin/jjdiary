(function () {
  var API = "https://nae-diary-notify.jjinytm.workers.dev";
  var headers = {
    "Content-Type": "application/json",
    "X-Diary-Sync": "575dc6f9f6eafc1d4246ca0c4991655e",
  };
  var holidayForm = document.getElementById("settings-holiday-form");
  var telegramForm = document.getElementById("settings-telegram-form");
  var mailForm = document.getElementById("settings-mail-form");
  var kasiInput = document.getElementById("settings-kasi-key");
  var kasiToggle = document.getElementById("settings-kasi-toggle");
  var telegramToken = document.getElementById("settings-telegram-token");
  var telegramUsername = document.getElementById("settings-telegram-username");
  var telegramNotifyTime = document.getElementById("settings-telegram-notify-time");
  var telegramToggle = document.getElementById("settings-telegram-toggle");
  var mailToggle = document.getElementById("settings-mail-toggle");
  var error = document.getElementById("settings-error");
  var ok = document.getElementById("settings-ok");
  var providers = ["daum", "naver", "gmail"];

  function showError(message) {
    error.hidden = !message;
    error.textContent = message || "";
    if (message) ok.hidden = true;
  }

  function showOk(message) {
    ok.hidden = !message;
    ok.textContent = message || "";
    if (message) error.hidden = true;
  }

  function providerRoot(id) {
    return mailForm.querySelector('.mail-provider[data-provider="' + id + '"]');
  }

  function field(root, name) {
    return root.querySelector('[data-field="' + name + '"]');
  }

  function applyMailAccounts(accounts) {
    providers.forEach(function (id) {
      var root = providerRoot(id);
      var data = accounts && accounts[id] ? accounts[id] : {};
      field(root, "enabled").checked = Boolean(data.enabled);
      field(root, "address").value = data.address || "";
      field(root, "displayName").value = data.displayName || "";
      field(root, "imapUser").value = data.imapUser || "";
      field(root, "imapPassword").value = data.imapPassword || "";
      field(root, "smtpUser").value = data.smtpUser || "";
      field(root, "smtpPassword").value = data.smtpPassword || "";
    });
  }

  function readMailAccounts() {
    var out = {};
    providers.forEach(function (id) {
      var root = providerRoot(id);
      out[id] = {
        id: id,
        enabled: field(root, "enabled").checked,
        address: field(root, "address").value.trim(),
        displayName: field(root, "displayName").value.trim(),
        imapUser: field(root, "imapUser").value.trim(),
        imapPassword: field(root, "imapPassword").value,
        smtpUser: field(root, "smtpUser").value.trim(),
        smtpPassword: field(root, "smtpPassword").value,
      };
    });
    return out;
  }

  function applySettings(settings) {
    kasiInput.value = settings && settings.kasiServiceKey ? settings.kasiServiceKey : "";
    telegramToken.value = settings && settings.telegramToken ? settings.telegramToken : "";
    telegramUsername.value = settings && settings.telegramUsername ? settings.telegramUsername : "";
    telegramNotifyTime.value = settings && settings.telegramNotifyTime ? settings.telegramNotifyTime : "10:00";
    applyMailAccounts(settings && settings.mailAccounts ? settings.mailAccounts : {});
  }

  async function load() {
    showError("");
    showOk("");
    var response = await fetch(API + "/settings", { headers: headers });
    if (!response.ok) throw new Error("load");
    var data = await response.json();
    applySettings(data.settings);
  }

  async function save(payload, successMessage) {
    showError("");
    showOk("");
    var response = await fetch(API + "/settings", {
      method: "PUT",
      headers: headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("save");
    var data = await response.json();
    applySettings(data.settings);
    showOk(successMessage);
  }

  function bindToggle(button, inputs) {
    button.addEventListener("click", function () {
      var list = Array.isArray(inputs) ? inputs : [inputs];
      var show = list.some(function (input) { return input.type === "password"; });
      list.forEach(function (input) {
        input.type = show ? "text" : "password";
      });
      button.textContent = show ? "숨김" : "표시";
    });
  }

  bindToggle(kasiToggle, kasiInput);
  bindToggle(telegramToggle, telegramToken);
  bindToggle(mailToggle, Array.prototype.slice.call(mailForm.querySelectorAll('input[data-field$="Password"]')));

  holidayForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var button = holidayForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await save(
        { kasiServiceKey: kasiInput.value.trim() },
        kasiInput.value.trim() ? "공휴일 인증키를 저장했습니다." : "공휴일 인증키를 비웠습니다."
      );
    } catch (err) {
      showError("설정을 저장하지 못했습니다.");
    } finally {
      button.disabled = false;
    }
  });

  telegramForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var button = telegramForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      var token = telegramToken.value.trim();
      var username = telegramUsername.value.trim().replace(/^@/, "");
      var notifyTime = telegramNotifyTime.value || "10:00";
      await save(
        { telegramToken: token, telegramUsername: username, telegramNotifyTime: notifyTime },
        "텔레그램 연동 정보를 저장했습니다."
      );
    } catch (err) {
      showError("설정을 저장하지 못했습니다.");
    } finally {
      button.disabled = false;
    }
  });

  mailForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var button = mailForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await save({ mailAccounts: readMailAccounts() }, "메일 연동 정보를 저장했습니다.");
    } catch (err) {
      showError("설정을 저장하지 못했습니다.");
    } finally {
      button.disabled = false;
    }
  });

  telegramNotifyTime.value = "10:00";

  var GAP = 14;
  var SNAP = 12;
  var NEAR = 80;
  var MIN_W = 280;
  var MIN_H = 180;
  var board = document.getElementById("settings-board");

  function readLayout() {
    try {
      var data = JSON.parse(localStorage.getItem("settingsLayout") || "");
      if (!data || typeof data !== "object" || !data.items) return { custom: false, items: {} };
      return data;
    } catch (e) {
      return { custom: false, items: {} };
    }
  }

  function writeLayout(widgets, canvasWidth) {
    var items = {};
    widgets.forEach(function (widget) {
      items[widget.id] = {
        x: canvasWidth ? widget.rect.x / canvasWidth : 0,
        y: widget.rect.y,
        w: canvasWidth ? widget.rect.w / canvasWidth : 1,
        h: widget.rect.h,
      };
    });
    localStorage.setItem("settingsLayout", JSON.stringify({ custom: true, items: items }));
  }

  function cloneRect(rect) {
    return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
  }

  function magnet(value, targets) {
    var best = null;
    var dist = SNAP + 0.01;
    targets.forEach(function (target) {
      if (!isFinite(target)) return;
      var delta = Math.abs(target - value);
      if (delta <= SNAP && delta < dist) {
        dist = delta;
        best = target;
      }
    });
    return best === null ? value : Math.round(best);
  }

  function separation(a, b) {
    var dx = 0;
    if (a.x + a.w < b.x) dx = b.x - (a.x + a.w);
    else if (b.x + b.w < a.x) dx = a.x - (b.x + b.w);
    var dy = 0;
    if (a.y + a.h < b.y) dy = b.y - (a.y + a.h);
    else if (b.y + b.h < a.y) dy = a.y - (b.y + b.h);
    return Math.max(dx, dy);
  }

  function nearbyRects(rect, rects) {
    return rects.filter(function (other) { return separation(rect, other) <= NEAR; });
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function snapMove(rect, near, canvasWidth) {
    var xs = [0, canvasWidth - rect.w];
    var ys = [0];
    near.forEach(function (other) {
      xs.push(other.x, other.x + other.w + GAP, other.x + other.w - rect.w, other.x - GAP - rect.w);
      ys.push(other.y, other.y + other.h + GAP, other.y + other.h - rect.h, other.y - GAP - rect.h);
    });
    var x = magnet(rect.x, xs);
    var y = Math.max(0, magnet(rect.y, ys));
    x = Math.max(0, Math.min(Math.max(0, canvasWidth - rect.w), x));
    return { x: x, y: y, w: rect.w, h: rect.h };
  }

  function snapSize(rect, near, canvasWidth, edge) {
    var next = cloneRect(rect);
    if (edge.indexOf("e") >= 0) {
      var rights = [canvasWidth];
      near.forEach(function (other) {
        rights.push(rect.x + other.w, other.x + other.w, other.x - GAP);
      });
      var right = magnet(rect.x + rect.w, rights);
      next.w = Math.max(MIN_W, Math.min(canvasWidth - rect.x, right - rect.x));
    }
    if (edge.indexOf("s") >= 0) {
      var bottoms = [];
      near.forEach(function (other) {
        bottoms.push(rect.y + other.h, other.y + other.h, other.y - GAP);
      });
      if (bottoms.length) {
        var bottom = magnet(rect.y + rect.h, bottoms);
        next.h = Math.max(MIN_H, bottom - rect.y);
      }
    }
    return next;
  }

  function resolveOverlap(rect, rects, canvasWidth) {
    var next = cloneRect(rect);
    var guard = 0;
    while (guard++ < 20) {
      var hit = null;
      for (var i = 0; i < rects.length; i++) {
        if (overlaps(next, rects[i])) {
          hit = rects[i];
          break;
        }
      }
      if (!hit) break;
      var down = hit.y + hit.h + GAP - next.y;
      var right = hit.x + hit.w + GAP - next.x;
      if (right > 0 && right <= down && next.x + next.w + right <= canvasWidth + 1) next.x += right;
      else next.y += Math.max(down, GAP);
    }
    next.x = Math.max(0, Math.min(Math.max(0, canvasWidth - next.w), next.x));
    next.y = Math.max(0, next.y);
    return {
      x: Math.round(next.x),
      y: Math.round(next.y),
      w: Math.round(next.w),
      h: Math.round(next.h),
    };
  }

  function measureCard(el, width) {
    el.style.position = "absolute";
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.width = width + "px";
    el.style.height = "auto";
    var body = el.querySelector(".settings-card-body, .dash-body");
    if (body) {
      body.style.flex = "none";
      body.style.overflow = "visible";
    }
    var height = Math.max(MIN_H, el.scrollHeight || el.offsetHeight);
    if (body) {
      body.style.flex = "";
      body.style.overflow = "";
    }
    return height;
  }

  function defaultArrange(widgets, canvasWidth) {
    var y = 0;
    var half = Math.max(MIN_W, Math.floor((canvasWidth - GAP) / 2));
    var holiday = widgets.find(function (w) { return w.id === "holiday"; });
    var telegram = widgets.find(function (w) { return w.id === "telegram"; });
    var mail = widgets.find(function (w) { return w.id === "mail"; });
    if (holiday && telegram && canvasWidth >= MIN_W * 2 + GAP) {
      var h1 = measureCard(holiday.el, half);
      var h2 = measureCard(telegram.el, half);
      var rowH = Math.max(h1, h2);
      holiday.rect = { x: 0, y: y, w: half, h: rowH };
      telegram.rect = { x: half + GAP, y: y, w: canvasWidth - half - GAP, h: rowH };
      y += rowH + GAP;
    } else {
      [holiday, telegram].forEach(function (widget) {
        if (!widget) return;
        var h = measureCard(widget.el, canvasWidth);
        widget.rect = { x: 0, y: y, w: canvasWidth, h: h };
        y += h + GAP;
      });
    }
    if (mail) {
      var mailH = measureCard(mail.el, canvasWidth);
      mail.rect = { x: 0, y: y, w: canvasWidth, h: Math.max(mailH, 420) };
    }
  }

  function placeMissing(widgets, canvasWidth) {
    var placed = widgets.filter(function (widget) { return widget.rect; }).map(function (widget) { return widget.rect; });
    widgets.forEach(function (widget) {
      if (widget.rect) return;
      var w = Math.min(canvasWidth, Math.max(MIN_W, Math.round(canvasWidth * 0.48)));
      var h = measureCard(widget.el, w);
      var rect = resolveOverlap({ x: 0, y: 0, w: w, h: h }, placed, canvasWidth);
      widget.rect = rect;
      placed.push(rect);
    });
  }

  function applySaved(widgets, canvasWidth, saved) {
    widgets.forEach(function (widget) { widget.rect = null; });
    widgets.forEach(function (widget) {
      var item = saved.items[widget.id];
      if (!item || !isFinite(Number(item.w)) || !isFinite(Number(item.h))) return;
      var w = Math.max(MIN_W, Math.round(Number(item.w) * canvasWidth));
      var x = Math.round(Number(item.x) * canvasWidth);
      if (w > canvasWidth) w = canvasWidth;
      if (x + w > canvasWidth) x = Math.max(0, canvasWidth - w);
      widget.rect = {
        x: Math.max(0, x),
        y: Math.max(0, Math.round(Number(item.y) || 0)),
        w: w,
        h: Math.max(MIN_H, Math.round(Number(item.h) || MIN_H)),
      };
    });
    placeMissing(widgets, canvasWidth);
  }

  function mountSettingsBoard() {
    if (!board || board.dataset.mounted === "1") return;
    board.dataset.mounted = "1";
    var canvas = document.createElement("div");
    canvas.className = "dash-canvas settings-canvas";
    var cards = Array.prototype.slice.call(board.querySelectorAll(".settings-card[data-zone]"));
    var widgets = cards.map(function (el) {
      return { id: el.getAttribute("data-zone"), el: el, rect: null };
    });
    widgets.forEach(function (widget) {
      var body = widget.el.querySelector(".settings-card-body");
      if (body) body.classList.add("dash-body");
      ["e", "s", "se"].forEach(function (edge) {
        var handle = document.createElement("button");
        handle.type = "button";
        handle.className = "dash-resize";
        handle.dataset.edge = edge;
        handle.setAttribute("aria-label", edge === "e" ? "가로 크기 조정" : edge === "s" ? "세로 크기 조정" : "가로세로 크기 조정");
        widget.el.appendChild(handle);
      });
      widget.el.classList.add("dash-widget");
      canvas.appendChild(widget.el);
    });
    board.appendChild(canvas);

    function canvasWidth() {
      return canvas.clientWidth || board.clientWidth || 320;
    }

    function paint() {
      var bottom = 0;
      widgets.forEach(function (widget) {
        var rect = widget.rect;
        widget.el.style.left = rect.x + "px";
        widget.el.style.top = rect.y + "px";
        widget.el.style.width = rect.w + "px";
        widget.el.style.height = rect.h + "px";
        bottom = Math.max(bottom, rect.y + rect.h);
      });
      canvas.style.height = bottom + "px";
    }

    function relayout() {
      var saved = readLayout();
      var width = canvasWidth();
      if (saved.custom) applySaved(widgets, width, saved);
      else defaultArrange(widgets, width);
      paint();
    }

    relayout();
    var drag = null;

    function widgetByEl(el) {
      for (var i = 0; i < widgets.length; i++) {
        if (widgets[i].el === el) return widgets[i];
      }
      return null;
    }

    function otherRects(widget) {
      return widgets.filter(function (item) { return item !== widget; }).map(function (item) { return item.rect; });
    }

    canvas.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) return;
      var handle = event.target.closest(".dash-resize");
      var widgetEl = event.target.closest(".dash-widget");
      if (!widgetEl) return;
      var widget = widgetByEl(widgetEl);
      if (!widget) return;
      if (handle) {
        event.preventDefault();
        event.stopPropagation();
        drag = {
          mode: "resize",
          edge: handle.dataset.edge,
          widget: widget,
          px: event.clientX,
          py: event.clientY,
          rect: cloneRect(widget.rect),
          near: nearbyRects(widget.rect, otherRects(widget)),
          moved: false,
        };
        widget.el.classList.add("is-resizing");
        try { handle.setPointerCapture(event.pointerId); } catch (e) {}
        return;
      }
      if (event.target.closest("a, button, input, textarea, select, label")) return;
      if (!event.target.closest(".settings-card-head")) return;
      event.preventDefault();
      drag = {
        mode: "move",
        widget: widget,
        px: event.clientX,
        py: event.clientY,
        rect: cloneRect(widget.rect),
        near: nearbyRects(widget.rect, otherRects(widget)),
        moved: false,
      };
      widget.el.classList.add("is-dragging");
      try { widget.el.setPointerCapture(event.pointerId); } catch (e) {}
    });

    window.addEventListener("pointermove", function (event) {
      if (!drag) return;
      var dx = event.clientX - drag.px;
      var dy = event.clientY - drag.py;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      var width = canvasWidth();
      var raw = cloneRect(drag.rect);
      var near = drag.near.slice();
      nearbyRects(raw, otherRects(drag.widget)).forEach(function (rect) {
        if (near.indexOf(rect) < 0) near.push(rect);
      });
      if (drag.mode === "move") {
        raw.x += dx;
        raw.y = Math.max(0, raw.y + dy);
        var snapped = snapMove(raw, near, width);
        drag.widget.rect = snapped;
        drag.widget.el.classList.toggle("is-magnet", Math.abs(snapped.x - raw.x) > 0.5 || Math.abs(snapped.y - raw.y) > 0.5);
      } else {
        if (drag.edge.indexOf("e") >= 0) raw.w = Math.max(MIN_W, drag.rect.w + dx);
        if (drag.edge.indexOf("s") >= 0) raw.h = Math.max(MIN_H, drag.rect.h + dy);
        if (raw.x + raw.w > width) raw.w = Math.max(MIN_W, width - raw.x);
        var snappedSize = snapSize(raw, near, width, drag.edge);
        drag.widget.rect = snappedSize;
        drag.widget.el.classList.toggle("is-magnet", snappedSize.w !== raw.w || snappedSize.h !== raw.h);
      }
      paint();
    });

    function finishDrag() {
      if (!drag) return;
      var widget = drag.widget;
      var moved = drag.moved;
      var mode = drag.mode;
      widget.el.classList.remove("is-dragging", "is-resizing", "is-magnet");
      drag = null;
      if (!moved) return;
      if (mode === "move") widget.rect = resolveOverlap(widget.rect, otherRects(widget), canvasWidth());
      else widget.rect = {
        x: Math.round(widget.rect.x),
        y: Math.round(widget.rect.y),
        w: Math.round(widget.rect.w),
        h: Math.round(widget.rect.h),
      };
      paint();
      writeLayout(widgets, canvasWidth());
    }

    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    window.addEventListener("resize", relayout);
  }

  load().then(function () {
    mountSettingsBoard();
  }).catch(function () {
    showError("설정을 불러오지 못했습니다.");
    mountSettingsBoard();
  });
})();
