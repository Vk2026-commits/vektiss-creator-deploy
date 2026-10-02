/** Provider-enforced structure; private review notes remain separate from speech. */
export const scriptResponseFormat={type:'json_schema',json_schema:{name:'creator_script',strict:true,schema:{
 type:'object',properties:{
  hook:{type:'string',description:'Opening spoken words, no markdown.'},
  body:{type:'string',description:'Main spoken script only, no closing or private review notes.'},
  cta:{type:'string',description:'Spoken closing, exactly once.'},
  review:{type:'string',description:'Private editorial notes as one plain-text string, never an array or object. Not spoken. Use an empty string if no notes are needed.'}
 },required:['hook','body','cta','review'],additionalProperties:false
}}};
