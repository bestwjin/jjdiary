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
      await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT '보통'`;
      await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS progress_status TEXT NOT NULL DEFAULT '진행중'`;
      await sql`UPDATE todos SET progress_status = '완료' WHERE done = TRUE AND (progress_status IS NULL OR progress_status = '' OR progress_status = '진행중')`;
      await sql`CREATE TABLE IF NOT EXISTS schedules (
        id BIGINT PRIMARY KEY,
        title TEXT NOT NULL,
        schedule_date DATE NOT NULL,
        schedule_time TEXT NOT NULL DEFAULT '',
        memo TEXT NOT NULL DEFAULT ''
      )`;
      await sql`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT '보통'`;
      await sql`ALTER TABLE schedules ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS mail_messages (
        id BIGINT PRIMARY KEY,
        folder TEXT NOT NULL DEFAULT 'inbox',
        from_addr TEXT NOT NULL DEFAULT '',
        to_addr TEXT NOT NULL DEFAULT '',
        subject TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS external_id TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS account TEXT NOT NULL DEFAULT 'daum'`;
      await sql`ALTER TABLE mail_messages ADD COLUMN IF NOT EXISTS body_html TEXT NOT NULL DEFAULT ''`;
      await sql`CREATE INDEX IF NOT EXISTS mail_messages_folder_idx ON mail_messages (folder, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS mail_messages_account_idx ON mail_messages (account, folder, created_at DESC)`;
      await sql`DROP INDEX IF EXISTS mail_messages_external_uidx`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS mail_messages_account_external_uidx ON mail_messages (account, folder, external_id) WHERE external_id <> ''`;
      await sql`CREATE TABLE IF NOT EXISTS card_usages (
        id BIGINT PRIMARY KEY,
        used_date DATE NOT NULL,
        merchant TEXT NOT NULL DEFAULT '',
        amount NUMERIC(14,0) NOT NULL DEFAULT 0,
        purpose TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        settled BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS card_usages_date_idx ON card_usages (used_date DESC, id DESC)`;
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
const TODO_PRIORITIES = new Set(["높음", "보통", "낮음"]);
const TODO_STATUSES = new Set(["진행중", "모니터링중", "완료"]);

function normalizeTodoStatus(value, done) {
  if (TODO_STATUSES.has(value)) return value;
  return done ? "완료" : "진행중";
}

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
  const progressStatus = normalizeTodoStatus(input.progressStatus, false);
  return {
    title,
    tag: String(input.tag || "").trim().slice(0, 40),
    requester: String(input.requester || "").trim().slice(0, 40),
    aiTool: AI_TOOLS.has(aiTool) ? aiTool : "",
    priority: TODO_PRIORITIES.has(input.priority) ? input.priority : "보통",
    progressStatus,
    done: progressStatus === "완료",
    workContent: String(input.workContent || "").slice(0, 20000),
    files: cleanFiles(input.files),
  };
}

export function mapTodo(row) {
  let files = row.files;
  if (typeof files === "string") {
    try { files = JSON.parse(files); } catch { files = []; }
  }
  const done = row.done === true || row.done === "t" || row.done === "true";
  return {
    id: Number(row.id),
    title: row.title,
    tag: row.tag || "",
    requester: row.requester || "",
    aiTool: row.ai_tool || "",
    priority: TODO_PRIORITIES.has(row.priority) ? row.priority : "보통",
    progressStatus: normalizeTodoStatus(row.progress_status, done),
    workContent: row.work_content || "",
    files: cleanFiles(files),
    done,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ""),
  };
}

export async function listTodos(env) {
  return withDb(env, async (sql) => {
    const rows = await sql`SELECT id, title, tag, requester, ai_tool, work_content, files, priority, progress_status, done, created_at FROM todos
      ORDER BY done ASC, CASE priority WHEN '높음' THEN 0 WHEN '낮음' THEN 2 ELSE 1 END, id DESC`;
    return rows.map(mapTodo);
  });
}

export async function createTodo(env, input) {
  const todo = cleanTodo(input);
  if (!todo) return null;
  const id = Date.now();
  return withDb(env, async (sql) => {
    const files = JSON.stringify(todo.files);
    const rows = await sql`INSERT INTO todos (id, title, tag, requester, ai_tool, work_content, files, priority, progress_status, done)
      VALUES (${id}, ${todo.title}, ${todo.tag}, ${todo.requester}, ${todo.aiTool}, ${todo.workContent}, ${files}::jsonb, ${todo.priority}, ${todo.progressStatus}, ${todo.done})
      RETURNING id, title, tag, requester, ai_tool, work_content, files, priority, progress_status, done, created_at`;
    return mapTodo(rows[0]);
  });
}

export async function updateTodo(env, id, input) {
  const todoId = Number(id);
  if (!Number.isInteger(todoId) || !input || typeof input !== "object") return null;
  return withDb(env, async (sql) => {
    if (typeof input.done === "boolean" && input.title == null) {
      const progressStatus = input.done ? "완료" : "진행중";
      const rows = await sql`UPDATE todos SET done = ${input.done}, progress_status = ${progressStatus} WHERE id = ${todoId}
        RETURNING id, title, tag, requester, ai_tool, work_content, files, priority, progress_status, done, created_at`;
      return rows[0] ? mapTodo(rows[0]) : null;
    }
    const todo = cleanTodo(input);
    if (!todo) return null;
    const existing = await sql`SELECT created_at FROM todos WHERE id = ${todoId} LIMIT 1`;
    if (!existing[0]) return null;
    const createdAt = cleanCreatedAt(input, existing[0].created_at instanceof Date
      ? existing[0].created_at.toISOString()
      : String(existing[0].created_at || ""));
    const files = JSON.stringify(todo.files);
    if (createdAt) {
      const rows = await sql`UPDATE todos
        SET title = ${todo.title}, tag = ${todo.tag}, requester = ${todo.requester}, ai_tool = ${todo.aiTool},
            work_content = ${todo.workContent}, files = ${files}::jsonb, priority = ${todo.priority},
            progress_status = ${todo.progressStatus}, done = ${todo.done},
            created_at = ${createdAt}
        WHERE id = ${todoId}
        RETURNING id, title, tag, requester, ai_tool, work_content, files, priority, progress_status, done, created_at`;
      return rows[0] ? mapTodo(rows[0]) : null;
    }
    const rows = await sql`UPDATE todos
      SET title = ${todo.title}, tag = ${todo.tag}, requester = ${todo.requester}, ai_tool = ${todo.aiTool},
          work_content = ${todo.workContent}, files = ${files}::jsonb, priority = ${todo.priority},
          progress_status = ${todo.progressStatus}, done = ${todo.done}
      WHERE id = ${todoId}
      RETURNING id, title, tag, requester, ai_tool, work_content, files, priority, progress_status, done, created_at`;
    return rows[0] ? mapTodo(rows[0]) : null;
  });
}

export function cleanCreatedAt(input, existingIso) {
  if (!input || typeof input !== "object") return null;
  if (!Object.prototype.hasOwnProperty.call(input, "createdAt")) return null;
  const date = String(input.createdAt || "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const base = new Date(existingIso || Date.now());
  if (Number.isNaN(base.getTime())) return `${date}T00:00:00.000Z`;
  const hh = String(base.getUTCHours()).padStart(2, "0");
  const mm = String(base.getUTCMinutes()).padStart(2, "0");
  const ss = String(base.getUTCSeconds()).padStart(2, "0");
  const ms = String(base.getUTCMilliseconds()).padStart(3, "0");
  return `${date}T${hh}:${mm}:${ss}.${ms}Z`;
}

function dateText(value) {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value || "").slice(0, 10);
}

export function cleanSchedule(input) {
  if (!input || typeof input !== "object") return null;
  const date = typeof input.date === "string" ? input.date.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const title = String(input.title || "").trim().slice(0, 200);
  if (!title) return null;
  const allDay = input.allDay === true || input.allDay === "true" || input.allDay === 1;
  const time = allDay ? "" : String(input.time || "").trim().slice(0, 5);
  if (time && !/^\d{2}:\d{2}$/.test(time)) return null;
  return {
    title,
    date,
    time,
    allDay,
    priority: TODO_PRIORITIES.has(input.priority) ? input.priority : "보통",
    memo: String(input.memo || "").trim().slice(0, 1000),
  };
}

export function mapSchedule(row) {
  const allDay = row.all_day === true || row.all_day === "t" || row.all_day === "true" || row.all_day === 1;
  return {
    id: Number(row.id),
    title: row.title,
    date: dateText(row.schedule_date),
    time: allDay ? "" : (row.schedule_time || ""),
    allDay,
    priority: TODO_PRIORITIES.has(row.priority) ? row.priority : "보통",
    memo: row.memo || "",
  };
}

export async function listSchedules(env) {
  return withDb(env, async (sql) => {
    const rows = await sql`SELECT id, title, schedule_date, schedule_time, memo, priority, all_day FROM schedules
      ORDER BY schedule_date,
        CASE WHEN all_day THEN 0 ELSE 1 END,
        schedule_time,
        CASE priority WHEN '높음' THEN 0 WHEN '낮음' THEN 2 ELSE 1 END,
        id`;
    return rows.map(mapSchedule);
  });
}

export async function createSchedule(env, input) {
  const schedule = cleanSchedule(input);
  if (!schedule) return null;
  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  return withDb(env, async (sql) => {
    const rows = await sql`INSERT INTO schedules (id, title, schedule_date, schedule_time, memo, priority, all_day)
      VALUES (${id}, ${schedule.title}, ${schedule.date}, ${schedule.time}, ${schedule.memo}, ${schedule.priority}, ${schedule.allDay})
      RETURNING id, title, schedule_date, schedule_time, memo, priority, all_day`;
    return mapSchedule(rows[0]);
  });
}

export async function updateSchedule(env, id, input) {
  const schedule = cleanSchedule(input);
  const scheduleId = Number(id);
  if (!schedule || !Number.isInteger(scheduleId)) return null;
  return withDb(env, async (sql) => {
    const rows = await sql`UPDATE schedules
      SET title = ${schedule.title},
          schedule_date = ${schedule.date},
          schedule_time = ${schedule.time},
          memo = ${schedule.memo},
          priority = ${schedule.priority},
          all_day = ${schedule.allDay}
      WHERE id = ${scheduleId}
      RETURNING id, title, schedule_date, schedule_time, memo, priority, all_day`;
    return rows[0] ? mapSchedule(rows[0]) : null;
  });
}

export async function deleteSchedule(env, id) {
  const scheduleId = Number(id);
  if (!Number.isInteger(scheduleId)) return false;
  return withDb(env, async (sql) => {
    const rows = await sql`DELETE FROM schedules WHERE id = ${scheduleId} RETURNING id`;
    return rows.length > 0;
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

const KASI_SETTING_KEY = "kasi_service_key";
const TELEGRAM_TOKEN_KEY = "telegram_token";
const TELEGRAM_USERNAME_KEY = "telegram_username";
const TELEGRAM_NOTIFY_TIME_KEY = "telegram_notify_time";
const DEFAULT_NOTIFY_TIME = "10:00";
const MAIL_ACCOUNTS_KEY = "mail_accounts";
const MAIL_SETTING_KEYS = {
  address: "mail_address",
  displayName: "mail_display_name",
  imapHost: "mail_imap_host",
  imapPort: "mail_imap_port",
  imapUser: "mail_imap_user",
  imapPassword: "mail_imap_password",
  imapSecure: "mail_imap_secure",
  smtpHost: "mail_smtp_host",
  smtpPort: "mail_smtp_port",
  smtpUser: "mail_smtp_user",
  smtpPassword: "mail_smtp_password",
  smtpSecure: "mail_smtp_secure",
};
const MAIL_FOLDERS = new Set(["inbox", "sent", "drafts", "trash"]);
export const MAIL_PROVIDERS = {
  daum: {
    id: "daum",
    label: "다음",
    imapHost: "imap.daum.net",
    imapPort: "993",
    smtpHost: "smtp.daum.net",
    smtpPort: "465",
    imapSecure: true,
    smtpSecure: true,
  },
  works: {
    id: "works",
    label: "다음 웍스",
    imapHost: "imap.daum.net",
    imapPort: "993",
    smtpHost: "smtp.daum.net",
    smtpPort: "465",
    imapSecure: true,
    smtpSecure: true,
  },
  naver: {
    id: "naver",
    label: "네이버",
    imapHost: "imap.naver.com",
    imapPort: "993",
    smtpHost: "smtp.naver.com",
    smtpPort: "587",
    imapSecure: true,
    smtpSecure: true,
  },
  gmail: {
    id: "gmail",
    label: "Gmail",
    imapHost: "imap.gmail.com",
    imapPort: "993",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    imapSecure: true,
    smtpSecure: true,
  },
};

export async function getSetting(env, key) {
  return withDb(env, async (sql) => {
    const rows = await sql`SELECT value FROM app_settings WHERE key = ${key} LIMIT 1`;
    return rows[0] ? String(rows[0].value || "") : "";
  });
}

export async function setSetting(env, key, value) {
  const text = String(value ?? "");
  return withDb(env, async (sql) => {
    await sql`INSERT INTO app_settings (key, value, updated_at)
      VALUES (${key}, ${text}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
    return true;
  });
}

