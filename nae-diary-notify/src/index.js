import builtinEvents from "./builtin-events.json" with { type: "json" };
import { createCardUsage, createEvent, createMail, createSchedule, createTodo, deleteCardUsage, deleteEvent, deleteMail, deleteSchedule, deleteTodo, getAppSettings, getTelegramConfig, importCardUsages, isDatabaseConfigured, listCardUsages, listEvents, listMail, listSchedules, listTodos, migrateEvents, syncMail, updateAppSettings, updateCardUsage, updateEvent, updateMail, updateSchedule, updateTodo } from "./db.js";
import { getHolidays } from "./holidays.js";
import { addDays, buildReminderMessage, eventsOn, isNotifyWindow, kstToday, normalizeEvents, schedulesOn } from "./logic.js";

const EVENTS_KEY = "events";

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed =
    origin === "https://nae-diary.pages.dev" ||
    origin.endsWith(".nae-diary.pages.dev") ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://nae-diary.pages.dev",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Diary-Sync",
    Vary: "Origin",
  };
}

function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders(request) },
  });
}

async function loadEvents(env) {
  if (isDatabaseConfigured(env)) {
    try {
      return await listEvents(env);
    } catch (error) {
      console.error(error);
    }
  }
  const saved = await env.DIARY.get(EVENTS_KEY, "json");
  if (Array.isArray(saved) && saved.length) return saved;
  return builtinEvents;
}

async function loadSchedules(env) {
  if (!isDatabaseConfigured(env)) return [];
  try {
    return await listSchedules(env);
  } catch (error) {
    console.error(error);
    return [];
  }
}

function authorized(request, env) {
  return request.headers.get("X-Diary-Sync") === env.SYNC_TOKEN;
}

function dbError(error, request) {
  if (error?.code === "database_not_configured") return json({ ok: false, reason: "database_not_configured" }, 503, request);
  console.error(error);
  return json({ ok: false }, 500, request);
}

async function reminderFor(env, today) {
  const tomorrow = addDays(today, 1);
  const [events, allSchedules] = await Promise.all([
    loadEvents(env),
    loadSchedules(env),
  ]);
  const dueEvents = eventsOn(events, tomorrow);
  const dueSchedules = schedulesOn(allSchedules, tomorrow);
  const telegram = await getTelegramConfig(env);
  return {
    today,
    tomorrow,
    count: dueEvents.length + dueSchedules.length,
    eventCount: dueEvents.length,
    scheduleCount: dueSchedules.length,
    events: dueEvents,
    schedules: dueSchedules,
    message: buildReminderMessage(tomorrow, dueEvents, dueSchedules),
    telegramConfigured: Boolean(telegram.token && telegram.username),
    notifyTime: telegram.notifyTime,
  };
}

