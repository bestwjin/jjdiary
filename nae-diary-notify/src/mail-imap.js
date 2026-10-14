import { connect } from "cloudflare:sockets";

function encodeImapString(value) {
  return `"${String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function decodeQuotedPrintable(input) {
  return String(input || "")
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function bytesToString(bytes, charset) {
  const lower = String(charset || "utf-8").toLowerCase();
  try {
    return new TextDecoder(lower === "ks_c_5601-1987" || lower === "euc-kr" ? "euc-kr" : lower).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function decodeBase64(input, charset) {
  const clean = String(input || "").replace(/\s+/g, "");
  try {
    const binary = atob(clean);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return bytesToString(bytes, charset);
  } catch {
    return input;
  }
}

function decodeMimeWord(value) {
  return String(value || "").replace(/=\?([^?]+)\?([BQbq])\?([^?]*)\?=/g, (_, charset, enc, text) => {
    try {
      if (String(enc).toUpperCase() === "B") return decodeBase64(text, charset);
      const qp = text.replace(/_/g, " ");
      const decoded = decodeQuotedPrintable(qp);
      const bytes = Uint8Array.from(decoded, (ch) => ch.charCodeAt(0));
      return bytesToString(bytes, charset);
    } catch {
      return text;
    }
  });
}

function headerValue(headers, name) {
  const re = new RegExp(`(?:^|\\r?\\n)${name}:\\s*([\\s\\S]*?)(?=\\r?\\n\\S|\\r?\\n\\r?\\n|$)`, "i");
  const match = String(headers || "").match(re);
  if (!match) return "";
  return decodeMimeWord(match[1].replace(/\r?\n[ \t]+/g, " ").trim());
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[if[\s\S]*?<!\[endif\]-->/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksLikeHtml(value) {
  return /<(?:!--|!\[if|html|head|body|div|p|table|tr|td|th|br|span|img|a|style|center|font|h[1-6])\b/i.test(String(value || ""));
}

function decodePartBody(raw, headers) {
  const transfer = headerValue(headers, "Content-Transfer-Encoding").toLowerCase();
  const type = headerValue(headers, "Content-Type");
  const charsetMatch = type.match(/charset="?([^";\s]+)"?/i);
  const charset = charsetMatch ? charsetMatch[1] : "utf-8";
  let text = String(raw || "");
  if (transfer.includes("base64")) text = decodeBase64(text, charset);
  else if (transfer.includes("quoted-printable")) {
    const decoded = decodeQuotedPrintable(text);
    const bytes = Uint8Array.from(decoded, (ch) => ch.charCodeAt(0));
    text = bytesToString(bytes, charset);
  }
  return text.trim();
}

function finalizeBodies(parts) {
  let plain = String(parts.plain || "").trim();
  let html = String(parts.html || "").trim();
  if (!html && looksLikeHtml(plain)) {
    html = plain;
    plain = stripHtml(plain);
  } else if (html && (!plain || looksLikeHtml(plain))) {
    plain = stripHtml(html);
  } else if (!plain && html) {
    plain = stripHtml(html);
  }
  return { plain, html };
}

function extractBodies(headers, bodyRaw) {
  const type = headerValue(headers, "Content-Type");
  const boundaryMatch = type.match(/boundary="?([^";]+)"?/i);
  if (/multipart\//i.test(type) && boundaryMatch) {
    const parsed = extractMultipartParts(bodyRaw, boundaryMatch[1]);
    if (parsed.plain || parsed.html) return finalizeBodies(parsed);
  }
  const loose = extractLooseMultipart(bodyRaw);
  if (loose && (loose.plain || loose.html)) return finalizeBodies(loose);
  const decoded = decodePartBody(bodyRaw, headers);
  if (/text\/html/i.test(type) || looksLikeHtml(decoded)) {
    return finalizeBodies({ plain: "", html: decoded });
  }
  return finalizeBodies({ plain: decoded, html: "" });
}

function extractMultipartParts(bodyRaw, boundary) {
  if (!boundary) return { plain: "", html: "" };
  const parts = String(bodyRaw || "").split(`--${boundary}`);
  let plain = "";
  let html = "";
  for (const part of parts) {
    if (!part || part === "--" || part.trim() === "--") continue;
    const split = part.replace(/^\r?\n/, "").split(/\r?\n\r?\n/);
    const partHeaders = split.shift() || "";
    const partBody = split.join("\n\n");
    const partType = headerValue(partHeaders, "Content-Type").toLowerCase();
    if (partType.includes("multipart/")) {
      const nested = headerValue(partHeaders, "Content-Type").match(/boundary="?([^";]+)"?/i);
      const nestedParts = nested ? extractMultipartParts(partBody, nested[1]) : { plain: "", html: "" };
      if (nestedParts.plain && !plain) plain = nestedParts.plain;
      if (nestedParts.html && !html) html = nestedParts.html;
      continue;
    }
    if (partType.includes("text/plain") && !plain) plain = decodePartBody(partBody, partHeaders);
    if (partType.includes("text/html") && !html) html = decodePartBody(partBody, partHeaders);
  }
  return { plain, html };
}

function extractLooseMultipart(raw) {
  const text = String(raw || "").replace(/^\uFEFF/, "").trim();
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  if (!firstLine.startsWith("--") || firstLine.length < 5) return null;
  const boundary = firstLine.slice(2).replace(/--\s*$/, "");
  if (!boundary) return null;
  return extractMultipartParts(text, boundary);
}

function parseAddress(value) {
  const text = decodeMimeWord(String(value || "").trim());
  if (!text) return "";
  const match = text.match(/<([^>]+)>/);
  if (match) {
    const name = text.replace(/<[^>]+>/, "").trim().replace(/^"|"$/g, "");
    return name ? `${name} <${match[1]}>` : match[1];
  }
  return text;
}

function parseAddressList(value) {
  return String(value || "")
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((part) => parseAddress(part))
    .filter(Boolean)
    .join(", ");
}

function looksLikeRawHeaders(text) {
  const sample = String(text || "").slice(0, 4000);
  if (!sample) return false;
  const hits = [
    /^Return-Path:/im,
    /^Delivered-To:/im,
    /^Received:/im,
    /^From:/im,
    /^Subject:/im,
    /^MIME-Version:/im,
    /^DKIM-Signature:/im,
    /^ARC-Seal:/im,
    /^Content-Type:/im,
  ].filter((re) => re.test(sample)).length;
  return hits >= 2;
}

function splitHeadersBody(raw) {
  const text = String(raw || "").replace(/^\uFEFF/, "");
  const match = text.match(/\r?\n\r?\n/);
  if (!match) {
    return looksLikeRawHeaders(text)
      ? { headers: text, body: "" }
      : { headers: "", body: text };
  }
  return {
    headers: text.slice(0, match.index),
    body: text.slice(match.index + match[0].length),
  };
}

function normalizeFetchedParts(headers, body) {
  let h = String(headers || "");
  let b = String(body || "");

  const hasIdentity = (block) => Boolean(headerValue(block, "From") || headerValue(block, "Subject"));

  if (hasIdentity(h)) return { headers: h, body: b };

  if (h && b) {
    const merged = splitHeadersBody(`${h.replace(/\s*$/, "")}\r\n${b}`);
    if (hasIdentity(merged.headers)) return merged;
  }

  if (looksLikeRawHeaders(b)) {
    const fromBody = splitHeadersBody(b);
    if (hasIdentity(fromBody.headers)) return fromBody;
  }

  if (looksLikeRawHeaders(h) && !b) {
    return splitHeadersBody(h);
  }

  return { headers: h, body: b };
}

function buildParsedMessage(uid, flags, headers, bodyRaw) {
  const parts = normalizeFetchedParts(headers, bodyRaw);
  let { plain, html } = extractBodies(parts.headers, parts.body);
  if (!plain && !html) {
    const fallback = decodePartBody(parts.body, parts.headers);
    if (/text\/html/i.test(headerValue(parts.headers, "Content-Type")) || looksLikeHtml(fallback)) {
      html = fallback;
      plain = stripHtml(fallback);
    } else if (!looksLikeRawHeaders(fallback)) {
      plain = fallback;
    }
  }
  // Never keep raw SMTP headers as the visible body.
  if (plain && looksLikeRawHeaders(plain) && !html) {
    plain = "";
  }
  return {
    uid: String(uid),
    flags,
    fromAddr: parseAddress(headerValue(parts.headers, "From")),
    toAddr: [
      parseAddressList(headerValue(parts.headers, "To")),
      parseAddressList(headerValue(parts.headers, "Cc"))
        ? `참조 ${parseAddressList(headerValue(parts.headers, "Cc"))}`
        : "",
    ].filter(Boolean).join(" · "),
    subject: decodeMimeWord(headerValue(parts.headers, "Subject")) || "(제목 없음)",
    body: String(plain || "").slice(0, 50000),
    bodyHtml: String(html || "").slice(0, 50000),
    dateHeader: headerValue(parts.headers, "Date"),
    isRead: /\b\\Seen\b/i.test(flags),
  };
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const err = new Error(message);
        err.code = "imap";
        reject(err);
      }, ms);
    }),
  ]);
}

class ImapClient {
  constructor(socket) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
    this.buffer = "";
    this.tag = 0;
  }

  async write(line) {
    await this.writer.write(this.encoder.encode(`${line}\r\n`));
  }

  async readLine() {
    while (true) {
      const idx = this.buffer.indexOf("\n");
      if (idx >= 0) {
        const line = this.buffer.slice(0, idx).replace(/\r$/, "");
        this.buffer = this.buffer.slice(idx + 1);
        return line;
      }
      const { value, done } = await this.reader.read();
      if (done) throw new Error("IMAP connection closed");
      this.buffer += this.decoder.decode(value, { stream: true });
      if (this.buffer.length > 2_000_000) throw new Error("IMAP response too large");
    }
  }

  async readResponse(tag) {
    const lines = [];
    while (true) {
      const line = await this.readLine();
      lines.push(line);
      if (line.startsWith(`${tag} `)) {
        const ok = line.startsWith(`${tag} OK`);
        return { ok, lines, status: line };
      }
    }
  }

  async command(payload) {
    this.tag += 1;
    const tag = `A${String(this.tag).padStart(4, "0")}`;
    await this.write(`${tag} ${payload}`);
    const response = await this.readResponse(tag);
    if (!response.ok) {
      const err = new Error(response.status || "IMAP command failed");
      err.code = "imap";
      throw err;
    }
    return response;
  }

  async readLiteral(size) {
    const max = Math.min(size, 200_000);
    let left = max;
    let out = "";
    while (left > 0) {
      if (this.buffer.length) {
        const chunk = this.buffer.slice(0, left);
        out += chunk;
        this.buffer = this.buffer.slice(chunk.length);
        left -= chunk.length;
        continue;
      }
      const { value, done } = await this.reader.read();
      if (done) throw new Error("IMAP connection closed");
      this.buffer += this.decoder.decode(value, { stream: true });
    }
    let skip = size - max;
    while (skip > 0) {
      if (this.buffer.length) {
        const take = Math.min(skip, this.buffer.length);
        this.buffer = this.buffer.slice(take);
        skip -= take;
        continue;
      }
      const { value, done } = await this.reader.read();
      if (done) break;
      this.buffer += this.decoder.decode(value, { stream: true });
    }
    return out;
  }

  async fetchMessage(uid) {
    const primary = await this.fetchRawMessage(uid, "BODY.PEEK[]");
    if (primary.fromAddr || primary.subject !== "(제목 없음)" || primary.body || primary.bodyHtml) {
      return primary;
    }
    return this.fetchRawMessage(uid, "RFC822");
  }

  async fetchRawMessage(uid, item) {
    this.tag += 1;
    const tag = `A${String(this.tag).padStart(4, "0")}`;
    await this.write(`${tag} UID FETCH ${uid} (UID FLAGS ${item})`);
    let raw = "";
    let headers = "";
    let body = "";
    let flags = "";
    let pending = "";
    while (true) {
      const line = await this.readLine();
      if (line.startsWith(`${tag} `)) {
        if (!line.startsWith(`${tag} OK`)) {
          const err = new Error(line);
          err.code = "imap";
          throw err;
        }
        break;
      }
      if (/FLAGS \(/i.test(line)) {
        const flagMatch = line.match(/FLAGS \(([^)]*)\)/i);
        if (flagMatch) flags = flagMatch[1];
      }
      if (/RFC822\.HEADER/i.test(line) || /BODY\[HEADER\]/i.test(line)) pending = "header";
      else if (/RFC822\.TEXT/i.test(line) || /BODY\[TEXT\]/i.test(line)) pending = "text";
      else if (/BODY\.PEEK\[\]|BODY\[\]|RFC822(?!\.)/i.test(line)) pending = "raw";

      const literal = line.match(/\{(\d+)\}\s*$/);
      if (literal) {
        const content = await this.readLiteral(Number(literal[1]));
        if (pending === "header") headers = content;
        else if (pending === "text") body = content;
        else if (pending === "raw") raw = content;
        else if (!raw && !headers) raw = content;
        else body = content;
        pending = "";
      }
    }

    if (raw) {
      const split = splitHeadersBody(raw);
      return buildParsedMessage(uid, flags, split.headers, split.body);
    }
    return buildParsedMessage(uid, flags, headers, body);
  }

  async close() {
    try { await this.command("LOGOUT"); } catch {}
    try { await this.writer.close(); } catch {}
    try { this.reader.releaseLock(); } catch {}
    try { this.socket.close(); } catch {}
  }
}

function encodeMailbox(name) {
  const text = String(name || "INBOX");
  if (/^INBOX$/i.test(text)) return "INBOX";
  if (/^[\w.-]+$/.test(text)) return text;
  return encodeImapString(text);
}

function decodeImapUtf7(value) {
  return String(value || "").replace(/&([^-]*)-/g, (_, data) => {
    if (!data) return "&";
    try {
      const b64 = data.replace(/,/g, "/");
      const pad = b64 + "===".slice((b64.length + 3) % 4);
      const bytes = Uint8Array.from(atob(pad), (ch) => ch.charCodeAt(0));
      return new TextDecoder("utf-16be").decode(bytes);
    } catch {
      return data;
    }
  });
}

function parseListMailboxes(lines) {
  const names = [];
  for (const line of lines || []) {
    if (!/^\* LIST /i.test(line)) continue;
    const quoted = [...String(line).matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    let name = "";
    if (quoted.length >= 2) name = quoted[quoted.length - 1];
    else {
      const tail = String(line).trim().split(/\s+/).pop() || "";
      name = tail.replace(/^"|"$/g, "");
    }
    if (!name || name === "/" || name === ".") continue;
    if (!names.includes(name)) names.push(name);
  }
  return names;
}

function pickMailboxes(names, settings) {
  const list = (Array.isArray(names) ? names : []).map((name) => ({
    raw: name,
    label: decodeImapUtf7(name),
  }));
  const picked = [];
  const push = (name) => {
    if (name && !picked.includes(name)) picked.push(name);
  };
  const inbox = list.find((item) => /^inbox$/i.test(item.label) || /^inbox$/i.test(item.raw));
  push(inbox ? inbox.raw : "INBOX");

  const address = String(settings.address || "").toLowerCase();
  const domain = address.includes("@") ? address.split("@")[1] : "";
  const keywords = ["스마트", "웍스", "works", "smart", "office", "기업", "회사", "jacobsoft", "받은"];
  if (domain) keywords.push(domain.split(".")[0]);

  for (const item of list) {
    const lower = `${item.label} ${item.raw}`.toLowerCase();
    if (/^inbox$/i.test(item.label)) continue;
    if (keywords.some((key) => key && lower.includes(String(key).toLowerCase()))) push(item.raw);
  }
  return picked.slice(0, 4);
}

export async function fetchInboxMessages(settings, limit = 8, options = {}) {
  const host = String(settings.imapHost || "").trim();
  const port = Number(settings.imapPort || 993);
  const password = String(settings.imapPassword || "");
  if (!host || !password) {
    const err = new Error("settings");
    err.code = "settings";
    throw err;
  }

  const candidates = [];
  const pushUser = (value) => {
    const text = String(value || "").trim();
    if (text && !candidates.includes(text)) candidates.push(text);
  };
  if (settings.id === "works") {
    // 회사 주소 사서함을 먼저 연다. Daum ID는 개인 받은편지함으로 붙는 경우가 있다.
    pushUser(settings.address);
    pushUser(settings.imapUser);
    pushUser(String(settings.address || "").split("@")[0]);
    for (const alias of options.loginAliases || []) pushUser(alias);
  } else {
    pushUser(settings.imapUser);
    pushUser(settings.address);
    if (String(settings.address || "").includes("@")) {
      pushUser(String(settings.address).split("@")[0]);
    }
  }
  if (!candidates.length) {
    const err = new Error("settings");
    err.code = "settings";
    throw err;
  }

  async function openClient() {
    const socket = connect(
      { hostname: host, port },
      { secureTransport: settings.imapSecure === false ? "off" : "on" }
    );
    await withTimeout(socket.opened, 8000, "IMAP 소켓 연결 시간 초과");
    const client = new ImapClient(socket);
    const greeting = await withTimeout(client.readLine(), 8000, "IMAP greeting 시간 초과");
    if (!/^\* OK/i.test(greeting)) {
      await client.close();
      const err = new Error(`IMAP greeting failed: ${greeting}`);
      err.code = "imap";
      throw err;
    }
    return client;
  }

  function searchUids(lines) {
    const uidLine = (lines || []).find((line) => line.startsWith("* SEARCH")) || "";
    return uidLine.replace("* SEARCH", "").trim().split(/\s+/).filter(Boolean);
  }

  async function searchMailbox(client, mailbox, address) {
    await withTimeout(client.command(`SELECT ${encodeMailbox(mailbox)}`), 10000, `SELECT ${mailbox} 시간 초과`);
    if (!address) {
      const all = await withTimeout(client.command("UID SEARCH ALL"), 10000, "SEARCH 시간 초과");
      return searchUids(all.lines);
    }
    const quoted = encodeImapString(address);
    try {
      const found = await withTimeout(
        client.command(`UID SEARCH OR OR TO ${quoted} CC ${quoted} HEADER Delivered-To ${quoted}`),
        10000,
        "SEARCH 시간 초과",
      );
      return searchUids(found.lines);
    } catch {
      const all = await withTimeout(client.command("UID SEARCH ALL"), 10000, "SEARCH 시간 초과");
      return searchUids(all.lines);
    }
  }

  async function fetchUids(client, mailbox, uids, take) {
    const recent = uids.slice(-Math.max(1, take));
    const messages = [];
    for (let i = recent.length - 1; i >= 0; i -= 1) {
      try {
        const item = await withTimeout(client.fetchMessage(recent[i]), 12000, `FETCH 시간 초과 (uid ${recent[i]})`);
        messages.push({
          ...item,
          mailbox,
          uid: `${mailbox}:${item.uid}`,
        });
      } catch (error) {
        messages.push({
          uid: `${mailbox}:${recent[i]}`,
          mailbox,
          flags: "",
          fromAddr: "",
          toAddr: "",
          subject: `(가져오기 실패: ${mailbox} ${recent[i]})`,
          body: String(error && error.message || "본문을 가져오지 못했습니다."),
          bodyHtml: "",
          dateHeader: "",
          isRead: true,
        });
      }
    }
    return messages;
  }

  function matchesAddress(item, address) {
    if (!address) return true;
    const blob = `${item.toAddr || ""} ${item.fromAddr || ""}`.toLowerCase();
    return blob.includes(String(address).toLowerCase());
  }

  const perAccountLimit = settings.id === "works" ? Math.max(limit, 15) : limit;
  const watchAddress = settings.id === "works" ? String(settings.address || "").trim() : "";

  return withTimeout((async () => {
    let client = null;
    let lastLoginError = null;
    let fallback = [];
    for (const candidate of candidates) {
      try {
        if (client) await client.close();
        client = await openClient();
        await withTimeout(
          client.command(`LOGIN ${encodeImapString(candidate)} ${encodeImapString(password)}`),
          8000,
          `LOGIN 시간 초과 (${candidate})`
        );
        lastLoginError = null;
      } catch (error) {
        lastLoginError = error;
        client = null;
        continue;
      }

      let mailboxes = ["INBOX"];
      try {
        const listed = await withTimeout(client.command('LIST "" "*"'), 8000, "LIST 시간 초과");
        mailboxes = pickMailboxes(parseListMailboxes(listed.lines), settings);
      } catch {
        mailboxes = ["INBOX"];
      }

      const matched = [];
      const recent = [];
      for (const mailbox of mailboxes) {
        try {
          const uids = await searchMailbox(client, mailbox, watchAddress);
          const rows = await fetchUids(client, mailbox, uids, watchAddress ? 12 : perAccountLimit);
          if (watchAddress) {
            const hits = rows.filter((item) => matchesAddress(item, watchAddress));
            matched.push(...(hits.length ? hits : rows.slice(0, 4)));
          }
          recent.push(...rows);
        } catch (error) {
          if (mailbox === "INBOX" && !watchAddress) throw error;
        }
      }
      const chosen = watchAddress ? matched.filter((item) => matchesAddress(item, watchAddress)) : recent;
      if (chosen.length) {
        await client.close();
        return chosen.slice(0, perAccountLimit);
      }
      if (!fallback.length) fallback = recent;
      await client.close();
      client = null;
      if (!watchAddress) break;
    }
    if (!fallback.length && lastLoginError) {
      const err = new Error(lastLoginError && lastLoginError.message
        ? `LOGIN 실패: ${lastLoginError.message}`
        : "LOGIN 실패");
      err.code = "imap";
      throw err;
    }
    return fallback.slice(0, perAccountLimit);
  })(), watchAddress ? 45000 : 28000, "메일 서버 응답이 없습니다. IMAP 설정·앱 비밀번호를 확인하세요.");
}