async function settingOrEnv(env, key, envKey) {
  try {
    const fromDb = (await getSetting(env, key)).trim();
    if (fromDb) return fromDb;
  } catch {
    // fall through
  }
  return String(env[envKey] || "").trim();
}

function normalizeNotifyTime(value) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return DEFAULT_NOTIFY_TIME;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return DEFAULT_NOTIFY_TIME;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export async function getKasiServiceKey(env) {
  return settingOrEnv(env, KASI_SETTING_KEY, "KASI_SERVICE_KEY");
}

export async function getTelegramConfig(env) {
  const token = await settingOrEnv(env, TELEGRAM_TOKEN_KEY, "TELEGRAM_BOT_TOKEN");
  let username = await settingOrEnv(env, TELEGRAM_USERNAME_KEY, "TELEGRAM_CHAT_ID");
  if (username && !username.startsWith("@") && !/^-?\d+$/.test(username)) {
    username = `@${username}`;
  }
  let notifyTime = DEFAULT_NOTIFY_TIME;
  try {
    notifyTime = normalizeNotifyTime(await getSetting(env, TELEGRAM_NOTIFY_TIME_KEY));
  } catch {
    notifyTime = normalizeNotifyTime(env.TELEGRAM_NOTIFY_TIME || DEFAULT_NOTIFY_TIME);
  }
  return { token, username, notifyTime };
}

