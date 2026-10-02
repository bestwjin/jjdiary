(function () {
  var API = "https://nae-diary-notify.jjinytm.workers.dev";
  var headers = {
    "Content-Type": "application/json",
    "X-Diary-Sync": "575dc6f9f6eafc1d4246ca0c4991655e",
  };
  var TYPE_CLASS = {
    "registration-open": "is-reg-open",
    "info-session": "is-info",
    application: "is-app",
    lottery: "is-lot",
    registration: "is-reg",
  };
  var TYPE_LABEL = {
    "registration-open": "접수",
    "info-session": "설명회",
    application: "원서접수",
    lottery: "추첨",
    registration: "등록",
  };
  var PRIORITY_LABEL = { high: "높음", medium: "보통", low: "낮음" };
  var PRIORITY_CLASS = { high: "prio-high", medium: "prio-medium", low: "prio-low" };
  var WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
  var DEFAULT_EVENTS = [
    { id: 1, date: "2026-09-28", title: "상명초 설명회 접수 시작", school: "상명초등학교", type: "registration-open", description: "~ 10월 16일까지", priority: "medium" },
    { id: 3, date: "2026-10-12", title: "화랑초 설명회 접수", school: "화랑초등학교", type: "registration-open", description: "사전 신청", priority: "medium" },
    { id: 4, date: "2026-10-16", title: "상명초 설명회 접수 마감", school: "상명초등학교", type: "registration-open", description: "신청 마지막 날", priority: "high" },
    { id: 5, date: "2026-10-16", title: "태강삼육초 설명회 접수", school: "태강삼육초등학교", time: "09:00", type: "registration-open", description: "~ 10월 31일", priority: "medium" },
    { id: 6, date: "2026-10-18", title: "금성초 설명회 접수", school: "금성초등학교", type: "registration-open", description: "홈페이지 신청", priority: "medium" },
    { id: 10, date: "2026-10-23", title: "화랑초 입학설명회 1차", school: "화랑초등학교", time: "09:30", type: "info-session", description: "설명회 + 교내투어 (200명)", priority: "medium" },
    { id: 11, date: "2026-10-24", title: "상명사대부초 설명회 1차", school: "상명사대부초등학교", time: "09:20", type: "info-session", priority: "medium" },
    { id: 12, date: "2026-10-25", title: "상명초 입학설명회", school: "상명초등학교", time: "10:00", type: "info-session", priority: "medium" },
    { id: 14, date: "2026-10-28", title: "태강삼육초 설명회", school: "태강삼육초등학교", time: "10:00", type: "info-session", description: "대면/비대면", priority: "medium" },
    { id: 15, date: "2026-10-29", title: "금성초 입학설명회", school: "금성초등학교", time: "10:00", type: "info-session", priority: "medium" },
    { id: 17, date: "2026-10-31", title: "심석초 입학설명회", school: "심석초등학교", time: "10:00", type: "info-session", priority: "medium" },
    { id: 20, date: "2026-11-04", title: "상명사대부초 설명회 2차", school: "상명사대부초등학교", time: "09:20", type: "info-session", priority: "medium" },
    { id: 30, date: "2026-11-07", title: "원서접수 시작", school: "전체 사립초", time: "09:00", type: "application", description: "~ 11/12(수) 16:30", priority: "high" },
    { id: 31, date: "2026-11-12", title: "원서접수 마감", school: "전체 사립초", time: "16:30", type: "application", description: "최대 3개교 지원", priority: "high" },
    { id: 32, date: "2026-11-17", title: "입학추첨", school: "전체 사립초", time: "11:00", type: "lottery", description: "서울시교육청, 유튜브 생중계", priority: "high" },
    { id: 33, date: "2026-11-18", title: "등록 시작", school: "전체 사립초", time: "09:00", type: "registration", description: "~ 11/20(목) 16:30", priority: "high" },
    { id: 34, date: "2026-11-20", title: "등록 마감", school: "전체 사립초", time: "16:30", type: "registration", description: "중복 등록 금지!", priority: "high" },
  ];
  var SCHOOLS = [
    { name: "상명초등학교", address: "서울 노원구 덕릉로 541", distanceKm: "10.7" },
    { name: "태강삼육초등학교", address: "서울 노원구 화랑로 815", distanceKm: "7.8" },
    { name: "화랑초등학교", address: "서울 노원구 화랑로 621", distanceKm: "8.1" },
    { name: "금성초등학교", address: "서울 중랑구 신내로21길 55", distanceKm: "7.1" },
    { name: "심석초등학교", address: "경기도 남양주시 화도읍 마석로76번길 10", distanceKm: "18.5" },
    { name: "상명사대부초등학교", address: "", distanceKm: "" },
    { name: "전체 사립초", address: "", distanceKm: "" },
  ];

  var events = [];
  var useNeon = false;
  var selectedId = null;
  var editingId = null;
  var nowInit = new Date();
  var visible = new Date(nowInit.getFullYear(), nowInit.getMonth(), 1);
  var grid = document.getElementById("cal-grid");
  var label = document.getElementById("cal-label");
  var detail = document.getElementById("cal-detail");
  var dialog = document.getElementById("cal-dialog");
  var form = document.getElementById("cal-form");
  var formTitle = document.getElementById("cal-form-title");
  var titleInput = document.getElementById("cal-title");
  var schoolInput = document.getElementById("cal-school");
  var dateInput = document.getElementById("cal-date");
  var timeInput = document.getElementById("cal-time");
  var typeInput = document.getElementById("cal-type");
  var descInput = document.getElementById("cal-desc");
  var priorityButtons = Array.prototype.slice.call(document.querySelectorAll(".sched-priority-btn"));
  var selectedPriority = "medium";

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function toKey(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function parseKey(key) {
    var parts = String(key).slice(0, 10).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function normalizePriority(value) {
    if (value === "high" || value === "높음") return "high";
    if (value === "low" || value === "낮음") return "low";
    return "medium";
  }

  function setPriority(value) {
    selectedPriority = normalizePriority(value);
    priorityButtons.forEach(function (btn) {
      btn.classList.toggle("is-on", btn.getAttribute("data-priority") === selectedPriority);
    });
  }

  function normalize(row) {
    var key = row.date instanceof Date ? toKey(row.date) : String(row.date).slice(0, 10);
    return {
      id: Number(row.id),
      date: key,
      title: row.title || "",
      school: row.school || "",
      time: row.time || "",
      type: row.type || "info-session",
      description: row.description || "",
      priority: normalizePriority(row.priority),
    };
  }

  function schoolOf(name) {
    for (var i = 0; i < SCHOOLS.length; i++) {
      if (SCHOOLS[i].name === name) return SCHOOLS[i];
    }
    return null;
  }

  function openMap(school) {
    if (!school) return;
    var q = encodeURIComponent((school.name + " " + (school.address || "")).trim());
    window.open("https://map.naver.com/p/search/" + q, "_blank", "noopener,noreferrer");
  }

  function fillSchoolSelect() {
    schoolInput.innerHTML = "";
    var blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "학교를 선택하세요";
    schoolInput.appendChild(blank);
    SCHOOLS.forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s.name;
      opt.textContent = s.name;
      schoolInput.appendChild(opt);
    });
  }

  function eventsForDay(key) {
    return events.filter(function (ev) {
      return ev.date === key;
    }).sort(function (a, b) {
      var rank = { high: 0, medium: 1, low: 2 };
      return (rank[a.priority] || 1) - (rank[b.priority] || 1);
    });
  }

  function renderDetail() {
    var ev = null;
    for (var i = 0; i < events.length; i++) {
      if (events[i].id === selectedId) {
        ev = events[i];
        break;
      }
    }
    if (!ev) {
      detail.innerHTML = '<div class="adm-detail-empty">달력에서 일정을 선택하면 상세 내용이 여기에 표시됩니다.</div>';
      return;
    }
    var d = parseKey(ev.date);
    var school = schoolOf(ev.school);
    var typeClass = TYPE_CLASS[ev.type] || "is-info";
    var html = "";
    html += '<div class="adm-detail-card">';
    html += '<div class="adm-detail-top">';
    html += '<span class="adm-type ' + typeClass + '">' + (TYPE_LABEL[ev.type] || "일정") + "</span>";
    html += '<span class="adm-prio-badge ' + (PRIORITY_CLASS[ev.priority] || "prio-medium") + '">' + (PRIORITY_LABEL[ev.priority] || "보통") + "</span>";
    html += '<button type="button" class="adm-detail-close" id="cal-detail-close" aria-label="닫기">×</button>';
    html += "</div>";
    html += '<h3 class="adm-detail-title">' + escapeHtml(ev.title) + "</h3>";
    html += '<p class="adm-detail-school">' + escapeHtml(ev.school || "학교 미지정");
    if (school && school.address) {
      html +=
        ' · <button type="button" class="adm-map-link" id="cal-map-link">' +
        escapeHtml(school.address) +
        "</button>";
      if (school.distanceKm) html += " · " + escapeHtml(school.distanceKm) + "km";
    }
    html += "</p>";
    html +=
      '<p class="adm-detail-meta">' +
      (d.getMonth() + 1) +
      "월 " +
      d.getDate() +
      "일 (" +
      WEEKDAYS[d.getDay()] +
      ")" +
      (ev.time ? " · " + escapeHtml(ev.time) : "") +
      "</p>";
    if (ev.description) {
      html += '<p class="adm-detail-desc">' + escapeHtml(ev.description) + "</p>";
    }
    html += '<div class="adm-detail-actions">';
    html += '<button type="button" class="ks-btn" id="cal-edit">수정</button>';
    html += '<button type="button" class="ks-btn ks-btn-danger" id="cal-delete">삭제</button>';
    html += "</div></div>";
    detail.innerHTML = html;
    document.getElementById("cal-detail-close").onclick = function () {
      selectedId = null;
      renderDetail();
      renderGrid();
    };
    var mapBtn = document.getElementById("cal-map-link");
    if (mapBtn) mapBtn.onclick = function () { openMap(school); };
    document.getElementById("cal-edit").onclick = function () { openEdit(ev); };
    document.getElementById("cal-delete").onclick = function () { removeEvent(ev); };
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderGrid() {
    var y = visible.getFullYear();
    var m = visible.getMonth();
    label.textContent = y + "년 " + (m + 1) + "월";
    var first = new Date(y, m, 1);
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var start = first.getDay();
    var today = toKey(new Date());
    grid.innerHTML = "";
    for (var i = 0; i < start; i++) {
      var blank = document.createElement("div");
      blank.className = "adm-day is-blank";
      grid.appendChild(blank);
    }
    for (var day = 1; day <= daysInMonth; day++) {
      var key = y + "-" + pad(m + 1) + "-" + pad(day);
      var cell = document.createElement("div");
      cell.className = "adm-day";
      if (key === today) cell.classList.add("is-today");
      var dow = new Date(y, m, day).getDay();
      if (dow === 0) cell.classList.add("is-sun");
      if (dow === 6) cell.classList.add("is-sat");
      var num = document.createElement("div");
      num.className = "adm-num";
      num.textContent = String(day);
      cell.appendChild(num);
      var list = document.createElement("div");
      list.className = "adm-events";
      eventsForDay(key).forEach(function (ev) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "adm-event " + (TYPE_CLASS[ev.type] || "is-info") + " " + (PRIORITY_CLASS[ev.priority] || "prio-medium");
        if (ev.id === selectedId) btn.classList.add("is-selected");
        btn.innerHTML =
          '<span class="adm-event-school">' +
          escapeHtml(ev.school || "") +
          '</span><span class="adm-event-title">' +
          escapeHtml(ev.title) +
          "</span>";
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          selectedId = ev.id;
          renderDetail();
          renderGrid();
        });
        list.appendChild(btn);
      });
      cell.appendChild(list);
      grid.appendChild(cell);
    }
  }

  function openAdd() {
    editingId = null;
    formTitle.textContent = "일정 추가";
    titleInput.value = "";
    schoolInput.value = "";
    dateInput.value = toKey(new Date(visible.getFullYear(), visible.getMonth(), Math.min(new Date().getDate(), 28)));
    timeInput.value = "";
    typeInput.value = "info-session";
    descInput.value = "";
    setPriority("medium");
    dialog.showModal();
  }

  function openEdit(ev) {
    editingId = ev.id;
    formTitle.textContent = "일정 수정";
    titleInput.value = ev.title;
    if (![].some.call(schoolInput.options, function (o) { return o.value === ev.school; }) && ev.school) {
      var opt = document.createElement("option");
      opt.value = ev.school;
      opt.textContent = ev.school;
      schoolInput.appendChild(opt);
    }
    schoolInput.value = ev.school || "";
    dateInput.value = ev.date;
    timeInput.value = ev.time || "";
    typeInput.value = ev.type || "info-session";
    descInput.value = ev.description || "";
    setPriority(ev.priority || "medium");
    dialog.showModal();
  }

  function applyLocal() {
    var deleted = [];
    try { deleted = JSON.parse(localStorage.getItem("deletedEventIds") || "[]"); } catch (e) {}
    var custom = [];
    try {
      custom = JSON.parse(localStorage.getItem("customEvents") || "[]").map(normalize);
    } catch (e) {}
    var overrides = {};
    try { overrides = JSON.parse(localStorage.getItem("eventOverrides") || "{}"); } catch (e) {}
    var hidden = {};
    deleted.forEach(function (id) { hidden[id] = true; });
    useNeon = false;
    events = DEFAULT_EVENTS.map(normalize).filter(function (ev) { return !hidden[ev.id]; }).map(function (ev) {
      return overrides[ev.id] ? normalize(Object.assign({}, ev, overrides[ev.id], { id: ev.id })) : ev;
    }).concat(custom);
    renderGrid();
    renderDetail();
  }

  function syncTodos() {
    var payload = events.map(function (ev) {
      return {
        id: ev.id,
        date: ev.date,
        title: ev.title,
        school: ev.school || "",
        time: ev.time || "",
        description: ev.description || "",
        priority: ev.priority || "medium",
      };
    });
    fetch(API + "/sync", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ events: payload }),
    }).catch(function () {});
  }

  async function loadEvents() {
    try {
      var res = await fetch(API + "/events", { headers: headers });
      if (!res.ok) return applyLocal();
      var deleted = [];
      try { deleted = JSON.parse(localStorage.getItem("deletedEventIds") || "[]"); } catch (e) {}
      var custom = [];
      try { custom = JSON.parse(localStorage.getItem("customEvents") || "[]"); } catch (e) {}
      if ((deleted.length || custom.length) && localStorage.getItem("neonMigrated") !== "1") {
        var moved = await fetch(API + "/events/migrate", {
          method: "POST",
          headers: headers,
          body: JSON.stringify({ deletedIds: deleted, custom: custom }),
        });
        if (moved.ok) {
          localStorage.setItem("neonMigrated", "1");
          localStorage.removeItem("customEvents");
          localStorage.removeItem("deletedEventIds");
          res = await fetch(API + "/events", { headers: headers });
          if (!res.ok) return applyLocal();
        }
      }
      var data = await res.json();
      useNeon = true;
      events = (data.events || []).map(normalize);
      renderGrid();
      renderDetail();
      syncTodos();
    } catch (e) {
      applyLocal();
    }
  }

  async function saveEvent(payload) {
    if (!useNeon) {
      if (editingId) {
        events = events.map(function (ev) {
          return ev.id === editingId ? Object.assign({}, ev, payload, { id: editingId }) : ev;
        });
      } else {
        var id = Date.now();
        events = events.concat([Object.assign({}, payload, { id: id })]);
        editingId = id;
      }
      var custom = events.filter(function (ev) { return ev.id >= 1000; });
      var overrides = {};
      events.forEach(function (ev) {
        if (ev.id < 1000) overrides[ev.id] = ev;
      });
      localStorage.setItem("customEvents", JSON.stringify(custom));
      localStorage.setItem("eventOverrides", JSON.stringify(overrides));
      selectedId = editingId;
      dialog.close();
      renderGrid();
      renderDetail();
      return;
    }
    var url = editingId ? API + "/events/" + editingId : API + "/events";
    var method = editingId ? "PUT" : "POST";
    var body = Object.assign({}, payload);
    if (editingId) body.id = editingId;
    var res = await fetch(url, { method: method, headers: headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error("save");
    var data = await res.json().catch(function () { return {}; });
    var savedId = editingId;
    if (data && data.event && data.event.id) savedId = Number(data.event.id);
    else if (data && data.id) savedId = Number(data.id);
    await loadEvents();
    selectedId = savedId || editingId;
    dialog.close();
    renderDetail();
  }

  async function removeEvent(ev) {
    if (!confirm("이 일정을 삭제할까요?")) return;
    if (!useNeon) {
      if (ev.id >= 1000) {
        events = events.filter(function (item) { return item.id !== ev.id; });
        localStorage.setItem("customEvents", JSON.stringify(events.filter(function (item) { return item.id >= 1000; })));
      } else {
        var deleted = [];
        try { deleted = JSON.parse(localStorage.getItem("deletedEventIds") || "[]"); } catch (e) {}
        if (deleted.indexOf(ev.id) < 0) deleted.push(ev.id);
        localStorage.setItem("deletedEventIds", JSON.stringify(deleted));
        events = events.filter(function (item) { return item.id !== ev.id; });
      }
      selectedId = null;
      renderGrid();
      renderDetail();
      return;
    }
    var res = await fetch(API + "/events/" + ev.id, { method: "DELETE", headers: headers });
    if (!res.ok) {
      alert("일정을 삭제하지 못했습니다.");
      return;
    }
    selectedId = null;
    await loadEvents();
  }

  document.getElementById("cal-prev").onclick = function () {
    visible = new Date(visible.getFullYear(), visible.getMonth() - 1, 1);
    renderGrid();
  };
  document.getElementById("cal-next").onclick = function () {
    visible = new Date(visible.getFullYear(), visible.getMonth() + 1, 1);
    renderGrid();
  };
  document.getElementById("cal-today").onclick = function () {
    var now = new Date();
    visible = new Date(now.getFullYear(), now.getMonth(), 1);
    renderGrid();
  };
  document.getElementById("cal-add").onclick = openAdd;
  document.getElementById("cal-form-close").onclick = function () { dialog.close(); };
  priorityButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      setPriority(btn.getAttribute("data-priority"));
    });
  });
  setPriority("medium");
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    saveEvent({
      title: titleInput.value.trim(),
      school: schoolInput.value,
      date: dateInput.value,
      time: timeInput.value,
      type: typeInput.value,
      description: descInput.value.trim(),
      priority: selectedPriority,
    }).catch(function () {
      alert("일정을 저장하지 못했습니다.");
    });
  });

  fillSchoolSelect();
  renderGrid();
  renderDetail();
  loadEvents();
})();
