(function () {
  var API = "https://nae-diary-notify.jjinytm.workers.dev";
  var headers = {
    "Content-Type": "application/json",
    "X-Diary-Sync": "575dc6f9f6eafc1d4246ca0c4991655e",
  };
  var WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  var schedules = [];
  var holidays = {};
  var holidayNotice = "";
  var holidayRequestId = 0;
  var holidayCache = new Map();
  var holidayPending = new Map();
  var editingId = null;
  var now = new Date();
  var visible = new Date(now.getFullYear(), now.getMonth(), 1);
  var dragStart = null;
  var dragEnd = null;
  var dragMoved = false;
  var dragging = false;
  var rangeReady = false;
  var suppressClick = false;
  var grid = document.getElementById("sched-grid");
  var label = document.getElementById("sched-label");
  var count = document.getElementById("sched-count");
  var error = document.getElementById("sched-error");
  var dialog = document.getElementById("sched-dialog");
  var form = document.getElementById("sched-form");
  var dayLabel = document.getElementById("sched-day-label");
  var dayList = document.getElementById("sched-day-list");
  var dateInput = document.getElementById("sched-date");
  var endDateInput = document.getElementById("sched-end-date");
  var periodSummary = document.getElementById("sched-period-summary");
  var timeInput = document.getElementById("sched-time");
  var allDayInput = document.getElementById("sched-all-day");
  var titleInput = document.getElementById("sched-title");
  var memoInput = document.getElementById("sched-memo");
  var saveButton = document.getElementById("sched-save");
  var deleteButton = document.getElementById("sched-delete");
  var rangeAdd = document.getElementById("sched-range-add");
  var sideList = document.getElementById("sched-side-list");
  var sideCount = document.getElementById("sched-side-count");
  var holidayNoticeEl = document.getElementById("sched-holiday-notice");
  var priorityButtons = Array.prototype.slice.call(document.querySelectorAll(".sched-priority-btn"));
  var selectedPriority = "보통";

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

  function rangeBounds() {
    if (!dragStart || !dragEnd) return null;
    return dragStart < dragEnd
      ? { from: dragStart, to: dragEnd }
      : { from: dragEnd, to: dragStart };
  }

  function eachDate(from, to, fn) {
    for (var cursor = parseKey(from); dateKey(cursor) <= to; cursor.setDate(cursor.getDate() + 1)) {
      fn(dateKey(cursor));
    }
  }

  function dayCount(from, to) {
    if (!from || !to || to < from) return 0;
    return Math.round((parseKey(to) - parseKey(from)) / 86400000) + 1;
  }

  function showError(message) {
    error.hidden = !message;
    error.textContent = message || "";
  }

  function setHolidayNotice(message) {
    holidayNotice = message || "";
    if (!holidayNoticeEl) return;
    holidayNoticeEl.hidden = !holidayNotice;
    holidayNoticeEl.textContent = holidayNotice;
  }

  function fetchHolidays(year, month) {
    var key = year + "-" + month;
    var saved = holidayCache.get(key);
    if (saved && saved.expires > Date.now()) return Promise.resolve(saved.result);
    var existing = holidayPending.get(key);
    if (existing) return existing;
    var request = (async function () {
      var result;
      try {
        var response = await fetch(API + "/holidays?year=" + year + "&month=" + month, {
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw new Error("holiday");
        var body = await response.json();
        if (typeof body.status !== "string" || !Array.isArray(body.holidays)) throw new Error("holiday");
        result = body;
      } catch (err) {
        result = {
          status: saved ? "STALE" : "UNAVAILABLE",
          holidays: saved && saved.result ? saved.result.holidays : [],
        };
      }
      if (holidayCache.size >= 120 && !holidayCache.has(key)) {
        holidayCache.delete(holidayCache.keys().next().value);
      }
      holidayCache.set(key, {
        expires: Date.now() + (result.status === "OK" ? 6 * 60 * 60 * 1000 : 60 * 1000),
        result: result,
      });
      return result;
    })().finally(function () {
      holidayPending.delete(key);
    });
    holidayPending.set(key, request);
    return request;
  }

  function loadHolidays() {
    var requestId = ++holidayRequestId;
    var year = visible.getFullYear();
    var month = visible.getMonth();
    var first = new Date(year, month, 1);
    var start = new Date(year, month, 1 - first.getDay());
    var end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 41);
    var requests = [];
    setHolidayNotice("");
    for (var cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor <= end; cursor.setMonth(cursor.getMonth() + 1)) {
      requests.push(fetchHolidays(cursor.getFullYear(), cursor.getMonth() + 1));
    }
    Promise.all(requests).then(function (results) {
      if (requestId !== holidayRequestId) return;
      var dates = {};
      results.forEach(function (result) {
        (result.holidays || []).forEach(function (item) {
          if (!item || !item.date || !item.name) return;
          dates[item.date] = dates[item.date] ? dates[item.date] + " · " + item.name : item.name;
        });
      });
      holidays = dates;
      if (results.some(function (result) { return result.status === "NOT_CONFIGURED"; })) {
        setHolidayNotice("공휴일 연동 인증키가 설정되지 않았습니다.");
      } else if (results.some(function (result) { return result.status !== "OK"; })) {
        setHolidayNotice("공휴일 정보를 최신 상태로 확인하지 못했습니다.");
      } else {
        setHolidayNotice("");
      }
      render();
    }).catch(function () {
      if (requestId !== holidayRequestId) return;
      setHolidayNotice("공휴일 정보를 불러오지 못했습니다.");
    });
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
      function rank(value) {
        if (value === "높음") return 0;
        if (value === "낮음") return 2;
        return 1;
      }
      var priorityDiff = rank(a.priority) - rank(b.priority);
      if (priorityDiff) return priorityDiff;
      var left = a.allDay ? "00:00" : String(a.time || "99:99");
      var right = b.allDay ? "00:00" : String(b.time || "99:99");
      return left.localeCompare(right) || a.id - b.id;
    });
  }

  function setPriority(value) {
    selectedPriority = value === "높음" || value === "낮음" ? value : "보통";
    priorityButtons.forEach(function (button) {
      button.classList.toggle("is-on", button.dataset.priority === selectedPriority);
    });
  }

  function syncAllDayUi() {
    var on = allDayInput.checked;
    timeInput.disabled = on;
    if (on) timeInput.value = "";
    allDayInput.closest(".sched-all-day").classList.toggle("is-on", on);
  }

  function chipLabel(item) {
    var prefix = item.allDay ? "종일 " : item.time ? item.time + " " : "";
    return prefix + item.title;
  }

  function monthCount() {
    var prefix = visible.getFullYear() + "-" + pad(visible.getMonth() + 1);
    return schedules.filter(function (item) { return String(item.date || "").indexOf(prefix) === 0; }).length;
  }

  function clearRange() {
    dragStart = null;
    dragEnd = null;
    dragMoved = false;
    rangeReady = false;
    hideRangeAdd();
  }

  function hideRangeAdd() {
    rangeAdd.hidden = true;
  }

  function showRangeAdd(x, y) {
    rangeAdd.hidden = false;
    var left = Math.min(x, window.innerWidth - 128);
    var top = Math.min(y, window.innerHeight - 48);
    rangeAdd.style.left = Math.max(8, left) + "px";
    rangeAdd.style.top = Math.max(8, top) + "px";
  }

  function paintRange() {
    var bounds = rangeBounds();
    var highlight = rangeReady || dragMoved;
    Array.prototype.forEach.call(grid.querySelectorAll(".sched-day[data-date]"), function (cell) {
      var key = cell.dataset.date;
      var on = highlight && bounds && key >= bounds.from && key <= bounds.to;
      cell.classList.toggle("is-range", Boolean(on));
    });
  }

  function updatePeriodSummary() {
    var from = dateInput.value;
    var to = endDateInput.value || from;
    var days = dayCount(from, to);
    if (!from) {
      periodSummary.hidden = true;
      periodSummary.textContent = "";
      return;
    }
    periodSummary.hidden = false;
    if (days <= 1) {
      periodSummary.textContent = from + " · 1일";
    } else {
      periodSummary.textContent = from + " ~ " + to + " · 총 " + days + "일 (같은 내용으로 각 날짜에 등록)";
    }
  }

  function monthItems() {
    var prefix = visible.getFullYear() + "-" + pad(visible.getMonth() + 1);
    return schedules.filter(function (item) {
      return String(item.date || "").indexOf(prefix) === 0;
    }).sort(function (a, b) {
      var dateDiff = String(a.date).localeCompare(String(b.date));
      if (dateDiff) return dateDiff;
      var left = a.allDay ? "00:00" : String(a.time || "99:99");
      var right = b.allDay ? "00:00" : String(b.time || "99:99");
      return left.localeCompare(right) || a.id - b.id;
    });
  }

  function sideWhen(item) {
    var parts = String(item.date || "").split("-");
    var day = parts.length === 3 ? Number(parts[2]) + "일" : "";
    if (item.allDay) return day + "\n종일";
    if (item.time) return day + "\n" + item.time;
    return day || "—";
  }

  function renderSideList() {
    var items = monthItems();
    sideCount.textContent = items.length ? items.length + "개" : "";
    sideList.replaceChildren();
    if (!items.length) {
      var empty = document.createElement("p");
      empty.className = "sched-side-empty";
      empty.textContent = "이번 달 등록된 일정이 없습니다.";
      sideList.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      var button = document.createElement("button");
      button.type = "button";
      var level = item.priority === "높음" || item.priority === "낮음" ? item.priority : "보통";
      button.className = "sched-side-item" +
        (level === "높음" ? " is-high" : level === "낮음" ? " is-low" : "");
      var when = document.createElement("span");
      when.className = "sched-side-when";
      when.textContent = sideWhen(item);
      var title = document.createElement("span");
      title.className = "sched-side-title";
      title.textContent = item.title;
      var meta = document.createElement("span");
      meta.className = "sched-side-meta";
      meta.textContent = level + (item.memo ? " · " + item.memo : "");
      button.append(when, title, meta);
      button.addEventListener("click", function () {
        openDay(item.date, item.id);
      });
      sideList.appendChild(button);
    });
  }

  function render() {
    label.textContent = visible.getFullYear() + "년 " + (visible.getMonth() + 1) + "월";
    var monthTotal = monthCount();
    count.textContent = monthTotal ? "이번 달 일정 " + monthTotal + "개" : "이번 달 일정이 없습니다";
    renderSideList();
    grid.replaceChildren();
    var year = visible.getFullYear();
    var month = visible.getMonth();
    var first = new Date(year, month, 1);
    var start = new Date(year, month, 1 - first.getDay());
    var today = todayKey();
    for (var index = 0; index < 42; index += 1) {
      var date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      var key = dateKey(date);
      var currentMonth = date.getMonth() === month;
      var items = onDate(key);
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "sched-day";
      if (!currentMonth) cell.classList.add("is-other");
      if (date.getDay() === 0) cell.classList.add("is-sun");
      if (date.getDay() === 6) cell.classList.add("is-sat");
      if (key === today) cell.classList.add("is-today");
      var holidayName = holidays[key];
      if (holidayName) cell.classList.add("is-holiday");
      var heading = document.createElement("div");
      heading.className = "sched-day-heading";
      var number = document.createElement("span");
      number.className = "sched-num";
      number.textContent = String(date.getDate());
      heading.appendChild(number);
      if (holidayName) {
        var holiday = document.createElement("span");
        holiday.className = "sched-holiday-name";
        holiday.title = holidayName;
        holiday.textContent = holidayName;
        heading.appendChild(holiday);
      }
      cell.appendChild(heading);
      items.slice(0, 3).forEach(function (item) {
        var chip = document.createElement("button");
        chip.type = "button";
        var level = item.priority === "높음" || item.priority === "낮음" ? item.priority : "보통";
        chip.className = "sched-chip" +
          (level === "높음" ? " is-high" : level === "낮음" ? " is-low" : "");
        chip.dataset.date = key;
        chip.dataset.id = String(item.id);
        chip.textContent = chipLabel(item);
        chip.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
        chip.addEventListener("click", function (event) {
          event.stopPropagation();
          clearRange();
          paintRange();
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
      cell.dataset.date = key;
      cell.dataset.current = currentMonth ? "1" : "0";
      cell.addEventListener("pointerdown", onCellPointerDown);
      cell.addEventListener("pointerenter", onCellPointerEnter);
      cell.addEventListener("pointerup", onCellPointerUp);
      cell.addEventListener("click", onCellClick);
      grid.appendChild(cell);
    }
    paintRange();
  }

  function onCellPointerDown(event) {
    if (event.button !== 0) return;
    var key = event.currentTarget.dataset.date;
    if (!key) return;
    dragging = true;
    dragStart = key;
    dragEnd = key;
    dragMoved = false;
    rangeReady = false;
    hideRangeAdd();
    paintRange();
  }

  function onCellPointerEnter(event) {
    if (!dragging || !(event.buttons & 1) || !dragStart) return;
    var key = event.currentTarget.dataset.date;
    if (!key || key === dragEnd) return;
    if (key !== dragStart) dragMoved = true;
    dragEnd = key;
    paintRange();
  }

  function finishDrag(event) {
    if (!dragStart) {
      dragging = false;
      return;
    }
    if (dragging && dragMoved && dragEnd && dragEnd !== dragStart) {
      rangeReady = true;
      suppressClick = true;
      if (event) showRangeAdd(event.clientX + 8, event.clientY + 8);
      paintRange();
    } else if (!rangeReady) {
      hideRangeAdd();
      paintRange();
    }
    dragging = false;
    dragMoved = false;
  }

  function onCellPointerUp(event) {
    finishDrag(event);
  }

  function onCellClick(event) {
    if (suppressClick || rangeReady) {
      suppressClick = false;
      return;
    }
    var key = event.currentTarget.dataset.date;
    var current = event.currentTarget.dataset.current === "1";
    clearRange();
    paintRange();
    if (!current) {
      var date = parseKey(key);
      visible = new Date(date.getFullYear(), date.getMonth(), 1);
      render();
      loadHolidays();
    }
    openDay(key, null);
  }

  function fillForm(item) {
    editingId = item ? item.id : null;
    dateInput.value = item ? item.date : dateInput.value;
    if (!item) {
      if (!endDateInput.value || endDateInput.value < dateInput.value) {
        endDateInput.value = dateInput.value;
      }
    } else {
      endDateInput.value = item.date;
    }
    allDayInput.checked = Boolean(item && item.allDay);
    timeInput.value = item && item.time ? item.time : "";
    syncAllDayUi();
    setPriority(item && item.priority ? item.priority : "보통");
    titleInput.value = item ? item.title : "";
    memoInput.value = item ? item.memo || "" : "";
    saveButton.textContent = item ? "저장" : "추가";
    deleteButton.hidden = !item;
    endDateInput.disabled = Boolean(item);
    endDateInput.hidden = Boolean(item);
    updatePeriodSummary();
  }

  function renderDayList(key) {
    dayList.replaceChildren();
    onDate(key).forEach(function (item) {
      var row = document.createElement("li");
      var button = document.createElement("button");
      button.type = "button";
      button.className = "sched-pick" + (item.id === editingId ? " is-on" : "");
      button.setAttribute("aria-pressed", item.id === editingId ? "true" : "false");
      button.textContent = chipLabel(item);
      button.addEventListener("click", function () {
        fillForm(item);
        renderDayList(item.date);
        var active = dayList.querySelector(".sched-pick.is-on");
        if (active) active.focus();
        else titleInput.focus();
      });
      row.appendChild(button);
      dayList.appendChild(row);
    });
  }

  function openDay(key, id) {
    var date = parseKey(key);
    dayLabel.textContent = date.getFullYear() + "년 " + (date.getMonth() + 1) + "월 " + date.getDate() + "일 " + WEEKDAYS[date.getDay()];
    dateInput.value = key;
    endDateInput.value = key;
    dayList.hidden = false;
    var current = null;
    if (id) schedules.forEach(function (item) { if (item.id === id) current = item; });
    fillForm(current);
    renderDayList(key);
    dialog.showModal();
    titleInput.focus();
  }

  function openRange(from, to) {
    var start = parseKey(from);
    var end = parseKey(to);
    var days = dayCount(from, to);
    dayLabel.textContent =
      start.getFullYear() + "년 " + (start.getMonth() + 1) + "월 " + start.getDate() + "일" +
      " ~ " +
      end.getFullYear() + "년 " + (end.getMonth() + 1) + "월 " + end.getDate() + "일" +
      " (" + days + "일)";
    dateInput.value = from;
    endDateInput.value = to;
    dayList.replaceChildren();
    dayList.hidden = true;
    fillForm(null);
    hideRangeAdd();
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

  async function createOne(body) {
    var response = await fetch(API + "/schedules", {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("save");
    return response.json();
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var title = titleInput.value.trim();
    var from = dateInput.value;
    var to = endDateInput.value || from;
    if (!title || !from) return;
    if (to < from) {
      showError("종료일은 시작일과 같거나 이후여야 합니다.");
      return;
    }
    var payloadBase = {
      title: title,
      time: allDayInput.checked ? "" : timeInput.value,
      allDay: allDayInput.checked,
      priority: selectedPriority,
      memo: memoInput.value.trim(),
    };

    if (editingId) {
      var body = Object.assign({ date: from }, payloadBase);
      var response = await fetch(API + "/schedules/" + editingId, {
        method: "PUT",
        headers: headers,
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        showError("일정을 저장하지 못했습니다.");
        return;
      }
      var data = await response.json();
      schedules = schedules.map(function (item) { return item.id === editingId ? data.schedule : item; });
      var savedDate = data.schedule ? data.schedule.date : body.date;
      var saved = parseKey(savedDate);
      visible = new Date(saved.getFullYear(), saved.getMonth(), 1);
      clearRange();
      render();
      dialog.close();
      showToast("저장되었습니다.");
      return;
    }

    var created = [];
    var failed = false;
    var dates = [];
    eachDate(from, to, function (key) { dates.push(key); });
    saveButton.disabled = true;
    try {
      for (var i = 0; i < dates.length; i += 1) {
        try {
          var result = await createOne(Object.assign({ date: dates[i] }, payloadBase));
          if (result.schedule) {
            schedules.push(result.schedule);
            created.push(result.schedule);
          }
        } catch (e) {
          failed = true;
          break;
        }
      }
    } finally {
      saveButton.disabled = false;
    }

    if (!created.length) {
      showError("일정을 저장하지 못했습니다.");
      return;
    }
    var focus = parseKey(created[0].date);
    visible = new Date(focus.getFullYear(), focus.getMonth(), 1);
    clearRange();
    render();
    dialog.close();
    if (failed) {
      showError("일부 날짜만 저장되었습니다. 다시 저장해 주세요.");
      showToast(created.length + "일 저장됨");
    } else {
      showError("");
      showToast(created.length > 1 ? created.length + "개 일정이 등록되었습니다." : "저장되었습니다.");
    }
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
    clearRange();
    render();
    dialog.close();
    showToast("삭제되었습니다.");
  });

  dateInput.addEventListener("change", function () {
    if (!endDateInput.value || endDateInput.value < dateInput.value) {
      endDateInput.value = dateInput.value;
    }
    updatePeriodSummary();
  });
  endDateInput.addEventListener("change", updatePeriodSummary);
  allDayInput.addEventListener("change", syncAllDayUi);
  priorityButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setPriority(button.dataset.priority);
    });
  });
  setPriority("보통");
  syncAllDayUi();

  rangeAdd.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    var bounds = rangeBounds();
    if (!bounds) return;
    openRange(bounds.from, bounds.to);
  });

  document.getElementById("sched-close").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", function () {
    dayList.hidden = false;
    endDateInput.hidden = false;
    endDateInput.disabled = false;
  });

  document.getElementById("sched-prev").addEventListener("click", function () {
    clearRange();
    visible = new Date(visible.getFullYear(), visible.getMonth() - 1, 1);
    render();
    loadHolidays();
  });
  document.getElementById("sched-next").addEventListener("click", function () {
    clearRange();
    visible = new Date(visible.getFullYear(), visible.getMonth() + 1, 1);
    render();
    loadHolidays();
  });
  document.getElementById("sched-today").addEventListener("click", function () {
    clearRange();
    var today = new Date();
    visible = new Date(today.getFullYear(), today.getMonth(), 1);
    render();
    loadHolidays();
  });

  window.addEventListener("pointerup", finishDrag);
  window.addEventListener("pointercancel", function () {
    dragging = false;
    dragMoved = false;
  });
  document.addEventListener("pointerdown", function (event) {
    if (rangeReady && !event.target.closest("#sched-range-add") && !event.target.closest(".sched-day")) {
      clearRange();
      paintRange();
    }
  });

  load().then(function () {
    loadHolidays();
  }).catch(function () {
    showError("일정을 불러오지 못했습니다.");
    render();
    loadHolidays();
  });
})();
