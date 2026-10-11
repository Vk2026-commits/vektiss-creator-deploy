export type VideoReadyNotification = {
  state: "sent" | "skipped" | "failed";
  providerId?: string;
  reason?: "NOT_CONFIGURED" | "INVALID_RECIPIENT" | "PROVIDER";
};

type VideoReadyEmailInput = {
  apiKey?: string;
  from?: string;
  to?: string;
  webOrigin: string;
  exportId: string;
  idempotencyKey: string;
  fetcher?: typeof fetch;
};

function clean(value: string | undefined) {
  return value?.trim() ?? "";
}

function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[character]!));
}

function creatorLink(webOrigin: string, exportId: string) {
  const url = new URL(webOrigin);
  if (url.protocol !== "https:" || url.username || url.password) throw Error("Invalid Creator web origin.");
  url.searchParams.set("export", exportId);
  return url.href;
}

export async function sendVideoReadyEmail(input: VideoReadyEmailInput): Promise<VideoReadyNotification> {
  const apiKey = clean(input.apiKey);
  const from = clean(input.from);
  const to = clean(input.to);
  if (!apiKey || !from) return {state: "skipped", reason: "NOT_CONFIGURED"};
  if (!validEmail(to) || /[\r\n]/.test(from)) return {state: "skipped", reason: "INVALID_RECIPIENT"};

  let link: string;
  try {
    link = creatorLink(input.webOrigin, input.exportId);
  } catch {
    return {state: "failed", reason: "PROVIDER"};
  }

  const safeLink = escapeHtml(link);
  try {
    const response = await (input.fetcher ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Your Vektiss Creator video is ready",
        html: `<p>Your video is ready to view.</p><p><a href="${safeLink}">Open Creator</a></p><p>Sign in with this email address to view and download your finished video.</p>`,
        text: `Your Vektiss Creator video is ready. Open Creator: ${link}\n\nSign in with this email address to view and download your finished video.`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return {state: "failed", reason: "PROVIDER"};
    const body = await response.json().catch(() => null) as {id?: unknown} | null;
    return {state: "sent", ...(typeof body?.id === "string" ? {providerId: body.id} : {})};
  } catch {
    return {state: "failed", reason: "PROVIDER"};
  }
}
