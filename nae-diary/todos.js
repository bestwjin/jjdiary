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
  var aiInput = document.getElementById("todo-ai");
  var workInput = document.getElementById("todo-work");
  var filesRoot = document.getElementById("todo-files");
  var submitButton = document.getElementById("todo-submit");
  var cancelButton = document.getElementById("todo-cancel");
  var openButton = document.getElementById("todo-open");
  var dialog = document.getElementById("todo-dialog");
  var notionDialog = document.getElementById("notion-dialog");
  var notionPreview = document.getElementById("notion-preview");
  var notionCopy = document.getElementById("notion-copy");
  var notionClose = document.getElementById("notion-close");
  var notionPayload = { html: "", text: "" };
  var fileCategories = ["DB", "JAVA", "JSP", "XML", "기타"];

  function showToast(message) {
    var toast = document.getElementById("todo-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "todo-toast";
      toast.className = "todo-toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-on");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () { toast.classList.remove("is-on"); }, 1800);
  }

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

  var formButtonAnchor = form.querySelector(".todo-label");

  function restoreFormButtons() {
    form.insertBefore(submitButton, formButtonAnchor);
    form.insertBefore(cancelButton, formButtonAnchor);
  }

  function parkForm() {
    restoreFormButtons();
    dialog.appendChild(form);
    document.querySelectorAll(".todo-row.is-open").forEach(function (item) { item.classList.remove("is-open"); });
  }

  function resetForm() {
    editingId = null;
    input.value = "";
    tagInput.value = "";
    requesterInput.value = "";
    aiInput.value = "";
    workInput.innerHTML = "";
    renderFileEditor([]);
    submitButton.textContent = "추가";
    cancelButton.hidden = false;
  }

  function openCreate() {
    parkForm();
    resetForm();
    dialog.showModal();
    input.focus();
  }

  function addFileRow(listEl, filename, changeNote) {
    var row = document.createElement("div");
    row.className = "todo-file-row";
    var name = document.createElement("input");
    name.type = "text";
    name.placeholder = "파일명";
    name.maxLength = 200;
    name.value = filename || "";
    var note = document.createElement("textarea");
    note.placeholder = "수정내용";
    note.maxLength = 4000;
    note.value = changeNote || "";
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ks-btn ks-btn-quiet";
    remove.textContent = "삭제";
    remove.addEventListener("click", function () { row.remove(); });
    row.append(name, note, remove);
    listEl.appendChild(row);
  }

  function renderFileEditor(files) {
    filesRoot.replaceChildren();
    fileCategories.forEach(function (category) {
      var block = document.createElement("section");
      block.className = "todo-file-cat";
      block.dataset.category = category;
      var head = document.createElement("div");
      head.className = "todo-file-cat-head";
      var label = document.createElement("span");
      label.textContent = category;
      var add = document.createElement("button");
      add.type = "button";
      add.className = "ks-btn ks-btn-quiet";
      add.textContent = "추가";
      var rows = document.createElement("div");
      add.addEventListener("click", function () { addFileRow(rows, "", ""); });
      head.append(label, add);
      var matched = (files || []).filter(function (file) { return file.category === category; });
      if (matched.length) matched.forEach(function (file) { addFileRow(rows, file.filename, file.changeNote); });
      else addFileRow(rows, "", "");
      block.append(head, rows);
      filesRoot.appendChild(block);
    });
  }

  function readFiles() {
    var files = [];
    filesRoot.querySelectorAll(".todo-file-cat").forEach(function (block) {
      block.querySelectorAll(".todo-file-row").forEach(function (row) {
        var fields = row.querySelectorAll("input, textarea");
        var filename = fields[0].value.trim();
        var changeNote = fields[1].value.trim();
        if (!filename && !changeNote) return;
        files.push({ category: block.dataset.category, filename: filename, changeNote: changeNote });
      });
    });
    return files;
  }

  function render() {
    parkForm();
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
      if (todo.aiTool) {
        var ai = document.createElement("span");
        ai.className = "todo-ai todo-ai-" + String(todo.aiTool).toLowerCase();
        ai.textContent = todo.aiTool;
        line.appendChild(ai);
      }
      var title = document.createElement("button");
      title.type = "button";
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

      var actions = document.createElement("div");
      actions.className = "todo-actions";
      var notion = document.createElement("button");
      notion.type = "button";
      notion.className = "ks-btn ks-btn-quiet";
      notion.textContent = "노션";
      notion.addEventListener("click", function () { openNotion(todo); });
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "ks-btn ks-btn-quiet ks-btn-danger";
      remove.textContent = "삭제";
      remove.addEventListener("click", function () { removeTodo(todo); });
      actions.append(notion, remove);
      var editor = document.createElement("div");
      editor.className = "todo-edit";
      editor.hidden = true;
      title.addEventListener("click", function () { startEdit(todo, editor); });
      row.append(check, main, actions, editor);
      list.appendChild(row);
    });
  }

  function startEdit(todo, editor) {
    if (editingId === todo.id && !editor.hidden) {
      editor.hidden = true;
      parkForm();
      resetForm();
      return;
    }
    if (dialog.open) dialog.close();
    document.querySelectorAll(".todo-edit").forEach(function (slot) { slot.hidden = true; });
    document.querySelectorAll(".todo-row.is-open").forEach(function (item) { item.classList.remove("is-open"); });
    editingId = todo.id;
    input.value = todo.title;
    tagInput.value = todo.tag || "";
    requesterInput.value = todo.requester || "";
    aiInput.value = todo.aiTool || "";
    workInput.innerHTML = editorHtml(todo.workContent);
    renderFileEditor(todo.files || []);
    submitButton.textContent = "저장";
    cancelButton.hidden = false;
    editor.hidden = false;
    editor.appendChild(form);
    var row = editor.closest(".todo-row");
    row.classList.add("is-open");
    var titleButton = row.querySelector(".todo-title");
    titleButton.before(submitButton);
    titleButton.before(cancelButton);
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
    var body = {
      title: title,
      tag: tagInput.value.trim(),
      requester: requesterInput.value.trim(),
      aiTool: aiInput.value,
      workContent: editorHtml(workInput.innerHTML),
      files: readFiles(),
    };
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
    var wasEdit = Boolean(editingId);
    parkForm();
    if (dialog.open) dialog.close();
    resetForm();
    render();
    if (wasEdit) showToast("저장되었습니다.");
    else input.focus();
  });

  cancelButton.addEventListener("click", function () {
    parkForm();
    if (dialog.open) dialog.close();
    document.querySelectorAll(".todo-edit").forEach(function (slot) { slot.hidden = true; });
    resetForm();
  });

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char];
    });
  }

  function formatNotionDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    var parts = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "numeric",
      day: "numeric",
    }).formatToParts(date);
    function part(type) {
      var found = parts.find(function (item) { return item.type === type; });
      return found ? found.value : "";
    }
    return part("month") + "월 " + part("day") + "일 등록.";
  }

  function editorHtml(value) {
    var text = String(value || "");
    if (!text.trim()) return "";
    if (!/<[a-z][\s\S]*>/i.test(text)) {
      text = text.split(/\r?\n/).map(function (line) { return "<p>" + escapeHtml(line) + "</p>"; }).join("");
    }
    var allowed = { P: 1, BR: 1, B: 1, STRONG: 1, I: 1, EM: 1, U: 1, UL: 1, OL: 1, LI: 1, DIV: 1, H1: 1, H2: 1, H3: 1 };
    var doc = new DOMParser().parseFromString(text, "text/html");
    function clean(node) {
      Array.from(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) return;
        if (child.nodeType !== 1 || !allowed[child.tagName]) {
          if (child.nodeType === 1) {
            while (child.firstChild) node.insertBefore(child.firstChild, child);
          }
          child.remove();
          return;
        }
        Array.from(child.attributes).forEach(function (attr) { child.removeAttribute(attr.name); });
        clean(child);
      });
    }
    clean(doc.body);
    var plain = doc.body.innerText.replace(/\u00a0/g, " ").trim();
    return plain ? doc.body.innerHTML.slice(0, 20000) : "";
  }

  function workContentHtml(value) {
    var html = editorHtml(value);
    if (html) return html;
    return "";
  }

  function workContentText(value) {
    var html = editorHtml(value);
    if (!html) return "";
    return new DOMParser().parseFromString(html, "text/html").body.innerText.trim();
  }

  function buildNotion(todo) {
    var heading = (todo.tag ? "[" + todo.tag + "] " : "") + todo.title;
    var dateLine = formatNotionDate(todo.createdAt);
    var meta = [];
    if (todo.requester) meta.push("요청자 " + todo.requester);
    if (todo.aiTool) meta.push(todo.aiTool);
    var text = heading + "\n\n" + (dateLine ? dateLine + "\n\n" : "");
    if (meta.length) text += meta.join(" · ") + "\n\n";
    text += workContentText(todo.workContent);
    var html = "<h1>" + escapeHtml(heading) + "</h1>";
    if (dateLine) html += "<p>" + escapeHtml(dateLine) + "</p>";
    if (meta.length) html += "<p>" + escapeHtml(meta.join(" · ")) + "</p>";
    html += workContentHtml(todo.workContent);
    var files = todo.files || [];
    if (files.length) {
      text += (text && !text.endsWith("\n\n") ? "\n\n" : "\n") + "### 작업파일\n";
      html += "<h3>작업파일</h3>";
      fileCategories.forEach(function (category) {
        var matched = files.filter(function (file) { return file.category === category; });
        if (!matched.length) return;
        text += "\n- " + category + "\n";
        html += "<p>- " + escapeHtml(category) + "</p>";
        matched.forEach(function (file) {
          var name = String(file.filename || "").replace(/\t/g, " ");
          var note = String(file.changeNote || "").replace(/\t/g, " ");
          text += name + (note ? "\n" + note : "") + "\n";
          html += "<p>" + escapeHtml(name);
          if (note) html += (name ? "<br>" : "") + escapeHtml(note).replace(/\n/g, "<br>");
          html += "</p>";
        });
      });
    }
    return { html: html, text: text.trim() + "\n" };
  }

  function openNotion(todo) {
    notionPayload = buildNotion(todo);
    notionPreview.innerHTML = notionPayload.html;
    notionCopy.textContent = "복사";
    notionDialog.showModal();
  }

  notionClose.addEventListener("click", function () { notionDialog.close(); });
  notionDialog.addEventListener("click", function (event) {
    if (event.target === notionDialog) notionDialog.close();
  });
  async function copyNotion() {
    var htmlBlob = new Blob([notionPayload.html], { type: "text/html" });
    var textBlob = new Blob([notionPayload.text], { type: "text/plain" });
    if (navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob })]);
        return;
      } catch (error) {}
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(notionPayload.text);
        return;
      } catch (error) {}
    }
    var area = document.createElement("textarea");
    area.value = notionPayload.text;
    document.body.appendChild(area);
    area.select();
    var ok = document.execCommand("copy");
    area.remove();
    if (!ok) throw new Error("copy");
  }

  notionCopy.addEventListener("click", async function () {
    try {
      await copyNotion();
      notionCopy.textContent = "복사됨";
    } catch (error) {
      notionCopy.textContent = "복사 실패";
    }
  });

  openButton.addEventListener("click", openCreate);
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) {
      dialog.close();
      resetForm();
    }
  });

  function applyCommand(command) {
    workInput.focus();
    var listTag = command === "insertUnorderedList" ? "ul" : command === "insertOrderedList" ? "ol" : "";
    document.execCommand(command, false, null);
    if (!listTag) return;
    if (workInput.querySelector(listTag)) return;
    document.execCommand("insertHTML", false, "<" + listTag + "><li><br></li></" + listTag + ">");
  }

  document.querySelectorAll(".wysiwyg-bar button").forEach(function (button) {
    button.addEventListener("mousedown", function (event) { event.preventDefault(); });
    button.addEventListener("click", function () {
      applyCommand(button.getAttribute("data-cmd"));
    });
  });

  renderFileEditor([]);

  load().catch(function () {
    showError("할일 목록을 불러오지 못했습니다.");
    render();
  });
})();
