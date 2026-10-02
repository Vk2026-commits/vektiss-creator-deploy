import './source-report.css';
const sections:Record<string,{title:string;icon:string}>={
 'visible actions':{title:'What’s happening',icon:'01'},
 'on-screen text':{title:'On the screen',icon:'02'},
 speech:{title:'What’s being said',icon:'03'},
 uncertainty:{title:'What’s unclear',icon:'?'}
};
/** Render emphasis as React text nodes, never as HTML from a source or model. */
function Emphasis({text}:{text:string}) {
 return <>{text.split(/(\*\*[^*\n]+\*\*)/g).map((part,i)=>part.startsWith('**')&&part.endsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part)}</>;
}
export function SourceReport({text}:{text:string}) {
 const paragraphs=text.split(/\n\s*\n/).filter(Boolean);
 const parsed=paragraphs.map(paragraph=>{
  const match=paragraph.match(/^(?:\*\*)?(Visible actions|On-screen text|Speech|Uncertainty):(?:\*\*)?\s*([\s\S]*)$/i);
  return match?{kind:match[1].toLowerCase(),body:match[2]}:null;
 });
 if(!parsed.every(Boolean))return <div className="source-report">{paragraphs.map((paragraph,index)=><p key={index} style={{whiteSpace:'pre-wrap'}}><Emphasis text={paragraph}/></p>)}</div>;
 return <section className="source-glance" aria-label="Video at a glance">
  <header><span className="source-glance-kicker">THE QUICK READ</span><h3>Your video, at a glance.</h3><p>The key context before you share your take.</p></header>
  <div className="source-glance-grid">{parsed.map((item,index)=>{
   const {kind,body}=item!;const section=sections[kind];
   const split=kind==='uncertainty'?null:body.match(/^([\s\S]*?[.!?])\s+([\s\S]+)$/);
   return <article key={index} className={`source-insight ${kind==='uncertainty'?'source-insight-caution':''}`}>
    <div className="source-insight-heading"><span aria-hidden="true">{section.icon}</span><h4>{section.title}</h4></div>
    <p><Emphasis text={split?split[1]:body}/></p>
    {split&&<details><summary>More context</summary><p><Emphasis text={split[2]}/></p></details>}
   </article>;
  })}</div>
 </section>;
}
