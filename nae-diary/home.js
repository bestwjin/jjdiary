(function () {
  var API = "https://nae-diary-notify.jjinytm.workers.dev";
  var headers = { "X-Diary-Sync": "575dc6f9f6eafc1d4246ca0c4991655e" };
  var board = document.getElementById("home-board");
  var count = document.getElementById("home-count");
  var empty = document.getElementById("home-empty");
  var error = document.getElementById("home-error");

  function formatCreated(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    var parts = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    function part(type) {
      var found = parts.find(function (item) { return item.type === type; });
      return found ? found.value : "";
    }
    return part("year") + "." + part("month") + "." + part("day") + " " + part("hour") + ":" + part("minute");
  }

  function groupCount(todos, field, emptyLabel) {
    var order = [];
    var map = {};
    todos.forEach(function (todo) {
      var key = todo[field] || emptyLabel;
      if (!map[key]) {
        map[key] = 0;
        order.push(key);
      }
      map[key] += 1;
    });
    return order.map(function (key) { return { key: key, count: map[key] }; });
  }

  function statCard(label, value, emphasized) {
    var card = document.createElement("section");
    card.className = "dash-stat" + (emphasized ? " is-total" : "");
    var name = document.createElement("span");
    name.className = "dash-stat-label";
    name.textContent = label;
    var num = document.createElement("strong");
    num.className = "dash-stat-num";
    num.textContent = String(value);
    card.append(name, num);
    return card;
  }

  function meterRow(label, value, total, pillClass) {
    var row = document.createElement("div");
    row.className = "dash-meter";
    var name = document.createElement("span");
    name.className = pillClass || "todo-tag";
    name.textContent = label;
    var track = document.createElement("span");
    track.className = "dash-meter-track";
    var bar = document.createElement("span");
    bar.className = "dash-meter-bar";
    bar.style.width = total ? Math.max(8, Math.round((value / total) * 100)) + "%" : "0";
    track.appendChild(bar);
    var num = document.createElement("b");
    num.textContent = String(value);
    row.append(name, track, num);
    return row;
  }

  function todoLink(todo) {
    var link = document.createElement("a");
    link.className = "dash-item";
    link.href = "/todos";
    var line = document.createElement("div");
    line.className = "todo-line";
    if (todo.tag) {
      var tag = document.createElement("span");
      tag.className = "todo-tag";
      tag.textContent = todo.tag;
      line.appendChild(tag);
    }
    var priority = document.createElement("span");
    var level = todo.priority === "높음" || todo.priority === "낮음" ? todo.priority : "보통";
    priority.className = "todo-priority " + (level === "높음" ? "todo-priority-high" : level === "낮음" ? "todo-priority-low" : "todo-priority-mid");
    priority.textContent = level;
    line.appendChild(priority);
    if (todo.aiTool) {
      var ai = document.createElement("span");
      ai.className = "todo-ai todo-ai-" + String(todo.aiTool).toLowerCase();
      ai.textContent = todo.aiTool;
      line.appendChild(ai);
    }
    var title = document.createElement("span");
    title.className = "todo-title";
    title.textContent = todo.title;
    line.appendChild(title);
    var meta = document.createElement("div");
    meta.className = "todo-meta";
    var bits = [];
    if (todo.requester) bits.push(todo.requester);
    var created = formatCreated(todo.createdAt);
    if (created) bits.push(created);
    meta.textContent = bits.join(" · ");
    link.append(line, meta);
    return link;
  }

  function zone(title, extra) {
    var section = document.createElement("section");
    section.className = "dash-zone";
    var head = document.createElement("div");
    head.className = "dash-zone-head";
    var titleWrap = document.createElement("div");
    titleWrap.className = "dash-zone-title";
    var grip = document.createElement("span");
    grip.className = "dash-grip";
    grip.setAttribute("aria-hidden", "true");
    var heading = document.createElement("h2");
    heading.textContent = title;
    titleWrap.append(grip, heading);
    head.appendChild(titleWrap);
    if (extra) head.appendChild(extra);
    section.appendChild(head);
    return section;
  }

  var GAP = 14;
  var SNAP = 12;
  var NEAR = 80;
  var MIN_W = 160;
  var MIN_H = 88;

  function readLayout() {
    try {
      var data = JSON.parse(localStorage.getItem("dashLayout") || "");
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
    localStorage.setItem("dashLayout", JSON.stringify({ custom: true, items: items }));
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

  function measureWidget(el, widgetWidth) {
    el.style.position = "absolute";
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.width = widgetWidth + "px";
    el.style.height = "auto";
    var body = el.querySelector(".dash-body");
    if (body) {
      body.style.flex = "none";
      body.style.overflow = "visible";
    }
    var height = Math.max(MIN_H, el.offsetHeight);
    if (body) {
      body.style.flex = "";
      body.style.overflow = "";
    }
    return height;
  }

  function arrangeWidgets(widgets, canvasWidth) {
    var stats = widgets.filter(function (widget) { return widget.id.indexOf("stat:") === 0; });
    var todos = null;
    var side = [];
    widgets.forEach(function (widget) {
      if (widget.id === "todos") todos = widget;
      else if (widget.id === "tags" || widget.id === "tools" || widget.id === "schedule") side.push(widget);
    });
    var y = 0;
    var x = 0;
    var per = Math.min(4, Math.max(stats.length, 1));
    var statW = stats.length ? Math.floor((canvasWidth - GAP * (per - 1)) / per) : MIN_W;
    statW = Math.max(MIN_W, Math.min(statW, canvasWidth));
    if (stats.length === 1) statW = Math.min(280, canvasWidth);
    var statH = 96;
    stats.forEach(function (widget) {
      statH = Math.max(statH, measureWidget(widget.el, statW));
    });
    stats.forEach(function (widget) {
      if (x > 0 && x + statW > canvasWidth) {
        x = 0;
        y += statH + GAP;
      }
      widget.rect = { x: x, y: y, w: Math.min(statW, canvasWidth - x), h: statH };
      x += widget.rect.w + GAP;
    });
    if (stats.length) y += statH + GAP;
    var sideW = Math.max(220, Math.round(canvasWidth * 0.34));
    var leftW = canvasWidth - sideW - GAP;
    var stacked = !side.length || leftW < 280;
    if (stacked) {
      leftW = canvasWidth;
      sideW = canvasWidth;
    }
    if (todos) {
      todos.rect = { x: 0, y: y, w: leftW, h: measureWidget(todos.el, leftW) };
    }
    var sideX = stacked ? 0 : leftW + GAP;
    var sideY = stacked && todos ? todos.rect.y + todos.rect.h + GAP : y;
    side.forEach(function (widget) {
      widget.rect = { x: sideX, y: sideY, w: sideW, h: measureWidget(widget.el, sideW) };
      sideY += widget.rect.h + GAP;
    });
  }

  function placeMissing(widgets, canvasWidth) {
    var y = 0;
    widgets.forEach(function (widget) {
      if (widget.rect) y = Math.max(y, widget.rect.y + widget.rect.h + GAP);
    });
    widgets.forEach(function (widget) {
      if (widget.rect) return;
      var widgetWidth = Math.max(MIN_W, Math.min(320, canvasWidth));
      widget.rect = { x: 0, y: y, w: widgetWidth, h: measureWidget(widget.el, widgetWidth) };
      y += widget.rect.h + GAP;
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

  function mountBoard(widgets) {
    var canvas = document.createElement("div");
    canvas.className = "dash-canvas";
    board.appendChild(canvas);
    widgets.forEach(function (widget) {
      var body = document.createElement("div");
      body.className = "dash-body";
      while (widget.el.firstChild) body.appendChild(widget.el.firstChild);
      widget.el.appendChild(body);
      ["e", "s", "se"].forEach(function (edge) {
        var handle = document.createElement("button");
        handle.type = "button";
        handle.className = "dash-resize";
        handle.dataset.edge = edge;
        handle.setAttribute("aria-label", edge === "e" ? "가로 크기 조정" : edge === "s" ? "세로 크기 조정" : "가로세로 크기 조정");
        widget.el.appendChild(handle);
      });
      widget.el.classList.add("dash-widget");
      widget.el.dataset.zone = widget.id;
      canvas.appendChild(widget.el);
    });

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
      else arrangeWidgets(widgets, width);
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
      if (event.target.closest("a, button, input, textarea, select")) return;
      var onHead = event.target.closest(".dash-zone-head");
      var onStat = widget.el.classList.contains("dash-stat") && !event.target.closest(".dash-resize");
      if (!onHead && !onStat) return;
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

  function todayKey() {
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, "0");
    var day = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + month + "-" + day;
  }

  function upcomingSchedules(schedules) {
    var today = todayKey();
    return schedules.filter(function (item) {
      return String(item.date || "") >= today;
    }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      var left = a.time || "";
      var right = b.time || "";
      if (left !== right) return left < right ? -1 : 1;
      return (a.id || 0) - (b.id || 0);
    }).slice(0, 8);
  }

  function scheduleWhen(item, today) {
    if (item.date === today) return item.time ? "오늘 " + item.time : "오늘";
    var parts = String(item.date || "").split("-");
    if (parts.length !== 3) return item.time || "";
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var days = ["일", "월", "화", "수", "목", "금", "토"];
    var label = Number(parts[1]) + "/" + Number(parts[2]) + " " + days[date.getDay()];
    if (item.time) label += " " + item.time;
    return label;
  }

  function scheduleLink(item, today) {
    var link = document.createElement("a");
    link.className = "dash-sched";
    link.href = "/schedule";
    var when = document.createElement("span");
    when.className = "dash-sched-when";
    when.textContent = scheduleWhen(item, today);
    var title = document.createElement("span");
    title.className = "dash-sched-title";
    title.textContent = item.title || "";
    link.append(when, title);
    return link;
  }

  function scheduleZone(schedules) {
    var link = document.createElement("a");
    link.className = "dash-more";
    link.href = "/schedule";
    link.textContent = "전체 보기";
    var section = zone("일정", link);
    if (!schedules) {
      var failed = document.createElement("p");
      failed.className = "dash-sched-empty";
      failed.textContent = "일정을 불러오지 못했습니다.";
      section.appendChild(failed);
      return section;
    }
    var items = upcomingSchedules(schedules);
    if (!items.length) {
      var none = document.createElement("p");
      none.className = "dash-sched-empty";
      none.textContent = "예정된 일정이 없습니다.";
      section.appendChild(none);
      return section;
    }
    var list = document.createElement("div");
    list.className = "dash-sched-list";
    var today = todayKey();
    items.forEach(function (item) { list.appendChild(scheduleLink(item, today)); });
    section.appendChild(list);
    return section;
  }

  function render(todos, schedules) {
    var open = todos.filter(function (todo) { return !todo.done; });
    open.sort(function (a, b) {
      function rank(value) {
        if (value === "높음") return 0;
        if (value === "낮음") return 2;
        return 1;
      }
      var diff = rank(a.priority) - rank(b.priority);
      if (diff) return diff;
      return b.id - a.id;
    });
    var soon = schedules ? upcomingSchedules(schedules) : [];
    var showBoard = open.length > 0 || soon.length > 0 || !schedules;
    count.innerHTML = open.length
      ? "남은 할일 <span class=\"todo-count-num\">" + open.length + "</span>개"
      : "남은 할일이 없습니다";
    empty.hidden = showBoard;
    board.hidden = !showBoard;
    board.replaceChildren();
    if (!showBoard) return;

    var tags = groupCount(open, "tag", "태그 없음");
    var tools = groupCount(open, "aiTool", "미지정");
    var widgets = [{ id: "stat:total", el: statCard("남은 할일", open.length, true) }];
    tags.forEach(function (item) {
      widgets.push({ id: "stat:" + item.key, el: statCard(item.key, item.count, false) });
    });

    var allLink = document.createElement("a");
    allLink.className = "dash-more";
    allLink.href = "/todos";
    allLink.textContent = "전체 보기";
    var main = zone("남은 할일", allLink);
    main.classList.add("dash-zone-main");
    if (open.length) {
      var items = document.createElement("div");
      items.className = "dash-items";
      open.forEach(function (todo) { items.appendChild(todoLink(todo)); });
      main.appendChild(items);
    } else {
      var noTodo = document.createElement("p");
      noTodo.className = "dash-sched-empty";
      noTodo.textContent = "남은 할일이 없습니다.";
      main.appendChild(noTodo);
    }
    widgets.push({ id: "todos", el: main });

    if (open.length) {
      var tagZone = zone("태그");
      tags.forEach(function (item) {
        tagZone.appendChild(meterRow(item.key, item.count, open.length, "todo-tag"));
      });
      var toolZone = zone("AI 툴");
      tools.forEach(function (item) {
        var pill = "todo-ai";
        if (item.key !== "미지정") pill += " todo-ai-" + item.key.toLowerCase();
        toolZone.appendChild(meterRow(item.key, item.count, open.length, pill));
      });
      widgets.push({ id: "tags", el: tagZone }, { id: "tools", el: toolZone });
    }
    widgets.push({ id: "schedule", el: scheduleZone(schedules) });
    mountBoard(widgets);
  }

  function loadJson(path) {
    return fetch(API + path, { headers: headers }).then(function (response) {
      if (!response.ok) throw new Error("load");
      return response.json();
    });
  }

  Promise.all([
    loadJson("/todos"),
    loadJson("/schedules").catch(function () { return null; }),
  ]).then(function (pair) {
    render(pair[0].todos || [], pair[1] ? pair[1].schedules || [] : null);
  }).catch(function () {
    count.textContent = "";
    error.hidden = false;
    error.textContent = "할일을 불러오지 못했습니다.";
  });
})();
