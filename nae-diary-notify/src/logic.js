const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const ADDRESSES = {
  상명초등학교: "서울 노원구 덕릉로 541",
  태강삼육초등학교: "서울 노원구 화랑로 815",
  화랑초등학교: "서울 노원구 화랑로 621",
  금성초등학교: "서울 중랑구 신내로21길 55",
  심석초등학교: "경기도 남양주시 화도읍 마석로76번길 10",
};

export function kstToday(now = new Date()) {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekday(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d, 3)).getUTCDay()];
}

export function normalizeEvents(input) {
  if (!Array.isArray(input) || input.length > 200) return null;
  const events = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return null;
    if (typeof raw.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;
    const title = String(raw.title || "").trim().slice(0, 200);
    if (!title) return null;
    events.push({
      id: raw.id ?? null,
      date: raw.date,
      title,
      school: String(raw.school || "").trim().slice(0, 80),
      time: String(raw.time || "").trim().slice(0, 20),
      description: String(raw.description || "").trim().slice(0, 300),
    });
  }
  return events;
}

export function eventsOn(events, iso) {
  return events
    .filter((event) => event.date === iso)
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99") || a.title.localeCompare(b.title, "ko"));
}

export function buildMessage(tomorrow, events) {
  const [, month, day] = tomorrow.split("-");
  const lines = events.map((event) => {
    const when = event.time ? `${event.time} ` : "";
    const rows = [`• ${when}${event.title}`];
    if (event.school) rows.push(`  ${event.school}`);
    if (ADDRESSES[event.school]) rows.push(`  ${ADDRESSES[event.school]}`);
    if (event.description) rows.push(`  ${event.description}`);
    return rows.join("\n");
  });
  return `내일(${Number(month)}월 ${Number(day)}일, ${weekday(tomorrow)}) 일정이에요.\n\n${lines.join("\n\n")}`;
}
