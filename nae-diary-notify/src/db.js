import { neon } from "@neondatabase/serverless";
import builtinEvents from "./builtin-events.json" with { type: "json" };

const TYPES = new Set(["registration-open", "info-session", "application", "lottery", "registration"]);
const PRIORITIES = new Set(["high", "medium", "low"]);

export function cleanEvent(input) {
  if (!input || typeof input !== "object") return null;
  const date = typeof input.date === "string" ? input.date.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const title = String(input.title || "").trim().slice(0, 200);
  const school = String(input.school || "").trim().slice(0, 80);
  if (!title || !school) return null;
  return {
    title,
    school,
    date,
    time: String(input.time || "").trim().slice(0, 20),
    type: TYPES.has(input.type) ? input.type : "info-session",
    description: String(input.description || "").trim().slice(0, 300),
    priority: PRIORITIES.has(input.priority) ? input.priority : "medium",
  };
}

export function mapRow(row) {
  let date = row.event_date;
  if (date instanceof Date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    date = `${y}-${m}-${d}`;
  } else {
    date = String(date).slice(0, 10);
  }
  return {
    id: Number(row.id),
    title: row.title,
    school: row.school || "",
    date,
    time: row.event_time || "",
    type: row.event_type || "info-session",
    description: row.description || "",
    priority: row.priority || "medium",
  };
}

function databaseError() {
  const error = new Error("database_not_configured");
  error.code = "database_not_configured";
  return error;
}

