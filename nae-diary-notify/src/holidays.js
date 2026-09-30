import { getKasiServiceKey } from "./db.js";

const CACHE_TTL_OK_MS = 6 * 60 * 60 * 1000;

function unwrapKey(key) {
  const value = String(key || "").trim();
  if (!/%[0-9A-Fa-f]{2}/.test(value)) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function tagValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match ? match[1].trim() : "";
}

function parseHolidays(xmlText) {
  const xml = String(xmlText || "");
  const resultCode = tagValue(xml, "resultCode");
  if (resultCode !== "00") throw new Error("api_" + (resultCode || "error"));

  const map = new Map();
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRe.exec(xml))) {
    const item = match[1];
    if (tagValue(item, "isHoliday") !== "Y") continue;
    const locdate = tagValue(item, "locdate");
    const name = tagValue(item, "dateName");
    if (!/^\d{8}$/.test(locdate) || !name) continue;
    const date = `${locdate.slice(0, 4)}-${locdate.slice(4, 6)}-${locdate.slice(6, 8)}`;
    map.set(date, map.has(date) ? `${map.get(date)} · ${name}` : name);
  }
  return Array.from(map.entries()).map(([date, name]) => ({ date, name }));
}

async function readCache(env, key) {
  try {
    const saved = await env.DIARY.get(key, "json");
    if (!saved || !Array.isArray(saved.holidays) || typeof saved.expires !== "number") return null;
    return saved;
  } catch {
    return null;
  }
}

async function writeCache(env, key, holidays, ttlMs) {
  await env.DIARY.put(key, JSON.stringify({
    expires: Date.now() + ttlMs,
    holidays,
  }));
}

export async function getHolidays(env, year, month) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return { status: "BAD_REQUEST", holidays: [] };
  if (!Number.isInteger(month) || month < 1 || month > 12) return { status: "BAD_REQUEST", holidays: [] };

  const key = unwrapKey(await getKasiServiceKey(env));
  if (!key) return { status: "NOT_CONFIGURED", holidays: [] };

  const cacheKey = `holidays:${year}-${String(month).padStart(2, "0")}`;
  const cached = await readCache(env, cacheKey);
  if (cached && cached.expires > Date.now()) {
    return { status: "OK", holidays: cached.holidays };
  }

  try {
    const query = new URLSearchParams({
      solYear: String(year),
      solMonth: String(month).padStart(2, "0"),
      numOfRows: "100",
      pageNo: "1",
      ServiceKey: key,
    });
    const response = await fetch(
      `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?${query}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!response.ok) throw new Error("http_" + response.status);
    const xml = await response.text();
    const holidays = parseHolidays(xml);
    await writeCache(env, cacheKey, holidays, CACHE_TTL_OK_MS);
    return { status: "OK", holidays };
  } catch {
    if (cached?.holidays?.length) return { status: "STALE", holidays: cached.holidays };
    return { status: "UNAVAILABLE", holidays: [] };
  }
}
