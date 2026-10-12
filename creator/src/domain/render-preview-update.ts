import type {VideoPlan} from './video-plan';

// JSONB may reorder keys. Compare values, never serialized object ordering.
export function sameAvatarPreview(a:VideoPlan['avatar_preview'],b:VideoPlan['avatar_preview']):boolean{
 return a===b||Boolean(a&&b&&a.avatar_id===b.avatar_id&&a.engine===b.engine&&a.format===b.format&&a.aspect===b.aspect);
}

// Step 4 may learn preview metadata, but must not overwrite newer layout/render edits.
export function mergeRenderPreview(current:VideoPlan,incoming:VideoPlan):VideoPlan{
 const samePreview=sameAvatarPreview(current.avatar_preview,incoming.avatar_preview);
 const a=current.video_background,b=incoming.video_background;
 const sameBackground=a===b||Boolean(a&&b&&a.id===b.id&&a.source_url===b.source_url);
 if(samePreview&&sameBackground)return current;
 return {...current,avatar_preview:incoming.avatar_preview,video_background:incoming.video_background};
}