function emptyMailAccount(providerId) {
  const preset = MAIL_PROVIDERS[providerId] || MAIL_PROVIDERS.daum;
  return {
    id: preset.id,
    label: preset.label,
    enabled: false,
    address: "",
    displayName: "",
    imapHost: preset.imapHost,
    imapPort: preset.imapPort,
    imapUser: "",
    imapPassword: "",
    imapSecure: preset.imapSecure,
    smtpHost: preset.smtpHost,
    smtpPort: preset.smtpPort,
    smtpUser: "",
    smtpPassword: "",
    smtpSecure: preset.smtpSecure,
  };
}

function normalizeMailAccount(providerId, input) {
  const base = emptyMailAccount(providerId);
  const raw = input && typeof input === "object" ? input : {};
  const address = String(raw.address ?? "").trim().slice(0, 200);
  const imapUser = String(raw.imapUser ?? address).trim().slice(0, 200);
  const smtpUser = String(raw.smtpUser ?? address).trim().slice(0, 200);
  const imapPassword = String(raw.imapPassword ?? "").slice(0, 500);
  const smtpPassword = String(raw.smtpPassword ?? imapPassword).slice(0, 500);
  return {
    ...base,
    enabled: raw.enabled === true || raw.enabled === "1" || raw.enabled === "true" || Boolean(address && imapPassword),
    address,
    displayName: String(raw.displayName ?? "").trim().slice(0, 100),
    imapUser: imapUser || address,
    imapPassword,
    smtpUser: smtpUser || address,
    smtpPassword,
  };
}

