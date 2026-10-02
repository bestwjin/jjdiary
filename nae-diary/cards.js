(function () {
  var API = "https://nae-diary-notify.jjinytm.workers.dev";
  var headers = {
    "Content-Type": "application/json",
    "X-Diary-Sync": "575dc6f9f6eafc1d4246ca0c4991655e",
  };
  var items = [];
  var editingId = null;
  var monthMode = true;
  var now = new Date();
  var visible = new Date(now.getFullYear(), now.getMonth(), 1);

  var body = document.getElementById("card-body");
  var empty = document.getElementById("card-empty");
  var label = document.getElementById("card-label");
  var error = document.getElementById("card-error");
  var limitTotalEl = document.getElementById("card-limit-total");
  var limitUsedEl = document.getElementById("card-limit-used");
  var limitAvailEl = document.getElementById("card-limit-avail");
  var sideNote = document.getElementById("card-side-note");
  var cardLimit = 300000;
  var dialog = document.getElementById("card-dialog");
  var form = document.getElementById("card-form");
  var formTitle = document.getElementById("card-form-title");
  var dateInput = document.getElementById("card-date");
  var merchantInput = document.getElementById("card-merchant");
  var amountInput = document.getElementById("card-amount");
  var purposeInput = document.getElementById("card-purpose");
  var categoryInput = document.getElementById("card-category");
  var settledInput = document.getElementById("card-settled");
  var noteInput = document.getElementById("card-note");
  var deleteBtn = document.getElementById("card-delete");
  var categoryFilter = document.getElementById("card-filter-category");
  var settledFilter = document.getElementById("card-filter-settled");
  var importDialog = document.getElementById("card-import-dialog");
  var importForm = document.getElementById("card-import-form");
  var importText = document.getElementById("card-import-text");
  var importReplace = document.getElementById("card-import-replace");

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function showError(message) {
    error.hidden = !message;
    error.textContent = message || "";
  }

  function money(n) {
    return Number(n || 0).toLocaleString("ko-KR");
  }

  function monthKey(date) {
    return date.getFullYear() + "-" + pad(date.getMonth() + 1);
  }

  function parseCsv(text) {
    var rows = [];
    var row = [];
    var cell = "";
    var inQuotes = false;
    var src = String(text || "").replace(/^\uFEFF/, "");
    for (var i = 0; i < src.length; i++) {
      var ch = src[i];
      var next = src[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') {
          cell += '"';
          i++;
        } else if (ch === '"') inQuotes = false;
        else cell += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === "," || ch === "\t") {
        row.push(cell.trim());
        cell = "";
      } else if (ch === "\n") {
        row.push(cell.trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        cell = "";
      } else if (ch !== "\r") cell += ch;
    }
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    return rows;
  }

  function normalizeHeader(value) {
    return String(value || "").replace(/\s+/g, "").toLowerCase();
  }

  function mapHeader(headers) {
    var map = {};
    headers.forEach(function (h, idx) {
      var key = normalizeHeader(h);
      if (/사용일|일자|날짜|date|used/.test(key)) map.usedDate = idx;
      else if (/사용처|가맹|상점|merchant|store/.test(key)) map.merchant = idx;
      else if (/금액|amount|합계|결제/.test(key)) map.amount = idx;
      else if (/사용내역|내용|적요|목적|purpose|title/.test(key)) map.purpose = idx;
      else if (/구분|유형|카테고리|계정|category/.test(key)) map.category = idx;
      else if (/정산|settled/.test(key)) map.settled = idx;
      else if (/비고|메모|note|memo/.test(key)) map.note = idx;
    });
    return map;
  }

  function toIsoDate(value) {
    var raw = String(value || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    var m = raw.match(/^(\d{4})[.\/](\d{1,2})[.\/](\d{1,2})$/);
    if (m) return m[1] + "-" + pad(m[2]) + "-" + pad(m[3]);
    var m2 = raw.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일$/);
    if (m2) return m2[1] + "-" + pad(m2[2]) + "-" + pad(m2[3]);
    return "";
  }

  function rowsToItems(rows) {
    if (!rows.length) return [];
    var map = mapHeader(rows[0]);
    if (map.usedDate == null || map.merchant == null || map.amount == null) {
      throw new Error("헤더에 사용일/사용처/금액 컬럼이 필요합니다.");
    }
    var out = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var usedDate = toIsoDate(r[map.usedDate]);
      var merchant = r[map.merchant] || "";
      var amount = r[map.amount] || "";
      if (!usedDate || !merchant) continue;
      out.push({
        usedDate: usedDate,
        merchant: merchant,
        amount: amount,
        purpose: map.purpose != null ? r[map.purpose] || "" : "",
        category: map.category != null ? r[map.category] || "" : "",
        note: map.note != null ? r[map.note] || "" : "",
        settled: map.settled != null ? r[map.settled] || "" : "",
      });
    }
    return out;
  }

  function filtered() {
    return items.filter(function (item) {
      if (monthMode) {
        var key = String(item.usedDate || "").slice(0, 7);
        if (key !== monthKey(visible)) return false;
      }
      if (categoryFilter.value && item.category !== categoryFilter.value) return false;
      if (settledFilter.value === "Y" && !item.settled) return false;
      if (settledFilter.value === "N" && item.settled) return false;
      return true;
    });
  }

  function fillCategoryFilter() {
    var current = categoryFilter.value;
    var set = {};
    items.forEach(function (item) {
      if (item.category) set[item.category] = true;
    });
    var cats = Object.keys(set).sort(function (a, b) {
      return a.localeCompare(b, "ko");
    });
    categoryFilter.innerHTML = '<option value="">전체 구분</option>';
    cats.forEach(function (cat) {
      var opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      categoryFilter.appendChild(opt);
    });
    categoryFilter.value = set[current] ? current : "";
  }

  function render() {
    label.textContent = monthMode
      ? visible.getFullYear() + "년 " + (visible.getMonth() + 1) + "월"
      : "전체 기간";
    var list = filtered();
    var total = list.reduce(function (sum, item) {
      return sum + (Number(item.amount) || 0);
    }, 0);
    var avail = cardLimit - total;
    limitTotalEl.textContent = money(cardLimit);
    limitUsedEl.textContent = money(total);
    limitAvailEl.textContent = money(avail);
    limitAvailEl.classList.toggle("is-avail", avail >= 0);
    limitAvailEl.classList.toggle("is-over", avail < 0);
    sideNote.textContent = monthMode
      ? "현재 조회 월 기준 사용·가용 금액입니다."
      : "전체 기간 기준 사용·가용 금액입니다.";
    body.innerHTML = "";
    empty.hidden = list.length > 0;
    list.forEach(function (item) {
      var tr = document.createElement("tr");
      tr.className = item.settled ? "is-settled" : "";
      tr.innerHTML =
        "<td>" +
        escapeHtml(item.usedDate) +
        "</td><td>" +
        escapeHtml(item.merchant) +
        '</td><td class="is-num">' +
        money(item.amount) +
        "</td><td>" +
        escapeHtml(item.purpose) +
        "</td><td>" +
        escapeHtml(item.category) +
        '</td><td><span class="card-settle ' +
        (item.settled ? "is-on" : "") +
        '">' +
        (item.settled ? "완료" : "미정산") +
        "</span></td><td>" +
        escapeHtml(item.note) +
        "</td>";
      tr.addEventListener("click", function () {
        openEdit(item);
      });
      body.appendChild(tr);
    });
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function openAdd() {
    editingId = null;
    formTitle.textContent = "사용내역 추가";
    dateInput.value = new Date().toISOString().slice(0, 10);
    merchantInput.value = "";
    amountInput.value = "";
    purposeInput.value = "";
    categoryInput.value = "";
    settledInput.checked = false;
    noteInput.value = "";
    deleteBtn.hidden = true;
    resetScanUi();
    dialog.showModal();
  }

  function openEdit(item) {
    editingId = item.id;
    formTitle.textContent = "사용내역 수정";
    dateInput.value = item.usedDate;
    merchantInput.value = item.merchant;
    amountInput.value = item.amount;
    purposeInput.value = item.purpose || "";
    categoryInput.value = item.category || "";
    settledInput.checked = !!item.settled;
    noteInput.value = item.note || "";
    deleteBtn.hidden = false;
    resetScanUi();
    dialog.showModal();
  }

  var scanBtn = document.getElementById("card-scan-btn");
  var scanFile = document.getElementById("card-scan-file");
  var scanStatus = document.getElementById("card-scan-status");
  var scanPreview = document.getElementById("card-scan-preview");
  var tesseractPromise = null;

  function resetScanUi() {
    scanStatus.hidden = true;
    scanStatus.textContent = "";
    scanPreview.hidden = true;
    scanPreview.removeAttribute("src");
    scanFile.value = "";
    scanBtn.disabled = false;
  }

  function setScanStatus(message, done) {
    scanStatus.hidden = !message;
    scanStatus.textContent = message || "";
    scanStatus.classList.toggle("is-done", !!done);
  }

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (tesseractPromise) return tesseractPromise;
    tesseractPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
      script.async = true;
      script.onload = function () {
        if (window.Tesseract) resolve(window.Tesseract);
        else reject(new Error("tesseract"));
      };
      script.onerror = function () {
        reject(new Error("tesseract_load"));
      };
      document.head.appendChild(script);
    });
    return tesseractPromise;
  }

  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var max = 1600;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          function (blob) {
            if (!blob) reject(new Error("blob"));
            else resolve({ blob: blob, preview: canvas.toDataURL("image/jpeg", 0.85) });
          },
          "image/jpeg",
          0.85
        );
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("image"));
      };
      img.src = url;
    });
  }

  function parseAmountCandidate(raw) {
    var n = Number(String(raw || "").replace(/[^0-9]/g, ""));
    if (!Number.isFinite(n) || n < 100 || n > 100000000) return null;
    return n;
  }

  function parseReceiptText(text) {
    var src = String(text || "").replace(/\r/g, "\n");
    var lines = src
      .split("\n")
      .map(function (line) {
        return line.replace(/\s+/g, " ").trim();
      })
      .filter(Boolean);

    var usedDate = "";
    var datePatterns = [
      /(20\d{2})[.\-\/년\s]+(\d{1,2})[.\-\/월\s]+(\d{1,2})/,
      /(\d{2})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/,
    ];
    for (var di = 0; di < lines.length && !usedDate; di++) {
      for (var dpi = 0; dpi < datePatterns.length; dpi++) {
        var dm = lines[di].match(datePatterns[dpi]);
        if (!dm) continue;
        var y = dm[1].length === 2 ? "20" + dm[1] : dm[1];
        usedDate = y + "-" + pad(dm[2]) + "-" + pad(dm[3]);
        break;
      }
    }

    var amount = null;
    var amountLabel = /합\s*계|총\s*액|결제\s*금액|받을\s*금액|승인\s*금액|청구\s*금액|판매\s*금액|금액/;
    for (var ai = 0; ai < lines.length; ai++) {
      var line = lines[ai];
      if (!amountLabel.test(line)) continue;
      var am = line.match(/(\d{1,3}(?:,\d{3})+|\d{3,})\s*원?/);
      if (am) {
        amount = parseAmountCandidate(am[1]);
        if (amount) break;
      }
      if (ai + 1 < lines.length) {
        var nextAmt = lines[ai + 1].match(/(\d{1,3}(?:,\d{3})+|\d{3,})\s*원?/);
        if (nextAmt) {
          amount = parseAmountCandidate(nextAmt[1]);
          if (amount) break;
        }
      }
    }
    if (!amount) {
      var allAmounts = [];
      lines.forEach(function (line) {
        var matches = line.match(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*원/g) || [];
        matches.forEach(function (chunk) {
          var value = parseAmountCandidate(chunk);
          if (value) allAmounts.push(value);
        });
      });
      if (allAmounts.length) amount = Math.max.apply(null, allAmounts);
    }

    var skipMerchant = /영수증|현금|카드|승인|합계|총액|금액|부가세|과세|면세|사업자|전화|TEL|대표|주소|감사합니다|매출|부가가치|VAT|POS|NO\.|번호|일시|날짜|일자|시간/i;
    var merchant = "";
    for (var mi = 0; mi < Math.min(lines.length, 12); mi++) {
      var candidate = lines[mi].replace(/[^\w가-힣&\-().\s]/g, "").trim();
      if (candidate.length < 2 || candidate.length > 40) continue;
      if (skipMerchant.test(candidate)) continue;
      if (/^\d+$/.test(candidate)) continue;
      if (/\d{2,4}[.\-\/]\d{1,2}/.test(candidate)) continue;
      merchant = candidate;
      break;
    }

    var purpose = "";
    if (merchant) purpose = merchant + " 결제";
    var category = guessCategory(merchant + " " + src);

    return {
      usedDate: usedDate,
      merchant: merchant,
      amount: amount,
      purpose: purpose,
      category: category,
      raw: lines.slice(0, 30).join("\n"),
    };
  }

  function guessCategory(text) {
    var src = String(text || "");
    if (/스타벅스|커피|카페|베이커리|음식|식당|한식|중식|일식|분식|맥도날드|버거|치킨|피자|편의점|GS25|CU|세븐일레븐|이마트|마트/.test(src)) return "식대";
    if (/택시|카카오T|UBER|버스|지하철|기차|KTX|주유|오일|주차/.test(src)) return "교통";
    if (/호텔|리조트|골프|접대|와인|술집|바$/.test(src)) return "접대";
    if (/문구|오피스|쿠팡|네이버쇼핑|11번가|다이소/.test(src)) return "소모품";
    if (/학원|교육|강의|세미나|도서|책/.test(src)) return "교육";
    return "기타";
  }

  function applyScanResult(parsed) {
    if (parsed.usedDate) dateInput.value = parsed.usedDate;
    if (parsed.merchant) merchantInput.value = parsed.merchant;
    if (parsed.amount) amountInput.value = String(parsed.amount);
    if (parsed.purpose && !purposeInput.value) purposeInput.value = parsed.purpose;
    if (parsed.category) categoryInput.value = parsed.category;
    if (parsed.raw) {
      var stamp = "[영수증 OCR]\n" + parsed.raw;
      noteInput.value = noteInput.value ? noteInput.value + "\n" + stamp : stamp;
    }
  }

  function payloadFromForm() {
    return {
      usedDate: dateInput.value,
      merchant: merchantInput.value.trim(),
      amount: amountInput.value,
      purpose: purposeInput.value.trim(),
      category: categoryInput.value.trim(),
      note: noteInput.value.trim(),
      settled: settledInput.checked,
    };
  }

  async function load() {
    showError("");
    var res = await fetch(API + "/cards", { headers: headers });
    if (!res.ok) throw new Error("load");
    var data = await res.json();
    items = data.items || [];
    fillCategoryFilter();
    render();
  }

  async function save() {
    var payload = payloadFromForm();
    var url = editingId ? API + "/cards/" + editingId : API + "/cards";
    var method = editingId ? "PUT" : "POST";
    var res = await fetch(url, { method: method, headers: headers, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error("save");
    dialog.close();
    await load();
  }

  async function remove() {
    if (!editingId || !confirm("이 사용내역을 삭제할까요?")) return;
    var res = await fetch(API + "/cards/" + editingId, { method: "DELETE", headers: headers });
    if (!res.ok) throw new Error("delete");
    dialog.close();
    await load();
  }

  async function scanReceiptFile(file) {
    if (!file) return;
    scanBtn.disabled = true;
    setScanStatus("이미지 준비 중…");
    try {
      var resized = await resizeImage(file);
      scanPreview.src = resized.preview;
      scanPreview.hidden = false;
      setScanStatus("OCR 엔진 로딩… (처음은 조금 걸려요)");
      var Tesseract = await loadTesseract();
      setScanStatus("영수증 인식 중…");
      var result = await Tesseract.recognize(resized.blob, "kor+eng", {
        logger: function (info) {
          if (info.status === "recognizing text" && info.progress != null) {
            setScanStatus("영수증 인식 중… " + Math.round(info.progress * 100) + "%");
          }
        },
      });
      var parsed = parseReceiptText(result && result.data ? result.data.text : "");
      if (!parsed.merchant && !parsed.amount && !parsed.usedDate) {
        setScanStatus("인식된 내용이 부족합니다. 직접 수정해 주세요.", true);
        return;
      }
      applyScanResult(parsed);
      setScanStatus("인식 완료. 내용을 확인한 뒤 저장하세요.", true);
    } catch (err) {
      setScanStatus("스캔에 실패했습니다. 다시 시도해 주세요.");
      console.error(err);
    } finally {
      scanBtn.disabled = false;
    }
  }

  scanBtn.addEventListener("click", function () {
    scanFile.click();
  });
  scanFile.addEventListener("change", function () {
    var file = scanFile.files && scanFile.files[0];
    if (file) scanReceiptFile(file);
  });

  document.getElementById("card-prev").onclick = function () {
    monthMode = true;
    visible = new Date(visible.getFullYear(), visible.getMonth() - 1, 1);
    render();
  };
  document.getElementById("card-next").onclick = function () {
    monthMode = true;
    visible = new Date(visible.getFullYear(), visible.getMonth() + 1, 1);
    render();
  };
  document.getElementById("card-all").onclick = function () {
    monthMode = false;
    render();
  };
  document.getElementById("card-add").onclick = openAdd;
  document.getElementById("card-close").onclick = function () {
    dialog.close();
  };
  deleteBtn.onclick = function () {
    remove().catch(function () {
      showError("삭제하지 못했습니다.");
    });
  };
  categoryFilter.onchange = render;
  settledFilter.onchange = render;
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    save().catch(function () {
      showError("저장하지 못했습니다.");
    });
  });

  document.getElementById("card-import-open").onclick = function () {
    importText.value = "";
    importReplace.checked = false;
    importDialog.showModal();
  };
  document.getElementById("card-import-close").onclick = function () {
    importDialog.close();
  };
  importForm.addEventListener("submit", function (event) {
    event.preventDefault();
    try {
      var parsed = rowsToItems(parseCsv(importText.value));
      if (!parsed.length) throw new Error("가져올 행이 없습니다.");
      fetch(API + "/cards/import", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ items: parsed, replace: importReplace.checked }),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("import");
          return res.json();
        })
        .then(function () {
          importDialog.close();
          return load();
        })
        .catch(function () {
          showError("가져오기에 실패했습니다.");
        });
    } catch (err) {
      showError(err.message || "CSV 형식을 확인해 주세요.");
    }
  });

  load().catch(function () {
    showError("법카 사용내역을 불러오지 못했습니다.");
  });
})();
