(function () {
  var API = "https://nae-diary-notify.jjinytm.workers.dev";
  var headers = {
    "Content-Type": "application/json",
    "X-Diary-Sync": "575dc6f9f6eafc1d4246ca0c4991655e",
  };
  var todos = [];
  var list = document.getElementById("todo-list");
  var empty = document.getElementById("todo-empty");
  var count = document.getElementById("todo-count");
  var error = document.getElementById("todo-error");
  var form = document.getElementById("todo-form");
  var input = document.getElementById("todo-input");

  function showError(message) {
    error.hidden = !message;
    error.textContent = message || "";
  }

  function render() {
    list.replaceChildren();
    var open = todos.filter(function (todo) { return !todo.done; }).length;
    count.textContent = open ? "남은 할일 " + open + "개" : "남은 할일이 없습니다";
    empty.hidden = todos.length > 0;
    todos.forEach(function (todo) {
      var row = document.createElement("li");
      row.className = "todo-row" + (todo.done ? " is-done" : "");
      var check = document.createElement("button");
      check.type = "button";
      check.className = "todo-check";
      check.setAttribute("aria-label", todo.done ? "완료 취소" : "완료");
      check.textContent = todo.done ? "✓" : "";
      check.addEventListener("click", function () { toggle(todo); });
      var title = document.createElement("span");
      title.className = "todo-title";
      title.textContent = todo.title;
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "todo-delete";
      remove.textContent = "삭제";
      remove.addEventListener("click", function () { removeTodo(todo); });
      row.append(check, title, remove);
      list.appendChild(row);
    });
  }

  async function load() {
    showError("");
    var response = await fetch(API + "/todos", { headers: headers });
    if (!response.ok) throw new Error("load");
    var data = await response.json();
    todos = data.todos || [];
    render();
  }

  async function toggle(todo) {
    showError("");
    var response = await fetch(API + "/todos/" + todo.id, {
      method: "PUT",
      headers: headers,
      body: JSON.stringify({ done: !todo.done }),
    });
    if (!response.ok) {
      showError("할일 상태를 바꾸지 못했습니다.");
      return;
    }
    var data = await response.json();
    todos = todos.map(function (item) { return item.id === todo.id ? data.todo : item; });
    todos.sort(function (a, b) { return Number(a.done) - Number(b.done) || b.id - a.id; });
    render();
  }

  async function removeTodo(todo) {
    showError("");
    var response = await fetch(API + "/todos/" + todo.id, { method: "DELETE", headers: headers });
    if (!response.ok) {
      showError("할일을 삭제하지 못했습니다.");
      return;
    }
    todos = todos.filter(function (item) { return item.id !== todo.id; });
    render();
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var title = input.value.trim();
    if (!title) return;
    showError("");
    var response = await fetch(API + "/todos", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ title: title }),
    });
    if (!response.ok) {
      showError("할일을 추가하지 못했습니다.");
      return;
    }
    var data = await response.json();
    todos.unshift(data.todo);
    input.value = "";
    render();
    input.focus();
  });

  load().catch(function () {
    showError("할일 목록을 불러오지 못했습니다.");
    render();
  });
})();
