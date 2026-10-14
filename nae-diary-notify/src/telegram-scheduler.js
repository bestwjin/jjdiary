import {
  claimDueTelegramOutbox,
  hasPendingTelegramOutbox,
  markTelegramOutboxFailed,
  markTelegramOutboxSent,
} from "./db.js";
import { sendTelegramMessage } from "./telegram.js";

export async function processTelegramOutbox(env) {
  const due = await claimDueTelegramOutbox(env);
  let sent = 0;
  let failed = 0;
  for (const item of due) {
    const result = await sendTelegramMessage(env, item.body);
    if (result.ok) {
      await markTelegramOutboxSent(env, item.id);
      sent += 1;
    } else {
      await markTelegramOutboxFailed(env, item.id, result.error || "send_failed");
      failed += 1;
    }
  }
  return { checked: due.length, sent, failed };
}

export async function ensureTelegramScheduler(env) {
  if (!env.TELEGRAM_SCHEDULER) return false;
  const id = env.TELEGRAM_SCHEDULER.idFromName("default");
  const stub = env.TELEGRAM_SCHEDULER.get(id);
  await stub.fetch("https://telegram-scheduler/ensure", { method: "POST" });
  return true;
}

export class TelegramScheduler {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/ensure" || path === "/") {
      await this.ensureAlarm();
      return Response.json({ ok: true });
    }
    return new Response("Not found", { status: 404 });
  }

  async ensureAlarm() {
    const existing = await this.state.storage.getAlarm();
    if (existing == null) {
      await this.state.storage.setAlarm(Date.now() + 1000);
    }
  }

  async alarm() {
    try {
      await processTelegramOutbox(this.env);
    } catch (error) {
      console.error("telegram scheduler alarm failed", error && error.message ? error.message : error);
    }
    try {
      if (await hasPendingTelegramOutbox(this.env)) {
        await this.state.storage.setAlarm(Date.now() + 1000);
      }
    } catch (error) {
      console.error("telegram scheduler rearm failed", error && error.message ? error.message : error);
      await this.state.storage.setAlarm(Date.now() + 1000);
    }
  }
}