function mailConfigured(mail) {
  return Boolean(mail && mail.address && mail.imapHost && mail.imapPassword);
}

async function readLegacyMailSettings(env) {
  const entries = await Promise.all(
    Object.entries(MAIL_SETTING_KEYS).map(async ([field, key]) => [field, await getSetting(env, key)])
  );
  const raw = Object.fromEntries(entries);
  if (!String(raw.address || "").trim() && !String(raw.imapPassword || "").trim()) return null;
  return normalizeMailAccount("daum", {
    enabled: true,
    address: raw.address,
    displayName: raw.displayName,
    imapUser: raw.imapUser,
    imapPassword: raw.imapPassword,
    smtpUser: raw.smtpUser,
    smtpPassword: raw.smtpPassword || raw.imapPassword,
  });
}

export async function getMailAccounts(env) {
  let parsed = null;
  try {
    const raw = await getSetting(env, MAIL_ACCOUNTS_KEY);
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const accounts = {
    daum: emptyMailAccount("daum"),
    works: emptyMailAccount("works"),
    naver: emptyMailAccount("naver"),
    gmail: emptyMailAccount("gmail"),
  };
  if (parsed && typeof parsed === "object") {
    for (const id of Object.keys(accounts)) {
      if (parsed[id]) accounts[id] = normalizeMailAccount(id, parsed[id]);
    }
  } else {
    const legacy = await readLegacyMailSettings(env);
    if (legacy) accounts.daum = legacy;
  }
  return accounts;
}

export async function getMailSettings(env, accountId) {
  const accounts = await getMailAccounts(env);
  if (accountId && accounts[accountId]) return accounts[accountId];
  return accounts.daum.address ? accounts.daum
    : accounts.works.address ? accounts.works
      : accounts.naver.address ? accounts.naver
        : accounts.gmail.address ? accounts.gmail
          : accounts.daum;
}

export function mapMail(row) {
  return {
    id: Number(row.id),
    account: MAIL_PROVIDERS[row.account] ? row.account : "daum",
    folder: MAIL_FOLDERS.has(row.folder) ? row.folder : "inbox",
    fromAddr: row.from_addr || "",
    toAddr: row.to_addr || "",
    subject: row.subject || "",
    body: row.body || "",
    bodyHtml: row.body_html || "",
    externalId: row.external_id || "",
    isRead: row.is_read === true || row.is_read === "t" || row.is_read === "true",
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at || ""),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || ""),
  };
}

