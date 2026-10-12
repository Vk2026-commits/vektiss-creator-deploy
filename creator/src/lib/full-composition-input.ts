import {avatarFraming} from '../domain/avatar-framing';
import type {VideoPlan} from '../domain/video-plan';
import {storyRevisionInput} from '../domain/screenshot-story';

export type CompositionSourceKind='article'|'video'|'graphic';

export async function fullCompositionInput({jobId,scriptId,plan,sourceKind}:{jobId:string;scriptId:string;plan:VideoPlan;sourceKind:CompositionSourceKind}){
 const captureId=sourceKind==='video'?plan.video_background?.id:plan.article_capture?.id;
 const presenterOnly=sourceKind==='article'&&!captureId;
 const storyRevision=plan.screenshot_story
  ?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(storyRevisionInput(plan.screenshot_story)))),byte=>byte.toString(16).padStart(2,'0')).join('')
  :undefined;
 const background=sourceKind!=='video'&&!plan.screenshot_story&&!presenterOnly&&plan.background_framing?{background_framing:plan.background_framing}:{};
 if(!captureId&&!presenterOnly&&!plan.screenshot_story)throw Error('Choose a source before exporting this video.');
 return {
  job_id:jobId,
  script_id:scriptId,
  ...background,
  ...(plan.screenshot_story?{story:true,story_revision:storyRevision}:presenterOnly?{presenter_only:true}:sourceKind==='video'?{video_id:captureId}:{capture_id:captureId}),
  size:plan.presenter_size,
  position:plan.presenter_position,
  format:plan.format,
  placement:plan.presenter_placement,
  framing:avatarFraming(plan.avatar_id,plan.format),
	 presenter_framing:plan.presenter_framing,
	 presenter_framing_amount:plan.presenter_framing_amount,
	 presenter_framing_position:plan.presenter_framing_position,
	};
}
