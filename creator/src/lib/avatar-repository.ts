import { supabase } from "./supabase";
import { notifyAvatarLibrary } from './avatar-library-events';
import { withDeadline } from './request-deadline';
import {
  avatarCommandSchema,
  librarySchema,
  catalogSchema,
  voicesSchema,
  voiceSchema,
  type AvatarCommand,
} from "../../supabase/functions/_shared/avatar-contract";

async function request(command: AvatarCommand) {
  if (!supabase)
    throw new Error("Connect a Supabase project to enable the avatar library.");
  const { data, error } = await withDeadline(signal=>supabase!.functions.invoke("avatar-manager", {
    body: avatarCommandSchema.parse(command),signal,
  }),command.action==='verify_avatar_test'?115000:45000,'The avatar request timed out. Refresh status before attempting another paid render.');
  if (error) {
    let message = "The avatar service is unavailable. Please try again.";
    if (error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      if (typeof body?.error?.message === "string")
        message = body.error.message;
    }
    throw new Error(message);
  }
  return data;
}
export const avatarRepository = {
  voiceDetails:async(avatar_id:string,voice_id?:string)=>voiceSchema.parse(await request({action:'voice_details',avatar_id,voice_id})),
  previewVoice:async(avatar_id:string,voice_id:string|undefined,engine:import('../domain/voice-settings').VoiceEngine,speed:number)=>request({action:'preview_voice',avatar_id,voice_id,engine,speed,paid_consent:true}) as Promise<{audio_url:string;engine:string;duration:number}>,
  renderTest: request,
  library: async () =>
    librarySchema.parse(await request({ action: "library" })),
  change: async (command: AvatarCommand) => {
    const library=librarySchema.parse(await request(command));
    notifyAvatarLibrary();
    return library;
  },
  catalog: async (
    connection_id: string,
    ownership: "private" | "public",
    cursor?: string,
  ) =>
    catalogSchema.parse(
      await request({ action: "catalog", connection_id, ownership, cursor }),
    ),
  voices: async (
    connection_id: string,
    voice_type: "private" | "public",
    cursor?: string,
  ) =>
    voicesSchema.parse(
      await request({ action: "voices", connection_id, voice_type, cursor }),
    ),
};
