import { supabase } from "./supabase";
import { withDeadline } from "./request-deadline";
import type {
  CreativeCommand,
  CreativeJob,
} from "../../supabase/functions/_shared/creative-contract";
export type CreativeState = {
  enabled: boolean;
  jobs: CreativeJob[];
  brand: { connection_id: string; kit_id: string } | null;
};
export async function creativeRequest<T = any>(
  command: CreativeCommand,
): Promise<T> {
  if (!supabase) throw Error("Sign in to use creative tools.");
  const { data, error } = await withDeadline(
    (signal) =>
      supabase!.functions.invoke("creative-manager", { body: command, signal }),
    45000,
    "The request timed out. Refresh saved jobs before starting another generation.",
  );
  if (error) {
    const body =
      error.context instanceof Response
        ? await error.context.json().catch(() => null)
        : null;
    throw Error(
      body?.error?.message ?? "Creative tools are unavailable. Please retry.",
    );
  }
  return data;
}
export async function uploadCreativeImage(connection_id: string, file: File) {
  if (
    !["image/png", "image/jpeg"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw Error("Choose a PNG or JPEG under 5 MB.");
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(Error("Image could not be read."));
    reader.readAsDataURL(file);
  });
  return creativeRequest<{ id: string; name: string }>({
    action: "upload",
    connection_id,
    name: file.name.slice(0, 120),
    mime: file.type as "image/png" | "image/jpeg",
    base64: data,
  });
}
export function openCreative(tab: "looks" | "brands" | "agent" | "videos") {
  window.dispatchEvent(new CustomEvent("creator:creative", { detail: tab }));
}
