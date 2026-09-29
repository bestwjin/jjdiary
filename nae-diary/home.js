(function () {
  var API = "https://nae-diary-notify.jjinytm.workers.dev";
  var headers = { "X-Diary-Sync": "575dc6f9f6eafc1d4246ca0c4991655e" };
  var list = document.getElementById("home-list");
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

  function render(todos) {
    var open = todos.filter(function (todo) { return !todo.done; });
    open.sort(function (a, b) { return b.id - a.id; });
    count.innerHTML = open.length
      ? "남은 할일 <span class=\"todo-count-num\">" + open.length + "</span>개"
      : "남은 할일이 없습니다";
    empty.hidden = open.length > 0;
    list.replaceChildren();
    open.forEach(function (todo) {
      var row = document.createElement("li");
      row.className = "todo-row";
      var link = document.createElement("a");
      link.className = "home-todo";
      link.href = "/todos";
      var main = document.createElement("div");
      main.className = "todo-main";
      var line = document.createElement("div");
      line.className = "todo-line";
      if (todo.tag) {
        var tag = document.createElement("span");
        tag.className = "todo-tag";
        tag.textContent = todo.tag;
        line.appendChild(tag);
      }
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
      main.append(line, meta);
      link.appendChild(main);
      row.appendChild(link);
      list.appendChild(row);
    });
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