export async function listMail(env, folder, accountId) {
  return withDb(env, async (sql) => {
    const account = accountId && MAIL_PROVIDERS[accountId] ? accountId : "";
    let rows;
    if (account && folder && MAIL_FOLDERS.has(folder)) {
      rows = await sql`SELECT id, account, folder, from_addr, to_addr, subject, body, body_html, external_id, is_read, created_at, updated_at
        FROM mail_messages WHERE account = ${account} AND folder = ${folder} ORDER BY created_at DESC, id DESC`;
    } else if (account) {
      rows = await sql`SELECT id, account, folder, from_addr, to_addr, subject, body, body_html, external_id, is_read, created_at, updated_at
        FROM mail_messages WHERE account = ${account} ORDER BY created_at DESC, id DESC`;
    } else if (folder && MAIL_FOLDERS.has(folder)) {
      rows = await sql`SELECT id, account, folder, from_addr, to_addr, subject, body, body_html, external_id, is_read, created_at, updated_at
        FROM mail_messages WHERE folder = ${folder} ORDER BY created_at DESC, id DESC`;
    } else {
      rows = await sql`SELECT id, account, folder, from_addr, to_addr, subject, body, body_html, external_id, is_read, created_at, updated_at
        FROM mail_messages ORDER BY created_at DESC, id DESC`;
    }

    const countsRows = account
      ? await sql`SELECT folder, COUNT(*)::int AS n FROM mail_messages WHERE account = ${account} GROUP BY folder`
      : await sql`SELECT folder, COUNT(*)::int AS n FROM mail_messages GROUP BY folder`;
    const counts = { inbox: 0, sent: 0, drafts: 0, trash: 0 };
    countsRows.forEach((row) => {
      if (MAIL_FOLDERS.has(row.folder)) counts[row.folder] = Number(row.n) || 0;
    });

    const accounts = await getMailAccounts(env);
    const accountList = Object.values(accounts).map((item) => ({
      id: item.id,
      label: item.label,
      address: item.address,
      displayName: item.displayName,
      configured: mailConfigured(item),
      enabled: Boolean(item.enabled && mailConfigured(item)),
    }));
    const current = account ? accounts[account] : null;
    return {
      messages: rows.map(mapMail),
      counts,
      accounts: accountList,
      account: current
        ? {
            id: current.id,
            label: current.label,
            address: current.address,
            displayName: current.displayName,
            configured: mailConfigured(current),
          }
        : {
            id: "all",
            label: "전체",
            address: accountList.filter((a) => a.enabled).map((a) => a.address).join(", "),
            displayName: "",
            configured: accountList.some((a) => a.enabled),
          },
    };
  });
}

function cleanMailInput(input, mailSettings) {
  if (!input || typeof input !== "object") return null;
  const folder = MAIL_FOLDERS.has(input.folder) ? input.folder : "drafts";
  const account = MAIL_PROVIDERS[input.account] ? input.account : (mailSettings.id || "daum");
  const toAddr = String(input.toAddr || "").trim().slice(0, 500);
  const subject = String(input.subject || "").trim().slice(0, 200);
  const body = String(input.body || "").slice(0, 50000);
  const fromAddr = String(
    input.fromAddr ||
      (mailSettings.displayName && mailSettings.address
        ? `${mailSettings.displayName} <${mailSettings.address}>`
        : mailSettings.address || "")
  ).trim().slice(0, 500);
  return { folder, account, toAddr, subject, body, fromAddr, send: input.send === true };
}

