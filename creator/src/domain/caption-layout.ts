import {editBrandSchema,type EditBrand} from './edit-brand';
/** Apply after template motion so every HTML preview/export uses the same controls. */
export function applyCaptionLayout(html:string,raw:EditBrand){
 const brand=editBrandSchema.parse(raw),scale=brand.captionScale??1,offset=brand.captionOffsetY??0;
 if(scale===1&&offset===0)return html;
 return html.replace('</body>',`<script>(function(){
 const el=document.querySelector('#captions'),stage=document.querySelector('#stage');if(!el||!stage)return;
 const font=parseFloat(getComputedStyle(el).fontSize),height=stage.clientHeight;
 el.style.fontSize=(font*${scale})+'px';
 const original=seek;seek=function(t){original(t);const box=el.offsetHeight,base=el.offsetTop;
 const desired=height*${offset}/100,delta=Math.max(height*.04-base,Math.min(height*.96-box-base,desired));
 el.style.translate='0 '+delta+'px';};
 window.__timelines.vektiss.seek=t=>{seek(t);return window.__timelines.vektiss;};seek(0);
 })();</script></body>`);
}
