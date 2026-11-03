(function () {
  var API = "https://nae-diary-notify.jjinytm.workers.dev";
  var headers = {
    "Content-Type": "application/json",
    "X-Diary-Sync": "575dc6f9f6eafc1d4246ca0c4991655e",
  };
  var WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
  var trips = [];
  var selectedId = null;
  var editingTripId = null;
  var editingStopId = null;

  var countEl = document.getElementById("trip-count");
  var errorEl = document.getElementById("trip-error");
  var listEl = document.getElementById("trip-list");
  var emptyEl = document.getElementById("trip-empty");
  var detailEmpty = document.getElementById("trip-detail-empty");
  var detailEl = document.getElementById("trip-detail");
  var titleEl = document.getElementById("trip-title");
  var metaEl = document.getElementById("trip-meta");
  var daysEl = document.getElementById("trip-days");
  var dayNote = document.getElementById("trip-day-note");
  var dialog = document.getElementById("trip-dialog");
  var form = document.getElementById("trip-form");
  var formHeading = document.getElementById("trip-form-heading");
  var nameInput = document.getElementById("trip-name");
  var placeInput = document.getElementById("trip-place");
  var startInput = document.getElementById("trip-start");
  var endInput = document.getElementById("trip-end");
  var memoInput = document.getElementById("trip-memo");
  var stopForm = document.getElementById("stop-form");
  var stopDate = document.getElementById("stop-date");
  var stopTime = document.getElementById("stop-time");
  var stopTitle = document.getElementById("stop-title");
  var stopMemo = document.getElementById("stop-memo");
  var stopSave = document.getElementById("stop-save");
  var stopCancel = document.getElementById("stop-cancel");

  function showError(message) {
    errorEl.hidden = !message;
    errorEl.textContent = message || "";
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function dateKey(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function parseKey(key) {
    var parts = String(key || "").split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function formatDay(key) {
    var date = parseKey(key);
    return (date.getMonth() + 1) + "월 " + date.getDate() + "일 " + WEEKDAYS[date.getDay()] + "요일";
  }

  function formatShort(key) {
    return String(key || "").slice(5).replace("-", ".");
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char];
    });
  }

  function selectedTrip() {
    var found = null;
    trips.forEach(function (trip) {
      if (String(trip.id) === String(selectedId)) found = trip;
    });
    return found;
  }

  function daysFor(trip) {
    var start = trip.startDate;
    var end = trip.endDate;
    (trip.stops || []).forEach(function (stop) {
      if (stop.date < start) start = stop.date;
      if (stop.date > end) end = stop.date;
    });
    var days = [];
    var cursor = parseKey(start);
    var guard = 0;
    while (dateKey(cursor) <= end && guard < 400) {
      days.push(dateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }
    if (days.length <= 45) return { days: days, trimmed: false };
    var used = {};
    (trip.stops || []).forEach(function (stop) { used[stop.date] = true; });
    return { days: Object.keys(used).sort(), trimmed: true };
  }

  function resetStopForm(date) {
    editingStopId = null;
    stopForm.reset();
    stopDate.value = date || "";
    stopSave.textContent = "추가";
    stopCancel.hidden = true;
  }

  function paintList() {
    countEl.textContent = trips.length ? "여행 " + trips.length + "개" : "등록된 여행이 없습니다";
    listEl.innerHTML = "";
    emptyEl.hidden = trips.length > 0;
    trips.forEach(function (trip) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "trip-item" + (String(trip.id) === String(selectedId) ? " is-active" : "");
      button.dataset.id = trip.id;
      button.innerHTML =
        '<strong>' + escapeHtml(trip.title) + "</strong>" +
        "<span>" + escapeHtml(formatShort(trip.startDate) + " – " + formatShort(trip.endDate)) +
        (trip.place ? " · " + escapeHtml(trip.place) : "") + "</span>";
      listEl.appendChild(button);
    });
  }

  function paintDetail() {
    var trip = selectedTrip();
    detailEmpty.hidden = !!trip;
    detailEl.hidden = !trip;
    if (!trip) return;
    titleEl.textContent = trip.title;
    metaEl.textContent = formatDay(trip.startDate) + " – " + formatDay(trip.endDate) +
      (trip.place ? " · " + trip.place : "") +
      (trip.memo ? " · " + trip.memo : "");
    var plan = daysFor(trip);
    dayNote.hidden = !plan.trimmed;
    dayNote.textContent = plan.trimmed ? "기간이 길어 계획이 있는 날만 모았습니다. 위 칸에서 다른 날짜도 추가할 수 있습니다." : "";
    var byDate = {};
    (trip.stops || []).forEach(function (stop) {
      if (!byDate[stop.date]) byDate[stop.date] = [];
      byDate[stop.date].push(stop);
    });
    daysEl.innerHTML = "";
    if (!editingStopId && !stopDate.value) stopDate.value = trip.startDate;
    if (!plan.days.length) {
      daysEl.innerHTML = '<p class="trip-day-empty">아직 계획이 없습니다. 날짜와 시간을 정해 추가하세요.</p>';
      return;
    }
    plan.days.forEach(function (day) {
      var section = document.createElement("section");
      section.className = "trip-day";
      var stops = byDate[day] || [];
      var items = stops.map(function (stop) {
        return '<li class="trip-stop"><time>' + escapeHtml(stop.time) + "</time><div><strong>" +
          escapeHtml(stop.title) + "</strong>" +
          (stop.memo ? '<p>' + escapeHtml(stop.memo) + "</p>" : "") +
          '</div><button type="button" class="ks-btn" data-edit="' + stop.id + '">수정</button>' +
          '<button type="button" class="ks-btn ks-btn-danger" data-delete="' + stop.id + '">삭제</button></li>';
      }).join("");
      section.innerHTML =
        '<button type="button" class="trip-day-head" data-day="' + day + '">' + escapeHtml(formatDay(day)) + "</button>" +
        (items ? '<ul class="trip-stops">' + items + "</ul>" : '<p class="trip-day-empty">이 날의 계획이 없습니다.</p>');
      daysEl.appendChild(section);
    });
  }

  function paint() {
    paintList();
    paintDetail();
  }

  async function loadTrips() {
    showError("");
    var response = await fetch(API + "/travel", { headers: headers });
    if (!response.ok) throw new Error("load");
    var data = await response.json();
    trips = data.trips || [];
    if (selectedId && !trips.some(function (trip) { return String(trip.id) === String(selectedId); })) {
      selectedId = null;
    }
    if (!selectedId && trips.length) selectedId = trips[0].id;
    paint();
  }

  function openTripForm(trip) {
    editingTripId = trip ? trip.id : null;
    formHeading.textContent = trip ? "여행 수정" : "새 여행";
    nameInput.value = trip ? trip.title : "";
    placeInput.value = trip ? trip.place : "";
    startInput.value = trip ? trip.startDate : "";
    endInput.value = trip ? trip.endDate : "";
    memoInput.value = trip ? trip.memo : "";
    dialog.showModal();
    nameInput.focus();
  }

  document.getElementById("trip-add").addEventListener("click", function () {
    openTripForm(null);
  });

  document.getElementById("trip-edit").addEventListener("click", function () {
    var trip = selectedTrip();
    if (trip) openTripForm(trip);
  });

  document.getElementById("trip-close").addEventListener("click", function () {
    dialog.close();
  });

  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) dialog.close();
  });

  listEl.addEventListener("click", function (event) {
    var button = event.target.closest(".trip-item");
    if (!button) return;
    selectedId = button.dataset.id;
    resetStopForm(selectedTrip() ? selectedTrip().startDate : "");
    paint();
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    showError("");
    if (endInput.value < startInput.value) {
      showError("종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }
    var payload = {
      title: nameInput.value.trim(),
      place: placeInput.value.trim(),
      startDate: startInput.value,
      endDate: endInput.value,
      memo: memoInput.value.trim(),
    };
    try {
      var response = await fetch(API + (editingTripId ? "/travel/trips/" + editingTripId : "/travel"), {
        method: editingTripId ? "PUT" : "POST",
        headers: headers,
        body: JSON.stringify(payload),
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || !data.trip) throw new Error("save");
      dialog.close();
      selectedId = data.trip.id;
      await loadTrips();
      resetStopForm(data.trip.startDate);
    } catch (err) {
      showError("여행을 저장하지 못했습니다.");
    }
  });

  document.getElementById("trip-delete").addEventListener("click", async function () {
    var trip = selectedTrip();
    if (!trip) return;
    if (!window.confirm("이 여행과 들어 있는 계획을 삭제할까요?")) return;
    showError("");
    try {
      var response = await fetch(API + "/travel/trips/" + trip.id, { method: "DELETE", headers: headers });
      if (!response.ok) throw new Error("delete");
      selectedId = null;
      resetStopForm("");
      await loadTrips();
    } catch (err) {
      showError("여행을 삭제하지 못했습니다.");
    }
  });

  stopCancel.addEventListener("click", function () {
    var trip = selectedTrip();
    resetStopForm(trip ? trip.startDate : "");
  });

  daysEl.addEventListener("click", function (event) {
    var day = event.target.closest("[data-day]");
    if (day && event.target === day) {
      stopDate.value = day.dataset.day;
      stopTime.focus();
      return;
    }
    var edit = event.target.closest("[data-edit]");
    if (edit) {
      var trip = selectedTrip();
      var stop = null;
      (trip && trip.stops || []).forEach(function (item) {
        if (String(item.id) === String(edit.dataset.edit)) stop = item;
      });
      if (!stop) return;
      editingStopId = stop.id;
      stopDate.value = stop.date;
      stopTime.value = stop.time;
      stopTitle.value = stop.title;
      stopMemo.value = stop.memo || "";
      stopSave.textContent = "저장";
      stopCancel.hidden = false;
      stopTitle.focus();
      return;
    }
    var remove = event.target.closest("[data-delete]");
    if (!remove) return;
    showError("");
    fetch(API + "/travel/stops/" + remove.dataset.delete, { method: "DELETE", headers: headers })
      .then(function (response) {
        if (!response.ok) throw new Error("delete");
        return loadTrips();
      })
      .catch(function () {
        showError("계획을 삭제하지 못했습니다.");
      });
  });

  stopForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var trip = selectedTrip();
    if (!trip) return;
    showError("");
    var payload = {
      date: stopDate.value,
      time: stopTime.value,
      title: stopTitle.value.trim(),
      memo: stopMemo.value.trim(),
    };
    try {
      var response = await fetch(API + (editingStopId ? "/travel/stops/" + editingStopId : "/travel/trips/" + trip.id + "/stops"), {
        method: editingStopId ? "PUT" : "POST",
        headers: headers,
        body: JSON.stringify(payload),
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || !data.stop) throw new Error("save");
      var keepDate = payload.date;
      await loadTrips();
      resetStopForm(keepDate);
    } catch (err) {
      showError("계획을 저장하지 못했습니다.");
    }
  });

  loadTrips().catch(function () {
    countEl.textContent = "여행을 불러오지 못했습니다";
    showError("여행을 불러오지 못했습니다.");
  });
})();