async function ensureSchema(sql) {
  const root = globalThis;
  if (!root.__diarySchema) {
    root.__diarySchema = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS events (
        id BIGINT PRIMARY KEY,
        title TEXT NOT NULL,
        school TEXT NOT NULL DEFAULT '',
        event_date DATE NOT NULL,
        event_time TEXT NOT NULL DEFAULT '',
        event_type TEXT NOT NULL DEFAULT 'info-session',
        description TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'medium'
      )`;
      const rows = await sql`SELECT COUNT(*)::int AS n FROM events`;
      if (Number(rows[0].n) === 0) {
        const payload = JSON.stringify(builtinEvents.map((event) => ({
          id: event.id,
          title: event.title,
          school: event.school || "",
          event_date: event.date,
          event_time: event.time || "",
          event_type: event.type || "info-session",
          description: event.description || "",
          priority: event.priority || "medium",
        })));
        await sql`INSERT INTO events (id, title, school, event_date, event_time, event_type, description, priority)
          SELECT id, title, school, event_date, event_time, event_type, description, priority
          FROM json_to_recordset(${payload}::json) AS x(
            id bigint,
            title text,
            school text,
            event_date date,
            event_time text,
            event_type text,
            description text,
            priority text
          )
          ON CONFLICT (id) DO NOTHING`;
      }
      await sql`CREATE TABLE IF NOT EXISTS todos (
        id BIGINT PRIMARY KEY,
        title TEXT NOT NULL,
        tag TEXT NOT NULL DEFAULT '',
        requester TEXT NOT NULL DEFAULT '',
        ai_tool TEXT NOT NULL DEFAULT '',
        work_content TEXT NOT NULL DEFAULT '',
        files JSONB NOT NULL DEFAULT '[]'::jsonb,
        done BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS tag TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS requester TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS ai_tool TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS work_content TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS files JSONB NOT NULL DEFAULT '[]'::jsonb`;
    })().catch((error) => {
      root.__diarySchema = null;
      throw error;
    });
  }
  return root.__diarySchema;
}

async function withDb(env, fn) {
  if (!env.DATABASE_URL) throw databaseError();
  const sql = neon(env.DATABASE_URL);
  await ensureSchema(sql);
  return fn(sql);
}

export async function listEvents(env) {
  return withDb(env, async (sql) => {
    const rows = await sql`SELECT id, title, school, event_date, event_time, event_type, description, priority
      FROM events
      ORDER BY event_date, event_time, id`;
    return rows.map(mapRow);
  });
}

export async function createEvent(env, input) {
  const event = cleanEvent(input);
  if (!event) return null;
  const id = Date.now();
  return withDb(env, async (sql) => {
    const rows = await sql`INSERT INTO events (id, title, school, event_date, event_time, event_type, description, priority)
      VALUES (${id}, ${event.title}, ${event.school}, ${event.date}, ${event.time}, ${event.type}, ${event.description}, ${event.priority})
      RETURNING id, title, school, event_date, event_time, event_type, description, priority`;
    return mapRow(rows[0]);
  });
}

export async function updateEvent(env, id, input) {
  const event = cleanEvent(input);
  const eventId = Number(id);
  if (!event || !Number.isInteger(eventId)) return null;
  return withDb(env, async (sql) => {
    const rows = await sql`UPDATE events
      SET title = ${event.title},
          school = ${event.school},
          event_date = ${event.date},
          event_time = ${event.time},
          event_type = ${event.type},
          description = ${event.description},
          priority = ${event.priority}
      WHERE id = ${eventId}
      RETURNING id, title, school, event_date, event_time, event_type, description, priority`;
    return rows[0] ? mapRow(rows[0]) : null;
  });
}

export async function deleteEvent(env, id) {
  const eventId = Number(id);
  if (!Number.isInteger(eventId)) return false;
  return withDb(env, async (sql) => {
    const rows = await sql`DELETE FROM events WHERE id = ${eventId} RETURNING id`;
    return rows.length > 0;
  });
}

export async function migrateEvents(env, deletedIds, custom) {
  const ids = (Array.isArray(deletedIds) ? deletedIds : [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0 && id < 1000);
  const extras = [];
  for (const item of Array.isArray(custom) ? custom : []) {
    const date = typeof item?.date === "string" ? item.date.slice(0, 10) : "";
    const event = cleanEvent({ ...item, date });
    const id = Number(item?.id);
    if (!event || !Number.isInteger(id) || id < 1000) continue;
    extras.push({ ...event, id });
  }
  await withDb(env, async (sql) => {
    for (const id of ids) {
      await sql`DELETE FROM events WHERE id = ${id}`;
    }
    for (const event of extras) {
      await sql`INSERT INTO events (id, title, school, event_date, event_time, event_type, description, priority)
        VALUES (${event.id}, ${event.title}, ${event.school}, ${event.date}, ${event.time}, ${event.type}, ${event.description}, ${event.priority})
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          school = EXCLUDED.school,
          event_date = EXCLUDED.event_date,
          event_time = EXCLUDED.event_time,
          event_type = EXCLUDED.event_type,
          description = EXCLUDED.description,
          priority = EXCLUDED.priority`;
    }
  });
  return { deleted: ids.length, custom: extras.length };
}

export function isDatabaseConfigured(env) {
  return Boolean(env.DATABASE_URL);
}

const AI_TOOLS = new Set(["GPT", "CLAUDE", "CURSOR"]);
const FILE_CATEGORIES = ["DB", "JAVA", "JSP", "XML", "기타"];

export function cleanFiles(input) {
  const raw = Array.isArray(input) ? input : [];
  const files = [];
  for (const item of raw.slice(0, 200)) {
    if (!item || typeof item !== "object") continue;
    const category = FILE_CATEGORIES.includes(item.category) ? item.category : "";
    if (!category) continue;
    const filename = String(item.filename || "").trim().slice(0, 200);
    const changeNote = String(item.changeNote || "").trim().slice(0, 4000);
    if (!filename && !changeNote) continue;
    files.push({ category, filename, changeNote });
  }
  return files;
}

export function cleanTodo(input) {
  if (!input || typeof input !== "object") return null;
  const title = String(input.title || "").trim().slice(0, 200);
  if (!title) return null;
  const aiTool = String(input.aiTool || "").trim().toUpperCase();
  return {
    title,
    tag: String(input.tag || "").trim().slice(0, 40),
    requester: String(input.requester || "").trim().slice(0, 40),
    aiTool: AI_TOOLS.has(aiTool) ? aiTool : "",
    workContent: String(input.workContent || "").slice(0, 20000),
    files: cleanFiles(input.files),
  };
}

export function mapTodo(row) {
  let files = row.files;
  if (typeof files === "string") {
    try { files = JSON.parse(files); } catch { files = []; }
  }
  return {
    id: Number(row.id),
    title: row.title,
    tag: row.tag || "",
    requester: row.requester || "",
    aiTool: row.ai_tool || "",
    workContent: row.work_content || "",
    files: cleanFiles(files),
    done: row.done === true || row.done === "t" || row.done === "true",
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ""),
  };
}

export async function listTodos(env) {
  return withDb(env, async (sql) => {
    const rows = await sql`SELECT id, title, tag, requester, ai_tool, work_content, files, done, created_at FROM todos ORDER BY done ASC, id DESC`;
    return rows.map(mapTodo);
  });
}

export async function createTodo(env, input) {
  const todo = cleanTodo(input);
  if (!todo) return null;
  const id = Date.now();
  return withDb(env, async (sql) => {
    const files = JSON.stringify(todo.files);
    const rows = await sql`INSERT INTO todos (id, title, tag, requester, ai_tool, work_content, files)
      VALUES (${id}, ${todo.title}, ${todo.tag}, ${todo.requester}, ${todo.aiTool}, ${todo.workContent}, ${files}::jsonb)
      RETURNING id, title, tag, requester, ai_tool, work_content, files, done, created_at`;
    return mapTodo(rows[0]);
  });
}

export async function updateTodo(env, id, input) {
  const todoId = Number(id);
  if (!Number.isInteger(todoId) || !input || typeof input !== "object") return null;
  return withDb(env, async (sql) => {
    if (typeof input.done === "boolean" && input.title == null) {
      const rows = await sql`UPDATE todos SET done = ${input.done} WHERE id = ${todoId}
        RETURNING id, title, tag, requester, ai_tool, work_content, files, done, created_at`;
      return rows[0] ? mapTodo(rows[0]) : null;
    }
    const todo = cleanTodo(input);
    if (!todo) return null;
    const files = JSON.stringify(todo.files);
    const rows = await sql`UPDATE todos
      SET title = ${todo.title}, tag = ${todo.tag}, requester = ${todo.requester}, ai_tool = ${todo.aiTool},
          work_content = ${todo.workContent}, files = ${files}::jsonb
      WHERE id = ${todoId}
      RETURNING id, title, tag, requester, ai_tool, work_content, files, done, created_at`;
    return rows[0] ? mapTodo(rows[0]) : null;
  });
}

export async function deleteTodo(env, id) {
  const todoId = Number(id);
  if (!Number.isInteger(todoId)) return false;
  return withDb(env, async (sql) => {
    const rows = await sql`DELETE FROM todos WHERE id = ${todoId} RETURNING id`;
    return rows.length > 0;
  });
}
