(function () {
  var API = "https://nae-diary-notify.jjinytm.workers.dev";
  var headers = {
    "Content-Type": "application/json",
    "X-Diary-Sync": "575dc6f9f6eafc1d4246ca0c4991655e",
  };
  var todos = [];
  var editingId = null;
  var saving = false;
  var selectedTag = "";
  var selectedMonth = "";
  var filterAllPeriod = false;
  var list = document.getElementById("todo-list");
  var searchInput = document.getElementById("todo-search");
  var tagFilters = document.getElementById("todo-tag-filters");
  var yearSelect = document.getElementById("todo-filter-year");
  var monthFilters = document.getElementById("todo-filter-months");
  var allPeriodButton = document.getElementById("todo-filter-all");
  var empty = document.getElementById("todo-empty");
  var count = document.getElementById("todo-count");
  var error = document.getElementById("todo-error");
  var form = document.getElementById("todo-form");
  var input = document.getElementById("todo-input");
  var priorityInput = document.getElementById("todo-priority");
  var tagInput = document.getElementById("todo-tag");
  var requesterInput = document.getElementById("todo-requester");
  var aiInput = document.getElementById("todo-ai");
  var workInput = document.getElementById("todo-work");
  var filesRoot = document.getElementById("todo-files");
  var submitButton = document.getElementById("todo-submit");
  var cancelButton = document.getElementById("todo-cancel");
  var openButton = document.getElementById("todo-open");
  var createdDateInput = document.getElementById("todo-created-date");
  var carryButton = document.getElementById("todo-carry");
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

  function createdDateValue(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    function part(type) {
      var found = parts.find(function (item) { return item.type === type; });
      return found ? found.value : "";
    }
    return part("year") + "-" + part("month") + "-" + part("day");
  }

  function todayDateValue() {
    return createdDateValue(new Date().toISOString());
  }

  var formButtonAnchor = document.getElementById("todo-work-label");

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
    priorityInput.value = "보통";
    tagInput.value = "";
    requesterInput.value = "";
    aiInput.value = "CLAUDE";
    workInput.innerHTML = "";
    createdDateInput.value = "";
    createdDateInput.hidden = true;
    carryButton.hidden = true;
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

  function fileField(tag, value, placeholder, maxLength) {
    var field = document.createElement(tag);
    if (tag === "input") field.type = "text";
    field.placeholder = placeholder;
    field.maxLength = maxLength;
    field.value = value || "";
    return field;
  }

  function readFileItem(row) {
    if (row.classList.contains("is-editing")) {
      var fields = row.querySelectorAll("input, textarea");
      return { filename: fields[0].value.trim(), changeNote: fields[1].value.trim() };
    }
    return {
      filename: row.querySelector(".todo-file-name").textContent.trim(),
      changeNote: row.querySelector(".todo-file-note").textContent.trim(),
    };
  }

  function showFileItem(row, filename, changeNote) {
    row.classList.remove("is-editing");
    var name = document.createElement("span");
    name.className = "todo-file-name";
    name.textContent = filename;
    var note = document.createElement("span");
    note.className = "todo-file-note";
    note.textContent = changeNote;
    var edit = document.createElement("button");
    edit.type = "button";
    edit.className = "ks-btn ks-btn-quiet todo-file-edit";
    edit.textContent = "수정";
    edit.addEventListener("click", function () { editFileItem(row); });
    row.replaceChildren(name, note, edit);
  }

  function editFileItem(row) {
    var current = readFileItem(row);
    row.classList.add("is-editing");
    var name = fileField("input", current.filename, "파일명", 200);
    var note = fileField("textarea", current.changeNote, "수정내용", 4000);
    note.rows = 1;
    var done = document.createElement("button");
    done.type = "button";
    done.className = "ks-btn ks-btn-quiet todo-file-edit";
    done.textContent = "완료";
    done.addEventListener("click", function () {
      var filename = name.value.trim();
      var changeNote = note.value.trim();
      if (!filename && !changeNote) {
        row.remove();
        return;
      }
      showFileItem(row, filename, changeNote);
    });
    row.replaceChildren(name, note, done);
    name.focus();
  }

  function appendFileItem(listEl, filename, changeNote) {
    var row = document.createElement("div");
    row.className = "todo-file-item";
    row.tabIndex = 0;
    showFileItem(row, filename, changeNote);
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
      head.appendChild(label);
      var list = document.createElement("div");
      list.className = "todo-file-list";
      (files || []).forEach(function (file) {
        if (file.category !== category) return;
        var filename = String(file.filename || "").trim();
        var changeNote = String(file.changeNote || "").trim();
        if (!filename && !changeNote) return;
        appendFileItem(list, filename, changeNote);
      });
      var compose = document.createElement("div");
      compose.className = "todo-file-compose";
      var name = fileField("input", "", "파일명", 200);
      var note = fileField("textarea", "", "수정내용", 4000);
      var add = document.createElement("button");
      add.type = "button";
      add.className = "ks-btn ks-btn-quiet todo-file-add";
      add.textContent = "추가";
      add.addEventListener("click", function () {
        var filename = name.value.trim();
        var changeNote = note.value.trim();
        if (!filename && !changeNote) return;
        appendFileItem(list, filename, changeNote);
        name.value = "";
        note.value = "";
        name.focus();
      });
      compose.append(name, note, add);
      block.append(head, list, compose);
      filesRoot.appendChild(block);
    });
  }

  function readFiles() {
    var files = [];
    filesRoot.querySelectorAll(".todo-file-cat").forEach(function (block) {
      block.querySelectorAll(".todo-file-item").forEach(function (row) {
        var item = readFileItem(row);
        if (!item.filename && !item.changeNote) return;
        files.push({ category: block.dataset.category, filename: item.filename, changeNote: item.changeNote });
      });
    });
    return files;
  }

  function priorityRank(value) {
    if (value === "높음") return 0;
    if (value === "낮음") return 2;
    return 1;
  }

  function priorityClass(value) {
    if (value === "높음") return "todo-priority todo-priority-high";
    if (value === "낮음") return "todo-priority todo-priority-low";
    return "todo-priority todo-priority-mid";
  }

  function priorityValue(value) {
    return value === "높음" || value === "낮음" ? value : "보통";
  }

  function sortTodos() {
    todos.sort(function (a, b) {
      var done = Number(Boolean(a.done)) - Number(Boolean(b.done));
      if (done) return done;
      var rank = priorityRank(a.priority) - priorityRank(b.priority);
      if (rank) return rank;
      return b.id - a.id;
    });
  }

  function paintPriority(line, priority) {
    var value = priorityValue(priority);
    var pill = line.querySelector(".todo-priority");
    if (!pill) {
      pill = document.createElement("span");
      var tag = line.querySelector(".todo-tag");
      var anchor = line.querySelector(".todo-ai") || line.querySelector("button") || line.querySelector(".todo-title");
      if (tag && tag.nextSibling) line.insertBefore(pill, tag.nextSibling);
      else if (tag) line.appendChild(pill);
      else line.insertBefore(pill, anchor);
    }
    pill.className = priorityClass(value);
    pill.textContent = value;
  }

  function placeOpenRow() {
    sortTodos();
    var row = document.querySelector(".todo-row.is-open");
    if (!row) return;
    var index = -1;
    todos.forEach(function (item, itemIndex) {
      if (item.id === editingId) index = itemIndex;
    });
    if (index < 0) return;
    var rows = Array.prototype.slice.call(list.children);
    var from = rows.indexOf(row);
    if (from < 0) return;
    rows.splice(from, 1);
    rows.splice(index, 0, row);
    rows.forEach(function (item) { list.appendChild(item); });
    applySearch();
  }

  function kstPart(date, type) {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    var found = parts.find(function (item) { return item.type === type; });
    return found ? found.value : "";
  }

  function currentYearMonth() {
    var now = new Date();
    return { year: kstPart(now, "year"), month: kstPart(now, "month") };
  }

  function todoYearMonth(todo) {
    var date = new Date(todo.createdAt);
    if (Number.isNaN(date.getTime())) return { year: "", month: "" };
    return { year: kstPart(date, "year"), month: kstPart(date, "month") };
  }

  function selectedPeriod() {
    if (filterAllPeriod) return { year: "", month: "" };
    return {
      year: yearSelect.value || "",
      month: selectedMonth || "",
    };
  }

  function matchesPeriod(todo) {
    var period = selectedPeriod();
    if (!period.year && !period.month) return true;
    var ym = todoYearMonth(todo);
    if (period.year && ym.year !== period.year) return false;
    if (period.month && ym.month !== period.month) return false;
    return true;
  }

  function fillYearOptions() {
    var current = currentYearMonth();
    var years = {};
    years[current.year] = true;
    todos.forEach(function (todo) {
      var ym = todoYearMonth(todo);
      if (ym.year) years[ym.year] = true;
    });
    var yearList = Object.keys(years).sort(function (a, b) { return Number(b) - Number(a); });
    var prevYear = yearSelect.value;
    yearSelect.replaceChildren();
    yearList.forEach(function (year) {
      var option = document.createElement("option");
      option.value = year;
      option.textContent = year + "년";
      yearSelect.appendChild(option);
    });
    yearSelect.value = yearList.indexOf(prevYear) >= 0 ? prevYear : current.year;
  }

  function renderMonthFilters() {
    if (!selectedMonth) selectedMonth = currentYearMonth().month;
    monthFilters.replaceChildren();
    for (var month = 1; month <= 12; month += 1) {
      var value = String(month).padStart(2, "0");
      var button = document.createElement("button");
      button.type = "button";
      button.className = "todo-month-filter" + (!filterAllPeriod && selectedMonth === value ? " is-on" : "");
      button.textContent = month + "월";
      button.disabled = filterAllPeriod;
      button.setAttribute("aria-pressed", !filterAllPeriod && selectedMonth === value ? "true" : "false");
      button.addEventListener("click", function (next) {
        return function () {
          selectedMonth = next;
          filterAllPeriod = false;
          paintPeriodState();
          renderMonthFilters();
          renderTagFilters();
          applySearch();
        };
      }(value));
      monthFilters.appendChild(button);
    }
  }

  function paintPeriodState() {
    yearSelect.disabled = filterAllPeriod;
    allPeriodButton.classList.toggle("is-on", filterAllPeriod);
    allPeriodButton.setAttribute("aria-pressed", filterAllPeriod ? "true" : "false");
  }

  function uniqueTags() {
    var map = {};
    todos.forEach(function (todo) {
      if (!matchesPeriod(todo)) return;
      var tag = String(todo.tag || "").trim();
      if (tag) map[tag] = true;
    });
    return Object.keys(map).sort(function (a, b) {
      return a.localeCompare(b, "ko");
    });
  }

  function renderTagFilters() {
    var tags = uniqueTags();
    tagFilters.replaceChildren();
    if (selectedTag && tags.indexOf(selectedTag) === -1) selectedTag = "";

    function addButton(label, value, fullWidth) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "todo-tag-filter" +
        (fullWidth ? " is-all" : "") +
        (selectedTag === value ? " is-on" : "");
      button.textContent = label;
      button.setAttribute("aria-pressed", selectedTag === value ? "true" : "false");
      button.addEventListener("click", function () {
        selectedTag = selectedTag === value ? "" : value;
        renderTagFilters();
        applySearch();
      });
      tagFilters.appendChild(button);
    }

    addButton("전체", "", true);
    tags.forEach(function (tag) { addButton(tag, tag, false); });
  }

  function render() {
    sortTodos();
    parkForm();
    list.replaceChildren();
    fillYearOptions();
    renderMonthFilters();
    paintPeriodState();
    var open = todos.filter(function (todo) { return !todo.done; }).length;
    count.innerHTML = open ? "남은 할일 <span class=\"todo-count-num\">" + open + "</span>개" : "남은 할일이 없습니다";
    renderTagFilters();
    todos.forEach(function (todo) {
      var row = document.createElement("li");
      row.className = "todo-row" + (todo.done ? " is-done" : "");
      row.dataset.tag = String(todo.tag || "").trim();
      var ym = todoYearMonth(todo);
      row.dataset.year = ym.year;
      row.dataset.month = ym.month;
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
      paintPriority(line, todo.priority);
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
    applySearch();
  }

  function applySearch() {
    var query = searchInput.value.trim().toLowerCase();
    var period = selectedPeriod();
    var shown = 0;
    list.querySelectorAll(".todo-row").forEach(function (row) {
      var title = row.querySelector(".todo-title");
      var text = title ? title.textContent.toLowerCase() : "";
      var tag = row.dataset.tag || "";
      var matchTitle = !query || text.indexOf(query) !== -1;
      var matchTag = !selectedTag || tag === selectedTag;
      var matchYear = !period.year || row.dataset.year === period.year;
      var matchMonth = !period.month || row.dataset.month === period.month;
      var match = matchTitle && matchTag && matchYear && matchMonth;
      row.hidden = !match;
      if (match) shown += 1;
    });
    if (!todos.length) {
      empty.hidden = false;
      empty.textContent = "아직 할일이 없습니다.";
      return;
    }
    if (!shown) {
      empty.hidden = false;
      if (query) empty.textContent = "검색 결과가 없습니다.";
      else if (selectedTag) empty.textContent = "해당 태그의 할일이 없습니다.";
      else if (!filterAllPeriod) empty.textContent = "선택한 연월의 할일이 없습니다.";
      else empty.textContent = "표시할 할일이 없습니다.";
      return;
    }
    empty.hidden = true;
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
    priorityInput.value = priorityValue(todo.priority);
    tagInput.value = todo.tag || "";
    requesterInput.value = todo.requester || "";
    aiInput.value = todo.aiTool || "";
    workInput.innerHTML = editorHtml(todo.workContent);
    renderFileEditor(todo.files || []);
    createdDateInput.value = todayDateValue();
    createdDateInput.hidden = false;
    carryButton.hidden = false;
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

  function syncOpenRow(todo) {
    var row = document.querySelector(".todo-row.is-open");
    if (!row || !todo) return;
    var line = row.querySelector(".todo-line");
    var titleButton = line.querySelector(".todo-title");
    titleButton.textContent = todo.title;
    var tag = line.querySelector(".todo-tag");
    if (todo.tag) {
      if (!tag) {
        tag = document.createElement("span");
        tag.className = "todo-tag";
        line.insertBefore(tag, line.firstChild);
      }
      tag.textContent = todo.tag;
    } else if (tag) {
      tag.remove();
    }
    paintPriority(line, todo.priority);
    var ai = line.querySelector(".todo-ai");
    if (todo.aiTool) {
      if (!ai) {
        ai = document.createElement("span");
        ai.className = "todo-ai";
        line.insertBefore(ai, line.querySelector("button") || titleButton);
      }
      ai.className = "todo-ai todo-ai-" + String(todo.aiTool).toLowerCase();
      ai.textContent = todo.aiTool;
    } else if (ai) {
      ai.remove();
    }
    var bits = [];
    if (todo.requester) bits.push(todo.requester);
    var created = formatCreated(todo.createdAt);
    if (created) bits.push(created);
    row.querySelector(".todo-meta").textContent = bits.join(" · ");
    applySearch();
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

  document.addEventListener("keydown", function (event) {
    if (event.code !== "KeyS" || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
    if (!editingId || !document.querySelector(".todo-row.is-open")) return;
    event.preventDefault();
    if (saving) return;
    if (typeof form.requestSubmit === "function") form.requestSubmit();
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (saving) return;
    var title = input.value.trim();
    if (!title) return;
    saving = true;
    try {
      showError("");
      var body = {
        title: title,
        priority: priorityInput.value,
        tag: tagInput.value.trim(),
        requester: requesterInput.value.trim(),
        aiTool: aiInput.value,
        workContent: editorHtml(workInput.innerHTML),
        files: readFiles(),
      };
      if (editingId && createdDateInput.value) body.createdAt = createdDateInput.value;
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
        var current = null;
        todos.forEach(function (item) {
          if (item.id === editingId) current = item;
        });
        var beforeDate = current ? createdDateValue(current.createdAt) : "";
        if (current && data.todo) Object.assign(current, data.todo);
        var afterDate = data.todo ? createdDateValue(data.todo.createdAt) : beforeDate;
        if (beforeDate !== afterDate) {
          parkForm();
          resetForm();
          render();
          showToast("이월되었습니다.");
          return;
        }
        syncOpenRow(current || data.todo);
        placeOpenRow();
        showToast("저장되었습니다.");
        return;
      }
      todos.unshift(data.todo);
      parkForm();
      if (dialog.open) dialog.close();
      resetForm();
      render();
      input.focus();
    } finally {
      saving = false;
    }
  });

  cancelButton.addEventListener("click", function () {
    parkForm();
    if (dialog.open) dialog.close();
    document.querySelectorAll(".todo-edit").forEach(function (slot) { slot.hidden = true; });
    resetForm();
  });

  carryButton.addEventListener("click", function () {
    if (!createdDateInput.value) createdDateInput.value = todayDateValue();
    if (typeof form.requestSubmit === "function") form.requestSubmit();
    else form.dispatchEvent(new Event("submit", { cancelable: true }));
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
    if (todo.priority) meta.push("중요도 " + priorityValue(todo.priority));
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
      html += "<h3>작업파일</h3><p class=\"notion-files\">";
      var lines = [];
      fileCategories.forEach(function (category) {
        var matched = files.filter(function (file) { return file.category === category; });
        if (!matched.length) return;
        lines.push("- " + category);
        matched.forEach(function (file) {
          var name = String(file.filename || "").replace(/\t/g, " ").trim();
          var note = String(file.changeNote || "").replace(/\t/g, " ").trim();
          if (name) lines.push(name);
          note.split("\n").forEach(function (part) {
            var line = part.trim();
            if (line) lines.push(line);
          });
        });
      });
      text += lines.join("\n") + "\n";
      html += lines.map(function (line) { return escapeHtml(line); }).join("<br>");
      html += "</p>";
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

  searchInput.addEventListener("input", applySearch);
  yearSelect.addEventListener("change", function () {
    filterAllPeriod = false;
    paintPeriodState();
    renderMonthFilters();
    renderTagFilters();
    applySearch();
  });
  allPeriodButton.addEventListener("click", function () {
    filterAllPeriod = !filterAllPeriod;
    if (!filterAllPeriod) {
      var current = currentYearMonth();
      if (!yearSelect.value) yearSelect.value = current.year;
      if (!selectedMonth) selectedMonth = current.month;
    }
    paintPeriodState();
    renderMonthFilters();
    renderTagFilters();
    applySearch();
  });
  (function initPeriod() {
    var current = currentYearMonth();
    selectedMonth = current.month;
    fillYearOptions();
    yearSelect.value = current.year;
    filterAllPeriod = false;
    paintPeriodState();
    renderMonthFilters();
  })();
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

  var selectionCopyButton = null;
  var selectionCopyText = "";

  function ensureSelectionCopyButton() {
    if (selectionCopyButton) return selectionCopyButton;
    selectionCopyButton = document.createElement("button");
    selectionCopyButton.type = "button";
    selectionCopyButton.id = "todo-selection-copy";
    selectionCopyButton.className = "todo-selection-copy";
    selectionCopyButton.textContent = "복사";
    selectionCopyButton.hidden = true;
    document.body.appendChild(selectionCopyButton);
    selectionCopyButton.addEventListener("mousedown", function (event) {
      event.preventDefault();
    });
    selectionCopyButton.addEventListener("click", async function () {
      var text = selectionCopyText;
      if (!text) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          var area = document.createElement("textarea");
          area.value = text;
          area.setAttribute("readonly", "");
          area.style.position = "fixed";
          area.style.left = "-9999px";
          document.body.appendChild(area);
          area.select();
          document.execCommand("copy");
          area.remove();
        }
        selectionCopyButton.textContent = "복사됨";
        showToast("복사되었습니다.");
        setTimeout(function () {
          if (selectionCopyButton) selectionCopyButton.textContent = "복사";
          hideSelectionCopy();
        }, 900);
      } catch (error) {
        selectionCopyButton.textContent = "실패";
        setTimeout(function () {
          if (selectionCopyButton) selectionCopyButton.textContent = "복사";
        }, 900);
      }
    });
    return selectionCopyButton;
  }

  function hideSelectionCopy() {
    selectionCopyText = "";
    if (!selectionCopyButton) return;
    selectionCopyButton.hidden = true;
  }

  function selectionInsideWork(range) {
    if (!range || !workInput) return false;
    return workInput.contains(range.commonAncestorContainer) ||
      workInput === range.commonAncestorContainer;
  }

  function updateSelectionCopy() {
    var selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount < 1) {
      hideSelectionCopy();
      return;
    }
    var range = selection.getRangeAt(0);
    if (!selectionInsideWork(range)) {
      hideSelectionCopy();
      return;
    }
    var text = String(selection.toString() || "").replace(/\u00a0/g, " ").trim();
    if (!text) {
      hideSelectionCopy();
      return;
    }
    selectionCopyText = String(selection.toString() || "").replace(/\u00a0/g, " ");
    var rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) {
      hideSelectionCopy();
      return;
    }
    var button = ensureSelectionCopyButton();
    button.textContent = "복사";
    button.hidden = false;
    var left = Math.min(window.innerWidth - 72, Math.max(8, rect.right + 8));
    var top = Math.min(window.innerHeight - 40, Math.max(8, rect.top - 4));
    button.style.left = left + "px";
    button.style.top = top + "px";
  }

  document.addEventListener("mouseup", function () {
    setTimeout(updateSelectionCopy, 0);
  });
  document.addEventListener("keyup", function () {
    setTimeout(updateSelectionCopy, 0);
  });
  document.addEventListener("selectionchange", function () {
    if (!selectionCopyButton || selectionCopyButton.hidden) return;
    var selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selectionInsideWork(selection.rangeCount ? selection.getRangeAt(0) : null)) {
      hideSelectionCopy();
    }
  });
  document.addEventListener("scroll", hideSelectionCopy, true);
  window.addEventListener("resize", hideSelectionCopy);

  renderFileEditor([]);

  load().catch(function () {
    showError("할일 목록을 불러오지 못했습니다.");
    render();
  });
})();
