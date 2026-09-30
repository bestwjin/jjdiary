(function () {
  var API = "https://nae-diary-notify.jjinytm.workers.dev";
  var headers = {
    "Content-Type": "application/json",
    "X-Diary-Sync": "575dc6f9f6eafc1d4246ca0c4991655e",
  };
  var form = document.getElementById("settings-form");
  var keyInput = document.getElementById("settings-kasi-key");
  var toggle = document.getElementById("settings-toggle");
  var saveButton = document.getElementById("settings-save");
  var error = document.getElementById("settings-error");
  var ok = document.getElementById("settings-ok");

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

  async function load() {
    showError("");
    showOk("");
    var response = await fetch(API + "/settings", { headers: headers });
    if (!response.ok) throw new Error("load");
    var data = await response.json();
    keyInput.value = data.settings && data.settings.kasiServiceKey ? data.settings.kasiServiceKey : "";
  }

  toggle.addEventListener("click", function () {
    var show = keyInput.type === "password";
    keyInput.type = show ? "text" : "password";
    toggle.textContent = show ? "숨김" : "표시";
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    saveButton.disabled = true;
    showError("");
    showOk("");
    try {
      var response = await fetch(API + "/settings", {
        method: "PUT",
        headers: headers,
        body: JSON.stringify({ kasiServiceKey: keyInput.value.trim() }),
      });
      if (!response.ok) throw new Error("save");
      var data = await response.json();
      keyInput.value = data.settings && data.settings.kasiServiceKey ? data.settings.kasiServiceKey : "";
      showOk(keyInput.value ? "인증키를 저장했습니다." : "인증키를 비웠습니다.");
    } catch (err) {
      showError("설정을 저장하지 못했습니다.");
    } finally {
      saveButton.disabled = false;
    }
  });

  load().catch(function () {
    showError("설정을 불러오지 못했습니다.");
  });
})();
