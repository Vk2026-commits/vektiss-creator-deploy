import { supabase } from './supabase';
import { scriptSchema, type Script, type ScriptInput } from '../domain/scripts';

export function scriptRepository(userId: string, preview: boolean) {
  const key = `vektiss:scripts:v1:${userId}`;
  const read = (): Script[] => JSON.parse(localStorage.getItem(key) || '[]');
  return {
    async list(): Promise<Script[]> {
      if (preview) return read();
      const { data, error } = await supabase!.from('creator_scripts').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    async save(input: ScriptInput, existing: Script | null): Promise<Script> {
      const valid = scriptSchema.parse(input);
      if (preview) {
        const items = read();
        if (existing && items.find(s => s.id === existing.id)?.updated_at !== existing.updated_at) throw new Error('STALE');
        const saved = { ...valid, id: existing?.id ?? crypto.randomUUID(), updated_at: new Date().toISOString() };
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
