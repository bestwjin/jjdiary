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
    .trim();
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
  const plain = String(parts.plain || "").trim();
  const html = String(parts.html || "").trim();
  return {
    plain: plain || (html ? stripHtml(html) : ""),
    html,
  };
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
  if (/text\/html/i.test(type)) {
    return { plain: stripHtml(decoded), html: decoded };
  }
  return { plain: decoded, html: "" };
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
    this.tag += 1;
    const tag = `A${String(this.tag).padStart(4, "0")}`;
    await this.write(`${tag} UID FETCH ${uid} (UID FLAGS RFC822.HEADER RFC822.TEXT)`);
    let headers = "";
    let body = "";
    let flags = "";
    let part = 0;
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
      if (line.startsWith("* ")) {
        const flagMatch = line.match(/FLAGS \(([^)]*)\)/i);
        if (flagMatch) flags = flagMatch[1];
      }
      const literal = line.match(/\{(\d+)\}\s*$/);
      if (literal) {
        const content = await this.readLiteral(Number(literal[1]));
        if (part === 0) headers = content;
        else body = content;
        part += 1;
      }
    }
    if (!headers && !body) {
      return this.fetchMessageFallback(uid);
    }
    let { plain, html } = extractBodies(headers, body);
    if (!plain && !html) {
      const fallback = decodePartBody(body, headers);
      if (/text\/html/i.test(headerValue(headers, "Content-Type"))) {
        html = fallback;
        plain = stripHtml(fallback);
      } else {
        plain = fallback;
      }
    }
    return {
      uid: String(uid),
      flags,
      fromAddr: parseAddress(headerValue(headers, "From")),
      toAddr: parseAddress(headerValue(headers, "To")),
      subject: decodeMimeWord(headerValue(headers, "Subject")) || "(제목 없음)",
      body: String(plain || "").slice(0, 50000),
      bodyHtml: String(html || "").slice(0, 50000),
      dateHeader: headerValue(headers, "Date"),
      isRead: /\b\\Seen\b/i.test(flags),
    };
  }

  async fetchMessageFallback(uid) {
    this.tag += 1;
    const tag = `A${String(this.tag).padStart(4, "0")}`;
    await this.write(`${tag} UID FETCH ${uid} (UID FLAGS BODY.PEEK[])`);
    let raw = "";
    let flags = "";
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
      const flagMatch = line.match(/FLAGS \(([^)]*)\)/i);
      if (flagMatch) flags = flagMatch[1];
      const literal = line.match(/\{(\d+)\}\s*$/);
      if (literal) raw = await this.readLiteral(Number(literal[1]));
    }
    const split = String(raw || "").split(/\r?\n\r?\n/);
    const headers = split.shift() || "";
    const bodyRaw = split.join("\n\n");
    const { plain, html } = extractBodies(headers, bodyRaw);
    return {
      uid: String(uid),
      flags,
      fromAddr: parseAddress(headerValue(headers, "From")),
      toAddr: parseAddress(headerValue(headers, "To")),
      subject: decodeMimeWord(headerValue(headers, "Subject")) || "(제목 없음)",
      body: String(plain || "").slice(0, 50000),
      bodyHtml: String(html || "").slice(0, 50000),
      dateHeader: headerValue(headers, "Date"),
      isRead: /\b\\Seen\b/i.test(flags),
    };
  }

  async close() {
    try { await this.command("LOGOUT"); } catch {}
    try { await this.writer.close(); } catch {}
    try { this.reader.releaseLock(); } catch {}
    try { this.socket.close(); } catch {}
  }
}

export async function fetchInboxMessages(settings, limit = 8) {
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
  pushUser(settings.imapUser);
  pushUser(settings.address);
  if (String(settings.address || "").includes("@")) {
    pushUser(String(settings.address).split("@")[0]);
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

  return withTimeout((async () => {
    let client = null;
    let lastLoginError = null;
    for (const candidate of candidates) {
      try {
        if (client) await client.close();
        client = await openClient();
        await withTimeout(
          client.command(`LOGIN ${encodeImapString(candidate)} ${encodeImapString(password)}`),
          10000,
          `LOGIN 시간 초과 (${candidate})`
        );
        lastLoginError = null;
        break;
      } catch (error) {
        lastLoginError = error;
        client = null;
      }
    }
    if (!client || lastLoginError) {
      const err = new Error(lastLoginError && lastLoginError.message
        ? `LOGIN 실패: ${lastLoginError.message}`
        : "LOGIN 실패");
      err.code = "imap";
      throw err;
    }

    try {
      await withTimeout(client.command("SELECT INBOX"), 10000, "SELECT INBOX 시간 초과");
      const search = await withTimeout(client.command("UID SEARCH ALL"), 10000, "SEARCH 시간 초과");
      const uidLine = search.lines.find((line) => line.startsWith("* SEARCH")) || "";
      const uids = uidLine.replace("* SEARCH", "").trim().split(/\s+/).filter(Boolean);
      const recent = uids.slice(-Math.max(1, Math.min(limit, 5)));
      const messages = [];
      for (let i = recent.length - 1; i >= 0; i -= 1) {
        try {
          messages.push(await withTimeout(client.fetchMessage(recent[i]), 12000, `FETCH 시간 초과 (uid ${recent[i]})`));
        } catch (error) {
          messages.push({
            uid: String(recent[i]),
            flags: "",
            fromAddr: "",
            toAddr: "",
            subject: `(가져오기 실패: uid ${recent[i]})`,
            body: String(error && error.message || "본문을 가져오지 못했습니다."),
            dateHeader: "",
            isRead: true,
          });
        }
      }
      return messages;
    } finally {
      await client.close();
    }
  })(), 28000, "메일 서버 응답이 없습니다. IMAP 설정·앱 비밀번호를 확인하세요.");
}
