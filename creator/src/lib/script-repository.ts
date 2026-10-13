import { supabase } from './supabase';
import { scriptSchema, type Script, type ScriptInput } from '../domain/scripts';
import {finishedVersion,invalidateVoiceApproval,projectId,versionDraft,versionNumber} from '../domain/video-versions';

export function scriptRepository(userId: string, preview: boolean) {
  const key = `vektiss:scripts:v1:${userId}`;
  const read = (): Script[] => JSON.parse(localStorage.getItem(key) || '[]');
  return {
    async createVersion(source:Script,requestId:string):Promise<Script>{
      if(preview){
        const items=read();const parent=items.find(s=>s.id===source.id);
        if(!parent||!finishedVersion(parent))throw Error('Choose a finished video.');
        const existing=items.find(s=>s.version_request_id===requestId||s.parent_version_id===source.id&&!finishedVersion(s));
        if(existing)return existing;
        const saved:Script={...versionDraft(parent),id:crypto.randomUUID(),project_id:projectId(parent),parent_version_id:parent.id,version_number:Math.max(...items.filter(s=>projectId(s)===projectId(parent)).map(versionNumber))+1,finalized_at:null,version_request_id:requestId,updated_at:new Date().toISOString()};
        localStorage.setItem(key,JSON.stringify([saved,...items]));return saved;
      }
      const {data,error}=await supabase!.rpc('create_video_version',{source_id:source.id,request_key:requestId});
      if(error)throw error;if(!data)throw Error('Could not create version.');return data as Script;
    },
    async list(): Promise<Script[]> {
      if (preview) return read();
      const { data, error } = await supabase!.from('creator_scripts').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    async save(input: ScriptInput, existing: Script | null): Promise<Script> {
      if(existing&&finishedVersion(existing))throw Error('Finished video is read-only. Make another version.');
      const valid = scriptSchema.parse(existing?invalidateVoiceApproval(existing,input):input);
      if (preview) {
        const items = read();
        if (existing && items.find(s => s.id === existing.id)?.updated_at !== existing.updated_at) throw new Error('STALE');
        const saved = { ...existing,...valid, id: existing?.id ?? crypto.randomUUID(), updated_at: new Date().toISOString() };
        localStorage.setItem(key, JSON.stringify([saved, ...items.filter(s => s.id !== saved.id)]));
        return saved;
      }
      const query = existing
        ? supabase!.from('creator_scripts').update(valid).eq('id', existing.id).eq('updated_at', existing.updated_at)
        : supabase!.from('creator_scripts').insert({ ...valid, user_id: userId });
      const { data, error } = await query.select('*').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('STALE');
      return data;
    },
  };
}
