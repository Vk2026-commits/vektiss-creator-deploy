/** Roll out the reference camera only where its framing has been validated. */
export function editRenderer(template:string,aspectRatio?:string){
 if(template==='popout-explainer'&&aspectRatio!=='16:9')return 'reference-remotion';
 return ['tier-list','hyperframes-motion','phone-mockup','paper-cutout','clean-tech','glass-cards','popout-explainer','animated-explainer','charts-comparisons'].includes(template)?'hyperframes':'remotion';
}