export async function createMail(env, input) {
  const accountId = MAIL_PROVIDERS[input?.account] ? input.account : "";
  const mailSettings = await getMailSettings(env, accountId || undefined);
  const mail = cleanMailInput({ ...input, account: accountId || mailSettings.id }, mailSettings);
  if (!mail) return null;
  if (mail.send) {
    if (!mailConfigured(mailSettings) || !mailSettings.smtpHost || !mailSettings.address) {
      const err = new Error("settings");
      err.code = "settings";
      throw err;
    }
    if (!mail.toAddr) return null;
    mail.folder = "sent";
  }
  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  return withDb(env, async (sql) => {
    const rows = await sql`INSERT INTO mail_messages
      (id, account, folder, from_addr, to_addr, subject, body, is_read, created_at, updated_at)
      VALUES (${id}, ${mail.account}, ${mail.folder}, ${mail.fromAddr}, ${mail.toAddr}, ${mail.subject}, ${mail.body}, ${mail.folder !== "inbox"}, NOW(), NOW())
      RETURNING id, account, folder, from_addr, to_addr, subject, body, body_html, external_id, is_read, created_at, updated_at`;
    return mapMail(rows[0]);
  });
}

export async function updateMail(env, id, input) {
  const mailId = Number(id);
  if (!Number.isInteger(mailId) || !input || typeof input !== "object") return null;
  return withDb(env, async (sql) => {
    const existing = await sql`SELECT id, account, folder, from_addr, to_addr, subject, body, body_html, external_id, is_read, created_at, updated_at
      FROM mail_messages WHERE id = ${mailId} LIMIT 1`;
    if (!existing[0]) return null;
    const current = mapMail(existing[0]);
    const mailSettings = await getMailSettings(env, current.account);
    let folder = Object.prototype.hasOwnProperty.call(input, "folder")
      ? (MAIL_FOLDERS.has(input.folder) ? input.folder : current.folder)
      : current.folder;
    let toAddr = Object.prototype.hasOwnProperty.call(input, "toAddr")
      ? String(input.toAddr || "").trim().slice(0, 500)
      : current.toAddr;
    let subject = Object.prototype.hasOwnProperty.call(input, "subject")
      ? String(input.subject || "").trim().slice(0, 200)
      : current.subject;
    let body = Object.prototype.hasOwnProperty.call(input, "body")
      ? String(input.body || "").slice(0, 50000)
      : current.body;
    let isRead = Object.prototype.hasOwnProperty.call(input, "isRead")
      ? Boolean(input.isRead)
      : current.isRead;
    let fromAddr = current.fromAddr;
    const account = current.account;

    if (input.send === true) {
      if (!mailConfigured(mailSettings) || !mailSettings.address) {
        const err = new Error("settings");
        err.code = "settings";
        throw err;
      }
      if (!toAddr) return null;
      folder = "sent";
      fromAddr = mailSettings.displayName
        ? `${mailSettings.displayName} <${mailSettings.address}>`
        : mailSettings.address;
      isRead = true;
    } else if (Object.prototype.hasOwnProperty.call(input, "folder") && input.folder === "drafts") {
      folder = "drafts";
    }

    const rows = await sql`UPDATE mail_messages SET
      account = ${account},
      folder = ${folder},
      from_addr = ${fromAddr},
      to_addr = ${toAddr},
      subject = ${subject},
      body = ${body},
      is_read = ${isRead},
      updated_at = NOW()
      WHERE id = ${mailId}
      RETURNING id, account, folder, from_addr, to_addr, subject, body, body_html, external_id, is_read, created_at, updated_at`;
    return mapMail(rows[0]);
  });
}

export async function deleteMail(env, id) {
  const mailId = Number(id);
  if (!Number.isInteger(mailId)) return false;
  return withDb(env, async (sql) => {
    const rows = await sql`DELETE FROM mail_messages WHERE id = ${mailId} RETURNING id`;
    return rows.length > 0;
  });
}

