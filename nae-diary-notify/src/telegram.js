import { getTelegramConfig } from "./db.js";

export async function sendTelegramMessage(env, text) {
  const message = String(text || "").trim();
  if (!message) return { ok: false, status: 0, error: "empty_message" };
  const telegram = await getTelegramConfig(env);
  if (!telegram.token || !telegram.username) {
    return { ok: false, status: 0, error: "missing_credentials" };
  }
  const response = await fetch(`https://api.telegram.org/bot${telegram.token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegram.username,
      text: message.slice(0, 4000),
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
