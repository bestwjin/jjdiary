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

export function kstTimeParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  function part(type) {
    const found = parts.find((item) => item.type === type);
    return found ? found.value : "00";
  }
  return {
    hour: Number(part("hour")),
    minute: Number(part("minute")),
  };
}

export function normalizeNotifyTime(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "10:00";
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return "10:00";
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function isNotifyWindow(now, notifyTime, windowMinutes = 5) {
  const time = normalizeNotifyTime(notifyTime);
  const [hour, minute] = time.split(":").map(Number);
  const parts = kstTimeParts(now);
  const nowMins = parts.hour * 60 + parts.minute;
  const target = hour * 60 + minute;
  return nowMins >= target && nowMins < target + windowMinutes;
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

export function schedulesOn(schedules, iso) {
  return (Array.isArray(schedules) ? schedules : [])
    .filter((item) => item && item.date === iso)
    .sort((a, b) => {
      const aAll = a.allDay === true ? 0 : 1;
      const bAll = b.allDay === true ? 0 : 1;
      if (aAll !== bAll) return aAll - bAll;
      const timeDiff = String(a.time || "99:99").localeCompare(String(b.time || "99:99"));
      if (timeDiff) return timeDiff;
      return String(a.title || "").localeCompare(String(b.title || ""), "ko");
    });
}

export function buildMessage(tomorrow, events) {
  const [, month, day] = tomorrow.split("-");
  const lines = events.map((event) => {
    const when = event.time ? `${event.time} ` : "";
    const priority = event.priority === "high" || event.priority === "높음" ? " [중요]" : "";
    const rows = [`• ${when}${event.title}${priority}`];
    if (event.school) rows.push(`  ${event.school}`);
    if (ADDRESSES[event.school]) rows.push(`  ${ADDRESSES[event.school]}`);
    if (event.description) rows.push(`  ${event.description}`);
    return rows.join("\n");
  });
  return `내일(${Number(month)}월 ${Number(day)}일, ${weekday(tomorrow)}) 입학설명회 일정이에요.\n\n${lines.join("\n\n")}`;
}

export function buildScheduleMessage(tomorrow, schedules) {
  const [, month, day] = tomorrow.split("-");
  const lines = schedules.map((item) => {
    const when = item.allDay ? "종일 " : item.time ? `${item.time} ` : "";
    const rows = [`• ${when}${item.title}`];
    if (item.memo) rows.push(`  ${item.memo}`);
    return rows.join("\n");
  });
  return `내일(${Number(month)}월 ${Number(day)}일, ${weekday(tomorrow)}) 개인 일정이에요.\n\n${lines.join("\n\n")}`;
}

export function buildReminderMessage(tomorrow, events, schedules) {
  const parts = [];
  if (events?.length) parts.push(buildMessage(tomorrow, events));
  if (schedules?.length) parts.push(buildScheduleMessage(tomorrow, schedules));
  return parts.join("\n\n");
}
