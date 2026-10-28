/** Small, trusted vector assets selected from source labels. These illustrate a
 * concept; they never impersonate a logo, product screenshot, or presenter. */
export const editorialAssetIds=['cooking','cleaning','repair','video','ai','business','learning','money','time','security','message','document','growth','location','idea','cloud'] as const;
export type EditorialAssetId=typeof editorialAssetIds[number];
const assets: [RegExp,string,string][] = [
 [/\b(cook(?:ing)?|food|kitchen)\b/i,'cooking','<path d="M5 10h14v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Zm-3 2h3m14 0h3M8 6V3m4 3V2m4 4V3"/>'],
 [/\b(clean(?:ing)?|housework)\b/i,'cleaning','<path d="m15 2-5 12m-4-1 9 4-3 5-10-4 4-5Zm12-6v6m-3-3h6"/>'],
 [/\b(engine|engines|repair|fixing|mechanic)\b/i,'repair','<path d="M15 3a6 6 0 0 0-7 8l-6 6a3 3 0 0 0 4 4l6-6a6 6 0 0 0 8-7l-4 4-4-4 3-5Z"/>'],
 [/\b(record(?:ing)?|video|camera|film)\b/i,'video','<rect x="2" y="6" width="14" height="14" rx="3"/><path d="m16 11 6-4v12l-6-4M6 3h6"/><circle cx="8" cy="13" r="3"/>'],
 [/\b(ai|artificial intelligence|machine learning|automation)\b/i,'ai','<rect x="6" y="6" width="12" height="12" rx="3"/><rect x="10" y="10" width="4" height="4" rx="1"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/>'],
 [/\b(customer|client|service|business)\b/i,'business','<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V3h8v4M3 12l9 3 9-3m-9 1v4"/>'],
 [/\b(skill|learn|knowledge|education)\b/i,'learning','<path d="M12 5C9 2 5 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-7-2-10 1Zm0 0v16"/>'],
 [/\b(money|income|revenue|paid|earn|payment|price)\b/i,'money','<rect x="2" y="5" width="20" height="14" rx="3"/><circle cx="12" cy="12" r="3"/><path d="M5 9h1m12 6h1"/>'],
 [/\b(time|hour|hours|deadline|schedule)\b/i,'time','<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>'],
 [/\b(safety|security|protect|protection|secure)\b/i,'security','<path d="M12 2 3 6v6c0 5 5 8 9 10 4-2 9-5 9-10V6L12 2Z"/><path d="m8 12 3 3 5-6"/>'],
 [/\b(message|email|conversation|communication)\b/i,'message','<path d="M3 3h18v14H9l-6 5V3Zm4 5h10M7 12h7"/>'],
 [/\b(document|contract|script|article|report)\b/i,'document','<path d="M5 2h10l4 4v16H5V2Zm10 0v5h4M8 11h8m-8 4h8m-8 4h5"/>'],
 [/\b(grow|growth|progress|improve)\b/i,'growth','<path d="M3 3v18h18M6 15l5-5 4 3 6-8m-6 0h6v6"/>'],
 [/\b(location|map|place|city|travel)\b/i,'location','<path d="M19 10c0 6-7 12-7 12S5 16 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="9" r="2"/>'],
 [/\b(idea|solution|opportunity|creative)\b/i,'idea','<path d="M8 17c0-3-3-4-3-8a7 7 0 1 1 14 0c0 4-3 5-3 8Zm0 3h8m-6 3h4"/>'],
 [/\b(cloud|upload|storage|data)\b/i,'cloud','<path d="M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1 0 11M12 22V11m-4 4 4-4 4 4"/>'],
];
export function editorialAsset(label:string,x:number,y:number,size:number,asset?:EditorialAssetId):string {
 const match=asset?assets.find(([,id])=>id===asset):assets.find(([pattern])=>pattern.test(label));
 if(!match)return '';
 return `<svg data-editorial-asset="${match[1]}" x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="var(--ed-accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${match[2]}</svg>`;
}
