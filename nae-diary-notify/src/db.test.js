import assert from "node:assert/strict";
import { cleanEvent, cleanTodo, mapRow, mapTodo } from "./db.js";

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

assert.equal(cleanTodo({ title: "  준비물 챙기기  " }).title, "준비물 챙기기");
assert.equal(cleanTodo({ title: "   " }), null);
assert.equal(mapTodo({ id: "12", title: "준비물", done: false, created_at: "2026-09-29T00:00:00.000Z" }).done, false);
console.log("ok");
