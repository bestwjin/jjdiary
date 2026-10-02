import assert from "node:assert/strict";
import { addDays, buildMessage, buildReminderMessage, buildScheduleMessage, eventsOn, isNotifyWindow, kstToday, normalizeEvents, normalizeNotifyTime, schedulesOn, weekday } from "./logic.js";
import builtin from "./builtin-events.json" with { type: "json" };

assert.equal(kstToday(new Date("2026-09-28T14:59:00Z")), "2026-09-28");
assert.equal(kstToday(new Date("2026-09-28T15:00:00Z")), "2026-09-29");
assert.equal(addDays("2026-10-11", 1), "2026-10-12");
assert.equal(addDays("2026-09-30", 1), "2026-10-01");
assert.equal(weekday("2026-10-12"), "월");
assert.equal(normalizeNotifyTime("9:05"), "09:05");
assert.equal(normalizeNotifyTime("bad"), "10:00");
assert.equal(isNotifyWindow(new Date("2026-10-01T01:00:00Z"), "10:00"), true);
assert.equal(isNotifyWindow(new Date("2026-10-01T01:04:00Z"), "10:00"), true);
assert.equal(isNotifyWindow(new Date("2026-10-01T01:05:00Z"), "10:00"), false);

const due = eventsOn(builtin, "2026-10-16");
assert.deepEqual(due.map((event) => event.title), ["태강삼육초 설명회 접수", "상명초 설명회 접수 마감"]);
const message = buildMessage("2026-10-16", due);
assert.match(message, /내일\(10월 16일, 금\) 입학설명회 일정이에요/);
assert.match(message, /09:00 태강삼육초 설명회 접수/);
assert.match(message, /서울 노원구 덕릉로 541/);
assert.equal(eventsOn(builtin, "2026-09-29").length, 0);
assert.equal(normalizeEvents([{ date: "2026-10-12", title: "추가 일정", school: "화랑초등학교" }])?.length, 1);
assert.equal(normalizeEvents([{ date: "10-12", title: "잘못된 날짜" }]), null);
assert.equal(builtin.some((event) => event.school === "영훈초등학교"), false);

const schedules = schedulesOn([
  { date: "2026-10-02", title: "병원", time: "14:00", allDay: false, memo: "진료" },
  { date: "2026-10-02", title: "회의", time: "", allDay: true, memo: "" },
  { date: "2026-10-03", title: "다른날", time: "09:00", allDay: false, memo: "" },
], "2026-10-02");
assert.deepEqual(schedules.map((item) => item.title), ["회의", "병원"]);
assert.match(buildScheduleMessage("2026-10-02", schedules), /종일 회의/);
assert.match(buildScheduleMessage("2026-10-02", schedules), /14:00 병원/);
assert.match(buildReminderMessage("2026-10-02", [], schedules), /개인 일정이에요/);
assert.equal(buildReminderMessage("2026-10-02", [], []), "");
console.log("ok");
