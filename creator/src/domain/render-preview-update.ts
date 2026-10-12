import type {VideoPlan} from './video-plan';

// Step 4 may learn preview metadata, but must not overwrite newer layout/render edits.
export function mergeRenderPreview(current:VideoPlan,incoming:VideoPlan):VideoPlan{
 const samePreview=JSON.stringify(current.avatar_preview)===JSON.stringify(incoming.avatar_preview);
 const sameBackground=JSON.stringify(current.video_background)===JSON.stringify(incoming.video_background);
 if(samePreview&&sameBackground)return current;
 return {...current,avatar_preview:incoming.avatar_preview,video_background:incoming.video_background};
}
