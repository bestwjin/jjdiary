import assert from "node:assert/strict";
import { addDays, buildMessage, eventsOn, kstToday, normalizeEvents, weekday } from "./logic.js";
import builtin from "./builtin-events.json" with { type: "json" };

assert.equal(kstToday(new Date("2026-09-28T14:59:00Z")), "2026-09-28");
assert.equal(kstToday(new Date("2026-09-28T15:00:00Z")), "2026-09-29");
assert.equal(addDays("2026-10-11", 1), "2026-10-12");
assert.equal(addDays("2026-09-30", 1), "2026-10-01");
assert.equal(weekday("2026-10-12"), "월");

const due = eventsOn(builtin, "2026-10-16");
assert.deepEqual(due.map((event) => event.title), ["태강삼육초 설명회 접수", "상명초 설명회 접수 마감"]);
const message = buildMessage("2026-10-16", due);
assert.match(message, /내일\(10월 16일, 금\)/);
assert.match(message, /09:00 태강삼육초 설명회 접수/);
assert.match(message, /서울 노원구 덕릉로 541/);
assert.equal(eventsOn(builtin, "2026-09-29").length, 0);
assert.equal(normalizeEvents([{ date: "2026-10-12", title: "추가 일정", school: "화랑초등학교" }])?.length, 1);
assert.equal(normalizeEvents([{ date: "10-12", title: "잘못된 날짜" }]), null);
assert.equal(builtin.some((event) => event.school === "영훈초등학교"), false);
console.log("ok");