export async function syncMail(env, accountId) {
  const accounts = await getMailAccounts(env);
  const targets = accountId && MAIL_PROVIDERS[accountId]
    ? [accounts[accountId]].filter((item) => item && mailConfigured(item))
    : Object.values(accounts).filter((item) => item.enabled && mailConfigured(item));

  if (!targets.length) {
    const err = new Error("settings");
    err.code = "settings";
    throw err;
  }

  const { fetchInboxMessages } = await import("./mail-imap.js");
  let imported = 0;
  let fetchedTotal = 0;
  const errors = [];

  for (const mail of targets) {
    let fetched = [];
    try {
      fetched = await fetchInboxMessages(mail, 8);
    } catch (error) {
      errors.push(`${mail.label}: ${error && error.message ? error.message : "동기화 실패"}`);
      continue;
    }
    fetchedTotal += fetched.length;
    await withDb(env, async (sql) => {
      for (const item of fetched) {
        const externalId = `imap:${mail.id}:${item.uid}`;
        const exists = await sql`SELECT id, is_read FROM mail_messages
          WHERE account = ${mail.id} AND folder = 'inbox' AND external_id = ${externalId} LIMIT 1`;
        if (exists[0]) {
          const localRead = exists[0].is_read === true || exists[0].is_read === "t" || exists[0].is_read === "true";
          const isRead = localRead || Boolean(item.isRead);
          await sql`UPDATE mail_messages SET
            from_addr = ${item.fromAddr},
            to_addr = ${item.toAddr},
            subject = ${item.subject},
            body = ${item.body},
            body_html = ${item.bodyHtml || ""},
            is_read = ${isRead},
            updated_at = NOW()
            WHERE id = ${exists[0].id}`;
          continue;
        }
        const id = Date.now() * 1000 + Math.floor(Math.random() * 1000) + imported;
        await sql`INSERT INTO mail_messages
          (id, account, folder, from_addr, to_addr, subject, body, body_html, external_id, is_read, created_at, updated_at)
          VALUES (${id}, ${mail.id}, 'inbox', ${item.fromAddr}, ${item.toAddr}, ${item.subject}, ${item.body}, ${item.bodyHtml || ""}, ${externalId}, ${item.isRead}, NOW(), NOW())`;
        imported += 1;
      }
    });
  }

  if (!fetchedTotal && errors.length) {
    const err = new Error(errors.join(" / "));
    err.code = "imap";
    throw err;
  }

  const listed = await listMail(env, "inbox", accountId || "");
  return {
    ok: true,
    message: imported > 0
      ? `${targets.map((t) => t.label).join(", ")}에서 메일 ${imported}통을 받아왔습니다.`
      : `메일함을 동기화했습니다. (${fetchedTotal}통 확인${errors.length ? `, 일부 실패: ${errors.join(" / ")}` : ""})`,
    imported,
    fetched: fetchedTotal,
    errors,
    counts: listed.counts,
    accounts: listed.accounts,
    account: listed.account,
  };
}

export async function getAppSettings(env) {
  const [kasiServiceKey, telegram, mailAccounts] = await Promise.all([
    getKasiServiceKey(env),
    getTelegramConfig(env),
    getMailAccounts(env),
  ]);
  return {
    kasiServiceKey,
    telegramToken: telegram.token,
    telegramUsername: telegram.username.replace(/^@/, ""),
    telegramNotifyTime: telegram.notifyTime,
    mailAccounts,
    mail: mailAccounts.daum,
  };
}

export async function updateAppSettings(env, input) {
  if (!input || typeof input !== "object") return null;
  const hasKasi = Object.prototype.hasOwnProperty.call(input, "kasiServiceKey");
  const hasToken = Object.prototype.hasOwnProperty.call(input, "telegramToken");
  const hasUsername = Object.prototype.hasOwnProperty.call(input, "telegramUsername");
  const hasNotifyTime = Object.prototype.hasOwnProperty.call(input, "telegramNotifyTime");
  const hasMail = Object.prototype.hasOwnProperty.call(input, "mail");
  const hasMailAccounts = Object.prototype.hasOwnProperty.call(input, "mailAccounts");
  if (!hasKasi && !hasToken && !hasUsername && !hasNotifyTime && !hasMail && !hasMailAccounts) return null;

  if (hasKasi) {
    await setSetting(env, KASI_SETTING_KEY, String(input.kasiServiceKey ?? "").trim().slice(0, 500));
  }
  if (hasToken) {
    await setSetting(env, TELEGRAM_TOKEN_KEY, String(input.telegramToken ?? "").trim().slice(0, 200));
  }
  if (hasUsername) {
    await setSetting(env, TELEGRAM_USERNAME_KEY, String(input.telegramUsername ?? "").trim().replace(/^@/, "").slice(0, 100));
  }
  if (hasNotifyTime) {
    await setSetting(env, TELEGRAM_NOTIFY_TIME_KEY, normalizeNotifyTime(input.telegramNotifyTime));
  }

  if (hasMailAccounts || hasMail) {
    const current = await getMailAccounts(env);
    const next = { ...current };
    if (hasMailAccounts && input.mailAccounts && typeof input.mailAccounts === "object") {
      for (const id of Object.keys(MAIL_PROVIDERS)) {
        if (input.mailAccounts[id]) next[id] = normalizeMailAccount(id, input.mailAccounts[id]);
      }
    }
    if (hasMail && input.mail && typeof input.mail === "object") {
      const providerId = MAIL_PROVIDERS[input.mail.id] ? input.mail.id : "daum";
      next[providerId] = normalizeMailAccount(providerId, input.mail);
    }
    await setSetting(env, MAIL_ACCOUNTS_KEY, JSON.stringify(next));
  }
  return getAppSettings(env);
}


