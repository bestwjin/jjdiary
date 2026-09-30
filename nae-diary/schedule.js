(function () {
  var API = "https://nae-diary-notify.jjinytm.workers.dev";
  var headers = {
    "Content-Type": "application/json",
    "X-Diary-Sync": "575dc6f9f6eafc1d4246ca0c4991655e",
  };
  var WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  var schedules = [];
  var editingId = null;
  var now = new Date();
  var visible = new Date(now.getFullYear(), now.getMonth(), 1);
  var grid = document.getElementById("sched-grid");
  var label = document.getElementById("sched-label");
  var count = document.getElementById("sched-count");
  var error = document.getElementById("sched-error");
  var dialog = document.getElementById("sched-dialog");
  var form = document.getElementById("sched-form");
  var dayLabel = document.getElementById("sched-day-label");
  var dayList = document.getElementById("sched-day-list");
  var dateInput = document.getElementById("sched-date");
  var timeInput = document.getElementById("sched-time");
  var titleInput = document.getElementById("sched-title");
  var memoInput = document.getElementById("sched-memo");
  var saveButton = document.getElementById("sched-save");
  var deleteButton = document.getElementById("sched-delete");

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function dateKey(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function todayKey() {
    return dateKey(new Date());
  }

  function parseKey(key) {
    var parts = key.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function showError(message) {
    error.hidden = !message;
    error.textContent = message || "";
  }

  function showToast(message) {
    var toast = document.getElementById("sched-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "sched-toast";
      toast.className = "todo-toast";
      toast.setAttribute("role", "status");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-on");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(function () { toast.classList.remove("is-on"); }, 1800);
  }

  function onDate(key) {
    return schedules.filter(function (item) { return item.date === key; }).sort(function (a, b) {
      return String(a.time || "99:99").localeCompare(String(b.time || "99:99")) || a.id - b.id;
    });
  }

  function monthCount() {
    var prefix = visible.getFullYear() + "-" + pad(visible.getMonth() + 1);
    return schedules.filter(function (item) { return String(item.date || "").indexOf(prefix) === 0; }).length;
  }

  function render() {
    label.textContent = visible.getFullYear() + "년 " + (visible.getMonth() + 1) + "월";
    var monthTotal = monthCount();
    count.textContent = monthTotal ? "이번 달 일정 " + monthTotal + "개" : "이번 달 일정이 없습니다";
    grid.replaceChildren();
    var year = visible.getFullYear();
    var month = visible.getMonth();
    var first = new Date(year, month, 1).getDay();
    var days = new Date(year, month + 1, 0).getDate();
    var today = todayKey();
    for (var blank = 0; blank < first; blank += 1) {
      var spacer = document.createElement("div");
      spacer.className = "sched-day is-blank";
      grid.appendChild(spacer);
    }
    for (var day = 1; day <= days; day += 1) {
      var date = new Date(year, month, day);
      var key = dateKey(date);
      var items = onDate(key);
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "sched-day";
      if (date.getDay() === 0) cell.classList.add("is-sun");
      if (date.getDay() === 6) cell.classList.add("is-sat");
      if (key === today) cell.classList.add("is-today");
      var number = document.createElement("span");
      number.className = "sched-num";
      number.textContent = String(day);
      cell.appendChild(number);
      items.slice(0, 3).forEach(function (item) {
        var chip = document.createElement("span");
        chip.className = "sched-chip";
        chip.dataset.date = key;
        chip.dataset.id = String(item.id);
        chip.textContent = (item.time ? item.time + " " : "") + item.title;
        chip.addEventListener("click", function (event) {
          event.stopPropagation();
          openDay(event.currentTarget.dataset.date, Number(event.currentTarget.dataset.id));
        });
        cell.appendChild(chip);
      });
      if (items.length > 3) {
        var more = document.createElement("span");
        more.className = "sched-more";
        more.textContent = "+" + (items.length - 3);
        cell.appendChild(more);
      }
      cell.addEventListener("click", function (event) {
        var chosen = event.currentTarget.dataset.date;
        openDay(chosen, null);
      });
      cell.dataset.date = key;
      grid.appendChild(cell);
    }
  }

  function fillForm(item) {
    editingId = item ? item.id : null;
    dateInput.value = item ? item.date : dateInput.value;
    timeInput.value = item && item.time ? item.time : "";
    titleInput.value = item ? item.title : "";
    memoInput.value = item ? item.memo || "" : "";
    saveButton.textContent = item ? "저장" : "추가";
    deleteButton.hidden = !item;
  }

  function renderDayList(key) {
    dayList.replaceChildren();
    onDate(key).forEach(function (item) {
      var row = document.createElement("li");
      var button = document.createElement("button");
      button.type = "button";
      button.className = "sched-pick" + (item.id === editingId ? " is-on" : "");
      button.textContent = (item.time ? item.time + " " : "") + item.title;
      button.addEventListener("click", function () {
        fillForm(item);
        renderDayList(item.date);
        titleInput.focus();
      });
      row.appendChild(button);
      dayList.appendChild(row);
    });
  }

  function openDay(key, id) {
    var date = parseKey(key);
    dayLabel.textContent = date.getFullYear() + "년 " + (date.getMonth() + 1) + "월 " + date.getDate() + "일 " + WEEKDAYS[date.getDay()];
    dateInput.value = key;
    var current = null;
    if (id) schedules.forEach(function (item) { if (item.id === id) current = item; });
    fillForm(current);
    renderDayList(key);
    dialog.showModal();
    titleInput.focus();
  }

  async function load() {
    showError("");
    var response = await fetch(API + "/schedules", { headers: headers });
    if (!response.ok) throw new Error("load");
    var data = await response.json();
    schedules = data.schedules || [];
    render();
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var title = titleInput.value.trim();
    if (!title || !dateInput.value) return;
    var body = {
      title: title,
      date: dateInput.value,
      time: timeInput.value,
      memo: memoInput.value.trim(),
    };
    var response = await fetch(editingId ? API + "/schedules/" + editingId : API + "/schedules", {
      method: editingId ? "PUT" : "POST",
      headers: headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      showError("일정을 저장하지 못했습니다.");
      return;
    }
    var data = await response.json();
    if (editingId) {
      schedules = schedules.map(function (item) { return item.id === editingId ? data.schedule : item; });
    } else if (data.schedule) {
      schedules.push(data.schedule);
    }
    var savedDate = data.schedule ? data.schedule.date : body.date;
    var saved = parseKey(savedDate);
    visible = new Date(saved.getFullYear(), saved.getMonth(), 1);
    render();
    dialog.close();
    showToast("저장되었습니다.");
  });

  deleteButton.addEventListener("click", async function () {
    if (!editingId) return;
    var response = await fetch(API + "/schedules/" + editingId, { method: "DELETE", headers: headers });
    if (!response.ok) {
      showError("일정을 삭제하지 못했습니다.");
      return;
    }
    schedules = schedules.filter(function (item) { return item.id !== editingId; });
    editingId = null;
    render();
    dialog.close();
    showToast("삭제되었습니다.");
  });

  document.getElementById("sched-close").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) dialog.close();
  });
  document.getElementById("sched-prev").addEventListener("click", function () {
    visible = new Date(visible.getFullYear(), visible.getMonth() - 1, 1);
    render();
  });
  document.getElementById("sched-next").addEventListener("click", function () {
    visible = new Date(visible.getFullYear(), visible.getMonth() + 1, 1);
    render();
  });
  document.getElementById("sched-today").addEventListener("click", function () {
    var today = new Date();
    visible = new Date(today.getFullYear(), today.getMonth(), 1);
    render();
  });

  load().catch(function () {
    showError("일정을 불러오지 못했습니다.");
    render();
  });
})();
