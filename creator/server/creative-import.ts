import { createHash, randomUUID } from "node:crypto";
import { mkdir, stat, writeFile, rename, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { publicResource } from "./public-network";
import { z } from "zod";
export async function importCreativeVideo(
  root: string,
  raw: unknown,
  authorization: string,
  config: { supabaseUrl: string; publicKey: string },
) {
  const { jobId } = z.object({ jobId: z.string().uuid() }).strict().parse(raw);
  const response = await fetch(
    `${config.supabaseUrl}/functions/v1/creative-manager`,
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        apikey: config.publicKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "refresh", job_id: jobId }),
      signal: AbortSignal.timeout(45000),
    },
  );
  if (!response.ok)
    throw Error(
      "Could not verify this saved AI video. Refresh its status first.",
    );
  const job = await response.json();
  if (job.kind !== "agent" || job.status !== "completed")
    throw Error("Wait for the AI-produced video to finish.");
  const url = new URL(job.result.video.video_url);
  if (
    url.protocol !== "https:" ||
    !["heygen.ai", "heygen.com"].some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    )
  )
    throw Error("Unsupported provider video host.");
  const id = createHash("sha256")
    .update(`creative:${jobId}:${job.result.video.id ?? job.result.video_id}`)
    .digest("hex");
  const folder = resolve(root, "edit/compositions"),
    file = resolve(folder, `${id}.mp4`);
  await mkdir(folder, { recursive: true });
  try {
    await stat(file);
    return { id };
  } catch {
    /* Download once under this account's media root. */
  }
  const media = await publicResource(
    url.href,
    AbortSignal.timeout(120000),
    0,
    500 * 1024 * 1024,
  );
  if (media.status !== 200)
    throw Error("The video link expired. Refresh and retry.");
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, media.body, { mode: 0o600 });
    await rename(temp, file);
  } finally {
    await unlink(temp).catch(() => {});
  }
  return { id };
}
