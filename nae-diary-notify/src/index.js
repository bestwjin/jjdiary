import builtinEvents from "./builtin-events.json" with { type: "json" };
import { createEvent, createTodo, deleteEvent, deleteTodo, isDatabaseConfigured, listEvents, listTodos, migrateEvents, updateEvent, updateTodo } from "./db.js";
import { addDays, buildMessage, eventsOn, kstToday, normalizeEvents } from "./logic.js";

const EVENTS_KEY = "events";

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = origin === "https://nae-diary.pages.dev" || origin.endsWith(".nae-diary.pages.dev");
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
  const due = eventsOn(await loadEvents(env), tomorrow);
  return {
    today,
    tomorrow,
    count: due.length,
    message: due.length ? buildMessage(tomorrow, due) : "",
    telegramConfigured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
  };
}

async function sendTelegram(env, text) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: true,
    }),
  });
  const body = await response.json().catch(() => ({}));
  return { ok: response.ok && body.ok === true, status: response.status };
}

export async function runReminder(env, today = kstToday()) {
  const reminder = await reminderFor(env, today);
  const sentKey = `sent:${today}`;
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
  await env.DIARY.put("lastRun", JSON.stringify({ ...reminder, sent: result.ok, at: new Date().toISOString() }));
  return { ...reminder, sent: result.ok, reason: result.ok ? "sent" : "telegram_failed" };
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

    if (url.pathname === "/health") return json({ ok: true, database: isDatabaseConfigured(env) }, 200, request);
    return json({ ok: false }, 404, request);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runReminder(env));
  },
};
