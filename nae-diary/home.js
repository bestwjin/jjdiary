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
    var heading = document.createElement("h2");
    heading.textContent = title;
    head.appendChild(heading);
    if (extra) head.appendChild(extra);
    section.appendChild(head);
    return section;
  }

  function render(todos) {
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
    count.innerHTML = open.length
      ? "남은 할일 <span class=\"todo-count-num\">" + open.length + "</span>개"
      : "남은 할일이 없습니다";
    empty.hidden = open.length > 0;
    board.hidden = open.length === 0;
    board.replaceChildren();
    if (!open.length) return;

    var tags = groupCount(open, "tag", "태그 없음");
    var tools = groupCount(open, "aiTool", "미지정");
    var stats = document.createElement("div");
    stats.className = "dash-stats";
    stats.appendChild(statCard("남은 할일", open.length, true));
    tags.forEach(function (item) { stats.appendChild(statCard(item.key, item.count, false)); });

    var layout = document.createElement("div");
    layout.className = "dash-layout";
    var allLink = document.createElement("a");
    allLink.className = "dash-more";
    allLink.href = "/todos";
    allLink.textContent = "전체 보기";
    var main = zone("남은 할일", allLink);
    main.classList.add("dash-zone-main");
    var items = document.createElement("div");
    items.className = "dash-items";
    open.forEach(function (todo) { items.appendChild(todoLink(todo)); });
    main.appendChild(items);

    var side = document.createElement("div");
    side.className = "dash-side";
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
    side.append(tagZone, toolZone);
    layout.append(main, side);
    board.append(stats, layout);
  }

  fetch(API + "/todos", { headers: headers })
    .then(function (response) {
      if (!response.ok) throw new Error("load");
      return response.json();
    })
    .then(function (data) { render(data.todos || []); })
    .catch(function () {
      count.textContent = "";
      error.hidden = false;
      error.textContent = "할일을 불러오지 못했습니다.";
    });
})();
