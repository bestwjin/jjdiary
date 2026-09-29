(function () {
  var API = "https://nae-diary-notify.jjinytm.workers.dev";
  var headers = {
    "Content-Type": "application/json",
    "X-Diary-Sync": "575dc6f9f6eafc1d4246ca0c4991655e",
  };
  var todos = [];
  var editingId = null;
  var list = document.getElementById("todo-list");
  var empty = document.getElementById("todo-empty");
  var count = document.getElementById("todo-count");
  var error = document.getElementById("todo-error");
  var form = document.getElementById("todo-form");
  var input = document.getElementById("todo-input");
  var tagInput = document.getElementById("todo-tag");
  var requesterInput = document.getElementById("todo-requester");
  var submitButton = document.getElementById("todo-submit");
  var cancelButton = document.getElementById("todo-cancel");

  function showError(message) {
    error.hidden = !message;
    error.textContent = message || "";
  }

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

  function resetForm() {
    editingId = null;
    input.value = "";
    tagInput.value = "";
    requesterInput.value = "";
    submitButton.textContent = "추가";
    cancelButton.hidden = true;
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
      var title = document.createElement("span");
      title.className = "todo-title";
      title.textContent = todo.title;
      line.appendChild(title);
      var meta = document.createElement("div");
      meta.className = "todo-meta";
      var bits = [];
      if (todo.requester) bits.push("요청자 " + todo.requester);
      var created = formatCreated(todo.createdAt);
      if (created) bits.push("등록 " + created);
      meta.textContent = bits.join(" · ");
      main.append(line, meta);

      var actions = document.createElement("div");
      actions.className = "todo-actions";
      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "todo-delete";
      edit.textContent = "수정";
      edit.addEventListener("click", function () { startEdit(todo); });
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "todo-delete";
      remove.textContent = "삭제";
      remove.addEventListener("click", function () { removeTodo(todo); });
      actions.append(edit, remove);
      row.append(check, main, actions);
      list.appendChild(row);
    });
  }

  function startEdit(todo) {
    editingId = todo.id;
    input.value = todo.title;
    tagInput.value = todo.tag || "";
    requesterInput.value = todo.requester || "";
    submitButton.textContent = "수정 완료";
    cancelButton.hidden = false;
    input.focus();
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
    if (editingId === todo.id) resetForm();
    todos = todos.filter(function (item) { return item.id !== todo.id; });
    render();
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var title = input.value.trim();
    if (!title) return;
    showError("");
    var body = { title: title, tag: tagInput.value.trim(), requester: requesterInput.value.trim() };
    var response = await fetch(editingId ? API + "/todos/" + editingId : API + "/todos", {
      method: editingId ? "PUT" : "POST",
      headers: headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      showError(editingId ? "할일을 수정하지 못했습니다." : "할일을 추가하지 못했습니다.");
      return;
    }
    var data = await response.json();
    if (editingId) {
      todos = todos.map(function (item) { return item.id === editingId ? data.todo : item; });
    } else {
      todos.unshift(data.todo);
    }
    resetForm();
    render();
    input.focus();
  });

  cancelButton.addEventListener("click", function () {
    resetForm();
    input.focus();
  });

  load().catch(function () {
    showError("할일 목록을 불러오지 못했습니다.");
    render();
  });
})();
