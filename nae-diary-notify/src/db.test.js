import assert from "node:assert/strict";
import { cleanCreatedAt, cleanEvent, cleanSchedule, cleanTodo, mapRow, mapSchedule, mapTodo } from "./db.js";

assert.equal(cleanEvent({ title: "설명회", school: "상명초등학교", date: "2026-10-12T00:00:00.000Z", type: "info-session" }).date, "2026-10-12");
assert.equal(cleanEvent({ title: "", school: "상명초등학교", date: "2026-10-12" }), null);
assert.equal(cleanEvent({ title: "설명회", school: "상명초등학교", date: "2026-10-12", type: "nope" }).type, "info-session");

assert.deepEqual(mapRow({
  id: "16",
  title: "영훈초 입학설명회",
  school: "영훈초등학교",
  event_date: "2026-10-30",
  event_time: "10:00",
  event_type: "info-session",
  description: "",
  priority: "medium",
}), {
  id: 16,
  title: "영훈초 입학설명회",
  school: "영훈초등학교",
  date: "2026-10-30",
  time: "10:00",
  type: "info-session",
  description: "",
  priority: "medium",
});

assert.equal(mapRow({
  id: 1,
  title: "접수",
  school: "상명초등학교",
  event_date: new Date("2026-09-28T00:00:00Z"),
  event_time: "",
  event_type: "registration-open",
  description: "",
  priority: "medium",
}).date, "2026-09-28");

assert.equal(cleanSchedule({ title: "  회의  ", date: "2026-09-30", time: "09:30", memo: " 준비 " }).title, "회의");
assert.equal(cleanSchedule({ title: "회의", date: "2026-09-30", time: "9시" }), null);
assert.equal(cleanSchedule({ title: "", date: "2026-09-30" }), null);
assert.equal(cleanSchedule({ title: "회의", date: "2026-09-30", allDay: true, time: "09:30" }).time, "");
assert.equal(cleanSchedule({ title: "회의", date: "2026-09-30", allDay: true }).allDay, true);
assert.equal(cleanSchedule({ title: "회의", date: "2026-09-30" }).priority, "보통");
assert.equal(cleanSchedule({ title: "회의", date: "2026-09-30", priority: "높음" }).priority, "높음");
assert.equal(mapSchedule({ id: "4", title: "회의", schedule_date: new Date("2026-09-30T00:00:00Z"), schedule_time: "09:30", memo: "", priority: "낮음", all_day: false }).priority, "낮음");
assert.equal(mapSchedule({ id: "4", title: "회의", schedule_date: new Date("2026-09-30T00:00:00Z"), schedule_time: "09:30", memo: "", all_day: true }).allDay, true);
assert.equal(mapSchedule({ id: "4", title: "회의", schedule_date: new Date("2026-09-30T00:00:00Z"), schedule_time: "09:30", memo: "" }).date, "2026-09-30");

assert.equal(cleanTodo({ title: "  준비물 챙기기  ", tag: " 입학 ", requester: " 김선생 ", aiTool: "claude" }).aiTool, "CLAUDE");
assert.equal(cleanTodo({ title: "준비물", aiTool: "기타" }).aiTool, "");
assert.deepEqual(cleanTodo({
  title: "수정",
  files: [{ category: "JAVA", filename: " A.java ", changeNote: " 조회 추가 " }, { category: "CSS", filename: "a.css", changeNote: "x" }],
}).files, [{ category: "JAVA", filename: "A.java", changeNote: "조회 추가" }]);
assert.equal(cleanTodo({ title: "  준비물 챙기기  ", tag: " 입학 ", requester: " 김선생 " }).tag, "입학");
assert.equal(cleanTodo({ title: "  준비물 챙기기  ", tag: " 입학 ", requester: " 김선생 " }).requester, "김선생");
assert.equal(cleanTodo({ title: "   " }), null);
assert.equal(cleanTodo({ title: "준비물", priority: "높음" }).priority, "높음");
assert.equal(cleanCreatedAt({ createdAt: "2026-10-01" }, "2026-09-30T01:23:45.000Z"), "2026-10-01T01:23:45.000Z");
assert.equal(cleanCreatedAt({}, "2026-09-30T01:23:45.000Z"), null);
assert.equal(cleanCreatedAt({ createdAt: "bad" }, "2026-09-30T01:23:45.000Z"), null);
assert.equal(cleanTodo({ title: "준비물", priority: "urgent" }).priority, "보통");
assert.equal(cleanTodo({ title: "준비물" }).priority, "보통");
assert.equal(mapTodo({ id: "12", title: "준비물", priority: "낮음", done: false, created_at: "2026-09-29T00:00:00.000Z" }).priority, "낮음");
assert.equal(mapTodo({ id: "12", title: "준비물", tag: "입학", requester: "김선생", done: false, created_at: "2026-09-29T00:00:00.000Z" }).tag, "입학");
console.log("ok");
