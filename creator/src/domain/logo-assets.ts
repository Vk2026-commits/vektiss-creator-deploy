import {z} from 'zod';
// Curated identity mapping prevents an ambiguous product name from selecting an unrelated company.
export const logoBrands=[
 {id:'chatgpt',name:'ChatGPT',site:'https://chatgpt.com/',aliases:['chatgpt','chat gpt']},
 {id:'openai',name:'OpenAI',site:'https://openai.com/',aliases:['openai','open ai','codex']},
 {id:'claude',name:'Claude',site:'https://claude.ai/',aliases:['claude','claude code'],iconUrls:['https://claude.ai/images/claude_app_icon.png','https://claude.ai/apple-touch-icon.png']},
 {id:'anthropic',name:'Anthropic',site:'https://www.anthropic.com/',aliases:['anthropic']},
 {id:'github',name:'GitHub',site:'https://github.com/',aliases:['github','git hub'],iconUrls:['https://github.com/fluidicon.png']},
 {id:'gemini',name:'Gemini',site:'https://gemini.google.com/',aliases:['google gemini','gemini']},
 {id:'notion',name:'Notion',site:'https://www.notion.so/',aliases:['notion']},
 {id:'canva',name:'Canva',site:'https://www.canva.com/',aliases:['canva']},
 {id:'perplexity',name:'Perplexity',site:'https://www.perplexity.ai/',aliases:['perplexity']},
 {id:'heygen',name:'HeyGen',site:'https://www.heygen.com/',aliases:['heygen','hey gen']},
] as const;
export const logoSuggestionSchema=z.object({brandId:z.string(),name:z.string().max(80),site:z.string().url(),assetId:z.string().regex(/^[a-f0-9]{64}$/).optional(),sourceUrl:z.string().url().optional(),status:z.enum(['pending','approved','omitted','unavailable']),firstWord:z.number().int().nonnegative(),message:z.string().optional()}).strict();
export type LogoSuggestion=z.infer<typeof logoSuggestionSchema>;
export type RenderLogo={name:string;firstWord:number;image:string};
export function mentionedBrands(words:readonly {text:string}[]){
 const normalized=words.map(w=>w.text.toLowerCase().replace(/[^a-z0-9]/g,''));
 return logoBrands.flatMap(brand=>{
  const index=normalized.findIndex((_,i)=>brand.aliases.some(alias=>{const tokens=alias.split(' ');return tokens.every((token,j)=>normalized[i+j]===token);}));
  return index<0?[]:[{...brand,firstWord:index}];
 }).sort((a,b)=>a.firstWord-b.firstWord).slice(0,8);
}
