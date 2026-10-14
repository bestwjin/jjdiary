(function () {
  var API = "https://nae-diary-notify.jjinytm.workers.dev";
  var headers = {
    "Content-Type": "application/json",
    "X-Diary-Sync": "575dc6f9f6eafc1d4246ca0c4991655e",
  };
  var holidayForm = document.getElementById("settings-holiday-form");
  var telegramForm = document.getElementById("settings-telegram-form");
  var mailForm = document.getElementById("settings-mail-form");
  var kasiInput = document.getElementById("settings-kasi-key");
  var kasiToggle = document.getElementById("settings-kasi-toggle");
  var telegramToken = document.getElementById("settings-telegram-token");
  var telegramUsername = document.getElementById("settings-telegram-username");
  var telegramNotifyTime = document.getElementById("settings-telegram-notify-time");
  var telegramToggle = document.getElementById("settings-telegram-toggle");
  var mailToggle = document.getElementById("settings-mail-toggle");
  var telegramSendForm = document.getElementById("settings-telegram-send-form");
  var telegramMessage = document.getElementById("settings-telegram-message");
  var telegramScheduled = document.getElementById("settings-telegram-scheduled");
  var telegramScheduleAt = document.getElementById("settings-telegram-schedule-at");
  var telegramScheduleWrap = document.getElementById("settings-telegram-schedule-wrap");
  var telegramOutbox = document.getElementById("settings-telegram-outbox");
  var telegramOutboxEmpty = document.getElementById("settings-telegram-outbox-empty");
  var telegramOutboxRefresh = document.getElementById("settings-telegram-outbox-refresh");
  var error = document.getElementById("settings-error");
  var ok = document.getElementById("settings-ok");
  var nav = document.getElementById("settings-nav");
  var panels = Array.prototype.slice.call(document.querySelectorAll(".settings-panel[data-panel]"));
  var providers = ["daum", "works", "naver", "gmail"];
  var STATUS_LABEL = {
    pending: "예약",
    sending: "발송중",
    sent: "완료",
    failed: "실패",
    cancelled: "취소",
  };

  function showError(message) {
    error.hidden = !message;
    error.textContent = message || "";
    if (message) ok.hidden = true;
  }

  function showOk(message) {
    ok.hidden = !message;
    ok.textContent = message || "";
    if (message) error.hidden = true;
  }

  function providerRoot(id) {
    return mailForm.querySelector('.mail-provider[data-provider="' + id + '"]');
  }

  function field(root, name) {
    return root.querySelector('[data-field="' + name + '"]');
  }

  function applyMailAccounts(accounts) {
    providers.forEach(function (id) {
      var root = providerRoot(id);
      var data = accounts && accounts[id] ? accounts[id] : {};
      field(root, "enabled").checked = Boolean(data.enabled);
      field(root, "address").value = data.address || "";
      field(root, "displayName").value = data.displayName || "";
      field(root, "imapUser").value = data.imapUser || "";
      field(root, "imapPassword").value = data.imapPassword || "";
      field(root, "smtpUser").value = data.smtpUser || "";
      field(root, "smtpPassword").value = data.smtpPassword || "";
    });
  }

  function readMailAccounts() {
    var out = {};
    providers.forEach(function (id) {
      var root = providerRoot(id);
      out[id] = {
        id: id,
        enabled: field(root, "enabled").checked,
        address: field(root, "address").value.trim(),
        displayName: field(root, "displayName").value.trim(),
        imapUser: field(root, "imapUser").value.trim(),
        imapPassword: field(root, "imapPassword").value,
        smtpUser: field(root, "smtpUser").value.trim(),
        smtpPassword: field(root, "smtpPassword").value,
      };
    });
    return out;
  }

  function applySettings(settings) {
    kasiInput.value = settings && settings.kasiServiceKey ? settings.kasiServiceKey : "";
    telegramToken.value = settings && settings.telegramToken ? settings.telegramToken : "";
    telegramUsername.value = settings && settings.telegramUsername ? settings.telegramUsername : "";
    telegramNotifyTime.value = settings && settings.telegramNotifyTime ? settings.telegramNotifyTime : "10:00";
    applyMailAccounts(settings && settings.mailAccounts ? settings.mailAccounts : {});
  }

  async function load() {
    showError("");
    showOk("");
    var response = await fetch(API + "/settings", { headers: headers });
    if (!response.ok) throw new Error("load");
    var data = await response.json();
    applySettings(data.settings);
  }

  async function save(payload, successMessage) {
    showError("");
    showOk("");
    var response = await fetch(API + "/settings", {
      method: "PUT",
      headers: headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("save");
    var data = await response.json();
    applySettings(data.settings);
    showOk(successMessage);
  }

  function bindToggle(button, inputs) {
    button.addEventListener("click", function () {
      var list = Array.isArray(inputs) ? inputs : [inputs];
      var show = list.some(function (input) { return input.type === "password"; });
      list.forEach(function (input) {
        input.type = show ? "text" : "password";
      });
      button.textContent = show ? "숨김" : "표시";
    });
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function toLocalInputValue(date) {
    return (
      date.getFullYear() +
      "-" + pad(date.getMonth() + 1) +
      "-" + pad(date.getDate()) +
      "T" + pad(date.getHours()) +
      ":" + pad(date.getMinutes()) +
      ":" + pad(date.getSeconds())
    );
  }

  function fromLocalInputValue(value) {
    if (!value) return "";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
  }

  function formatWhen(value) {
    if (!value) return "-";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return (
      date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
      " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds())
    );
  }

  function syncScheduleFields() {
    var on = telegramScheduled.checked;
    telegramScheduleWrap.hidden = !on;
    telegramScheduleAt.required = on;
    if (on && !telegramScheduleAt.value) {
      var next = new Date(Date.now() + 60 * 1000);
      telegramScheduleAt.value = toLocalInputValue(next);
    }
  }

  async function loadOutbox() {
    var response = await fetch(API + "/telegram/outbox", { headers: headers });
    if (!response.ok) throw new Error("outbox");
    var data = await response.json();
    var items = Array.isArray(data.items) ? data.items : [];
    telegramOutbox.innerHTML = "";
    telegramOutboxEmpty.hidden = items.length > 0;
    items.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "telegram-outbox-item";
      var meta = document.createElement("div");
      meta.className = "telegram-outbox-meta";
      var badge = document.createElement("span");
      badge.className = "telegram-outbox-status is-" + (item.status || "pending");
      badge.textContent = STATUS_LABEL[item.status] || item.status || "예약";
      var when = document.createElement("span");
      when.textContent = item.status === "sent" && item.sentAt
        ? "발송 " + formatWhen(item.sentAt)
        : "예약 " + formatWhen(item.scheduledAt);
      var created = document.createElement("span");
      created.textContent = "등록 " + formatWhen(item.createdAt);
      meta.appendChild(badge);
      meta.appendChild(when);
      meta.appendChild(created);
      var body = document.createElement("p");
      body.className = "telegram-outbox-body";
      body.textContent = item.body || "";
      li.appendChild(meta);
      li.appendChild(body);
      if (item.error) {
        var err = document.createElement("p");
        err.className = "telegram-outbox-error";
        err.textContent = item.error;
        li.appendChild(err);
      }
      if (item.status === "pending" || item.status === "failed") {
        var cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "ks-btn";
        cancel.textContent = "취소";
        cancel.addEventListener("click", async function () {
          cancel.disabled = true;
          try {
            var res = await fetch(API + "/telegram/outbox/" + item.id, {
              method: "DELETE",
              headers: headers,
            });
            if (!res.ok) throw new Error("cancel");
            showOk("예약을 취소했습니다.");
            await loadOutbox();
          } catch (e) {
            showError("예약을 취소하지 못했습니다.");
            cancel.disabled = false;
          }
        });
        li.appendChild(cancel);
      }
      telegramOutbox.appendChild(li);
    });
  }

  function showPanel(id) {
    panels.forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-panel") !== id;
    });
    Array.prototype.forEach.call(nav.querySelectorAll(".settings-nav-item"), function (button) {
      var on = button.getAttribute("data-panel") === id;
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-selected", on ? "true" : "false");
    });
    try {
      localStorage.setItem("settingsPanel", id);
    } catch (e) {}
    if (id === "telegram-send") {
      syncScheduleFields();
    }
    if (id === "telegram-history") {
      loadOutbox().catch(function () {
        showError("발송 내역을 불러오지 못했습니다.");
      });
    }
  }

  bindToggle(kasiToggle, kasiInput);
  bindToggle(telegramToggle, telegramToken);
  bindToggle(mailToggle, Array.prototype.slice.call(mailForm.querySelectorAll('input[data-field$="Password"]')));

  nav.addEventListener("click", function (event) {
    var button = event.target.closest(".settings-nav-item");
    if (!button || !nav.contains(button)) return;
    showPanel(button.getAttribute("data-panel"));
  });

  holidayForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var button = holidayForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await save(
        { kasiServiceKey: kasiInput.value.trim() },
        kasiInput.value.trim() ? "공휴일 인증키를 저장했습니다." : "공휴일 인증키를 비웠습니다."
      );
    } catch (err) {
      showError("설정을 저장하지 못했습니다.");
    } finally {
      button.disabled = false;
    }
  });

  telegramForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var button = telegramForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      var token = telegramToken.value.trim();
      var username = telegramUsername.value.trim().replace(/^@/, "");
      var notifyTime = telegramNotifyTime.value || "10:00";
      await save(
        { telegramToken: token, telegramUsername: username, telegramNotifyTime: notifyTime },
        "텔레그램 연동 정보를 저장했습니다."
      );
    } catch (err) {
      showError("설정을 저장하지 못했습니다.");
    } finally {
      button.disabled = false;
    }
  });

  mailForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var button = mailForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await save({ mailAccounts: readMailAccounts() }, "메일 연동 정보를 저장했습니다.");
    } catch (err) {
      showError("설정을 저장하지 못했습니다.");
    } finally {
      button.disabled = false;
    }
  });

  telegramScheduled.addEventListener("change", syncScheduleFields);
  telegramOutboxRefresh.addEventListener("click", function () {
    loadOutbox().then(function () {
      showOk("발송 내역을 새로고침했습니다.");
    }).catch(function () {
      showError("발송 내역을 불러오지 못했습니다.");
    });
  });

  telegramSendForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var button = telegramSendForm.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      var payload = {
        message: telegramMessage.value.trim(),
        scheduled: telegramScheduled.checked,
      };
      if (payload.scheduled) {
        payload.scheduledAt = fromLocalInputValue(telegramScheduleAt.value);
        if (!payload.scheduledAt) {
          showError("예약 시각을 확인해 주세요.");
          return;
        }
      }
      showError("");
      showOk("");
      var response = await fetch(API + "/telegram/send", {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload),
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || !data.ok) {
        var reason = data.reason || "";
        if (reason === "missing_credentials") showError("텔레그램 연동 정보를 먼저 저장해 주세요.");
        else if (reason === "empty_message") showError("메시지를 입력해 주세요.");
        else showError("메시지 발송에 실패했습니다.");
        return;
      }
      telegramMessage.value = "";
      showOk(data.sent ? "텔레그램 메시지를 발송했습니다." : "텔레그램 예약 발송을 등록했습니다.");
      syncScheduleFields();
    } catch (err) {
      showError("메시지 발송에 실패했습니다.");
    } finally {
      button.disabled = false;
    }
  });

  telegramNotifyTime.value = "10:00";
  syncScheduleFields();

  var initialPanel = "holiday";
  try {
    var saved = localStorage.getItem("settingsPanel");
    if (saved && panels.some(function (panel) { return panel.getAttribute("data-panel") === saved; })) {
      initialPanel = saved;
    }
  } catch (e) {}
  showPanel(initialPanel);

  load().catch(function () {
    showError("설정을 불러오지 못했습니다.");
  });
})();