export function cleanCardUsage(input) {
  if (!input || typeof input !== "object") return null;
  const usedDate = typeof input.usedDate === "string" ? input.usedDate.slice(0, 10)
    : typeof input.date === "string" ? input.date.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(usedDate)) return null;
  const merchant = String(input.merchant || input.store || "").trim().slice(0, 120);
  if (!merchant) return null;
  const amountRaw = String(input.amount ?? "").replace(/[^0-9.-]/g, "");
  const amount = Math.round(Number(amountRaw));
  if (!Number.isFinite(amount)) return null;
  return {
    usedDate,
    merchant,
    amount,
    purpose: String(input.purpose || input.title || "").trim().slice(0, 300),
    category: String(input.category || "").trim().slice(0, 40),
    note: String(input.note || input.memo || "").trim().slice(0, 500),
    settled: input.settled === true || input.settled === "true" || input.settled === 1 || input.settled === "Y" || input.settled === "y" || input.settled === "정산",
  };
}

export function mapCardUsage(row) {
  return {
    id: Number(row.id),
    usedDate: dateText(row.used_date),
    merchant: row.merchant || "",
    amount: Number(row.amount) || 0,
    purpose: row.purpose || "",
    category: row.category || "",
    note: row.note || "",
    settled: row.settled === true || row.settled === "t" || row.settled === "true" || row.settled === 1,
  };
}

export async function listCardUsages(env) {
  return withDb(env, async (sql) => {
    const rows = await sql`SELECT id, used_date, merchant, amount, purpose, category, note, settled, created_at
      FROM card_usages
      ORDER BY used_date DESC, id DESC`;
    return rows.map(mapCardUsage);
  });
}

export async function createCardUsage(env, input) {
  const item = cleanCardUsage(input);
  if (!item) return null;
  const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  return withDb(env, async (sql) => {
    const rows = await sql`INSERT INTO card_usages (id, used_date, merchant, amount, purpose, category, note, settled)
      VALUES (${id}, ${item.usedDate}, ${item.merchant}, ${item.amount}, ${item.purpose}, ${item.category}, ${item.note}, ${item.settled})
      RETURNING id, used_date, merchant, amount, purpose, category, note, settled, created_at`;
    return mapCardUsage(rows[0]);
  });
}

export async function updateCardUsage(env, id, input) {
  const item = cleanCardUsage(input);
  const cardId = Number(id);
  if (!item || !Number.isInteger(cardId)) return null;
  return withDb(env, async (sql) => {
    const rows = await sql`UPDATE card_usages
      SET used_date = ${item.usedDate},
          merchant = ${item.merchant},
          amount = ${item.amount},
          purpose = ${item.purpose},
          category = ${item.category},
          note = ${item.note},
          settled = ${item.settled}
      WHERE id = ${cardId}
      RETURNING id, used_date, merchant, amount, purpose, category, note, settled, created_at`;
    return rows[0] ? mapCardUsage(rows[0]) : null;
  });
}

export async function deleteCardUsage(env, id) {
  const cardId = Number(id);
  if (!Number.isInteger(cardId)) return false;
  return withDb(env, async (sql) => {
    const rows = await sql`DELETE FROM card_usages WHERE id = ${cardId} RETURNING id`;
    return rows.length > 0;
  });
}

export async function importCardUsages(env, items, options = {}) {
  const replace = options.replace === true;
  const cleaned = [];
  for (const raw of Array.isArray(items) ? items : []) {
    const item = cleanCardUsage(raw);
    if (item) cleaned.push(item);
  }
  return withDb(env, async (sql) => {
    if (replace) await sql`DELETE FROM card_usages`;
    const created = [];
    let base = Date.now() * 1000;
    for (const item of cleaned) {
      const id = base++;
      const rows = await sql`INSERT INTO card_usages (id, used_date, merchant, amount, purpose, category, note, settled)
        VALUES (${id}, ${item.usedDate}, ${item.merchant}, ${item.amount}, ${item.purpose}, ${item.category}, ${item.note}, ${item.settled})
        RETURNING id, used_date, merchant, amount, purpose, category, note, settled, created_at`;
      created.push(mapCardUsage(rows[0]));
    }
    return { count: created.length, items: created };
  });
}