async function sendTelegram(env, text) {
  const telegram = await getTelegramConfig(env);
  if (!telegram.token || !telegram.username) return { ok: false, status: 0, error: "missing_credentials" };
  const response = await fetch(`https://api.telegram.org/bot${telegram.token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegram.username,
      text,
      disable_web_page_preview: true,
    }),
  });
  const body = await response.json().catch(() => ({}));
  return {
    ok: response.ok && body.ok === true,
    status: response.status,
    error: body.description || body.error_code || "",
  };
}

export async function runReminder(env, today = kstToday(), options = {}) {
  const force = options.force === true;
  const reminder = await reminderFor(env, today);
  const sentKey = `sent:${today}`;

  if (!force && !isNotifyWindow(new Date(), reminder.notifyTime || "10:00")) {
    return { ...reminder, sent: false, reason: "not_due" };
  }
  if (!reminder.message) {
    await env.DIARY.put("lastRun", JSON.stringify({ ...reminder, sent: false, at: new Date().toISOString() }));
    return { ...reminder, sent: false, reason: "no_events" };
  }
  if (await env.DIARY.get(sentKey)) {
    return { ...reminder, sent: false, reason: "already_sent" };
  }
  if (!reminder.telegramConfigured) {
    await env.DIARY.put("lastRun", JSON.stringify({ ...reminder, sent: false, reason: "telegram_not_configured", at: new Date().toISOString() }));
    return { ...reminder, sent: false, reason: "telegram_not_configured" };
  }
  const result = await sendTelegram(env, reminder.message);
  if (result.ok) await env.DIARY.put(sentKey, new Date().toISOString());
  await env.DIARY.put("lastRun", JSON.stringify({ ...reminder, sent: result.ok, telegramError: result.error || "", at: new Date().toISOString() }));
  return { ...reminder, sent: result.ok, reason: result.ok ? "sent" : "telegram_failed", telegramError: result.error || "" };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });

    if (url.pathname === "/events" && request.method === "GET") {
      try {
        const events = await listEvents(env);
        return json({ ok: true, events }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    if (url.pathname === "/events" && request.method === "POST") {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false }, 400, request);
      }
      try {
        const event = await createEvent(env, body);
        if (!event) return json({ ok: false }, 400, request);
        return json({ ok: true, event }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    if (url.pathname === "/events/migrate" && request.method === "POST") {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false }, 400, request);
      }
      try {
        const result = await migrateEvents(env, body.deletedIds, body.custom);
        return json({ ok: true, ...result }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    const eventMatch = url.pathname.match(/^\/events\/(\d+)$/);
    if (eventMatch && (request.method === "PUT" || request.method === "DELETE")) {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      try {
        if (request.method === "DELETE") {
          await deleteEvent(env, eventMatch[1]);
          return json({ ok: true }, 200, request);
        }
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false }, 400, request);
        }
        const event = await updateEvent(env, eventMatch[1], body);
        if (!event) return json({ ok: false }, 404, request);
        return json({ ok: true, event }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    if (url.pathname === "/todos" && request.method === "GET") {
      try {
        const todos = await listTodos(env);
        return json({ ok: true, todos }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    if (url.pathname === "/todos" && request.method === "POST") {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false }, 400, request);
      }
      try {
        const todo = await createTodo(env, body);
        if (!todo) return json({ ok: false }, 400, request);
        return json({ ok: true, todo }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    const todoMatch = url.pathname.match(/^\/todos\/(\d+)$/);
    if (todoMatch && (request.method === "PUT" || request.method === "DELETE")) {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      try {
        if (request.method === "DELETE") {
          await deleteTodo(env, todoMatch[1]);
          return json({ ok: true }, 200, request);
        }
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false }, 400, request);
        }
        const todo = await updateTodo(env, todoMatch[1], body);
        if (!todo) return json({ ok: false }, 404, request);
        return json({ ok: true, todo }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    if (url.pathname === "/settings" && request.method === "GET") {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      try {
        const settings = await getAppSettings(env);
        return json({ ok: true, settings }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    if (url.pathname === "/settings" && request.method === "PUT") {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false }, 400, request);
      }
      try {
        const settings = await updateAppSettings(env, body);
        if (!settings) return json({ ok: false }, 400, request);
        return json({ ok: true, settings }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    if (url.pathname === "/mail" && request.method === "GET") {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      try {
        const folder = url.searchParams.get("folder") || "";
        const account = url.searchParams.get("account") || "";
        const data = await listMail(env, folder, account);
        return json({ ok: true, ...data }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    if (url.pathname === "/mail" && request.method === "POST") {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false }, 400, request);
      }
      try {
        const message = await createMail(env, body);
        if (!message) return json({ ok: false, message: "메일을 저장하지 못했습니다." }, 400, request);
        return json({ ok: true, message }, 200, request);
      } catch (error) {
        if (error && error.code === "settings") {
          return json({ ok: false, message: "settings" }, 400, request);
        }
        return dbError(error, request);
      }
    }

    if (url.pathname === "/mail/sync" && request.method === "POST") {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      try {
        let body = {};
        try { body = await request.json(); } catch { body = {}; }
        const account = body.account || url.searchParams.get("account") || "";
        const result = await syncMail(env, account);
        return json(result, 200, request);
      } catch (error) {
        if (error && error.code === "settings") {
          return json({ ok: false, message: "설정에서 다음/네이버/Gmail 연동 정보와 앱 비밀번호를 확인하세요." }, 400, request);
        }
        if (error && error.code === "imap") {
          return json({
            ok: false,
            message: "메일 서버 연결에 실패했습니다. IMAP 호스트/포트/앱 비밀번호를 확인하세요.",
            detail: String(error.message || "").slice(0, 300),
          }, 400, request);
        }
        return dbError(error, request);
      }
    }

    const mailMatch = url.pathname.match(/^\/mail\/(\d+)$/);
    if (mailMatch && request.method === "PUT") {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false }, 400, request);
      }
      try {
        const message = await updateMail(env, mailMatch[1], body);
        if (!message) return json({ ok: false }, 404, request);
        return json({ ok: true, message }, 200, request);
      } catch (error) {
        if (error && error.code === "settings") {
          return json({ ok: false, message: "settings" }, 400, request);
        }
        return dbError(error, request);
      }
    }

    if (mailMatch && request.method === "DELETE") {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      try {
        const ok = await deleteMail(env, mailMatch[1]);
        if (!ok) return json({ ok: false }, 404, request);
        return json({ ok: true }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    if (url.pathname === "/holidays" && request.method === "GET") {
      const year = Number(url.searchParams.get("year"));
      const month = Number(url.searchParams.get("month"));
      if (!Number.isInteger(year) || !Number.isInteger(month)) {
        return json({ status: "BAD_REQUEST", holidays: [] }, 400, request);
      }
      const result = await getHolidays(env, year, month);
      const status = result.status === "BAD_REQUEST" ? 400 : 200;
      return json(result, status, request);
    }

    if (url.pathname === "/schedules" && request.method === "GET") {
      try {
        const schedules = await listSchedules(env);
        return json({ ok: true, schedules }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    if (url.pathname === "/schedules" && request.method === "POST") {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false }, 400, request);
      }
      try {
        const schedule = await createSchedule(env, body);
        if (!schedule) return json({ ok: false }, 400, request);
        return json({ ok: true, schedule }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    const scheduleMatch = url.pathname.match(/^\/schedules\/(\d+)$/);
    if (scheduleMatch && (request.method === "PUT" || request.method === "DELETE")) {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      try {
        if (request.method === "DELETE") {
          await deleteSchedule(env, scheduleMatch[1]);
          return json({ ok: true }, 200, request);
        }
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false }, 400, request);
        }
        const schedule = await updateSchedule(env, scheduleMatch[1], body);
        if (!schedule) return json({ ok: false }, 404, request);
        return json({ ok: true, schedule }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    if (url.pathname === "/sync" && request.method === "POST") {
      if (request.headers.get("X-Diary-Sync") !== env.SYNC_TOKEN) return json({ ok: false }, 401, request);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false }, 400, request);
      }
      const events = normalizeEvents(body.events);
      if (!events) return json({ ok: false }, 400, request);
      await env.DIARY.put(EVENTS_KEY, JSON.stringify(events));
      return json({ ok: true, count: events.length }, 200, request);
    }

    if (url.pathname === "/preview" && request.method === "GET") {
      const today = url.searchParams.get("today") || kstToday();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return json({ ok: false }, 400, request);
      const reminder = await reminderFor(env, today);
      return json({ ok: true, ...reminder }, 200, request);
    }

    if (url.pathname === "/reminder/run" && request.method === "POST") {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      const today = url.searchParams.get("today") || kstToday();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return json({ ok: false }, 400, request);
      const force = url.searchParams.get("force") === "1";
      if (force) await env.DIARY.delete(`sent:${today}`);
      const result = await runReminder(env, today, { force });
      return json({ ok: true, ...result }, 200, request);
    }

    if (url.pathname === "/cards" && request.method === "GET") {
      try {
        const items = await listCardUsages(env);
        return json({ ok: true, items }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    if (url.pathname === "/cards" && request.method === "POST") {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false }, 400, request);
      }
      try {
        const item = await createCardUsage(env, body);
        if (!item) return json({ ok: false }, 400, request);
        return json({ ok: true, item }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    if (url.pathname === "/cards/import" && request.method === "POST") {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false }, 400, request);
      }
      try {
        const result = await importCardUsages(env, body.items || body.rows || [], { replace: body.replace === true });
        return json({ ok: true, ...result }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    const cardMatch = url.pathname.match(/^\/cards\/(\d+)$/);
    if (cardMatch && (request.method === "PUT" || request.method === "DELETE")) {
      if (!authorized(request, env)) return json({ ok: false }, 401, request);
      try {
        if (request.method === "DELETE") {
          await deleteCardUsage(env, cardMatch[1]);
          return json({ ok: true }, 200, request);
        }
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false }, 400, request);
        }
        const item = await updateCardUsage(env, cardMatch[1], body);
        if (!item) return json({ ok: false }, 404, request);
        return json({ ok: true, item }, 200, request);
      } catch (error) {
        return dbError(error, request);
      }
    }

    if (url.pathname === "/health") return json({ ok: true, database: isDatabaseConfigured(env) }, 200, request);
    return json({ ok: false }, 404, request);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runReminder(env));
  },
};
