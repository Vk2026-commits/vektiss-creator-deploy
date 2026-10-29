/** Trusted schematic illustrations selected from source meaning. Layered surfaces
 * and distinct silhouettes stay legible at presentation size. These never
 * impersonate a logo, product screenshot, or presenter. */
export const editorialAssetIds=['robot','cooking','cleaning','repair','video','ai','business','learning','money','time','security','message','document','growth','location','idea','cloud'] as const;
export type EditorialAssetId=typeof editorialAssetIds[number];
const assets: [RegExp,string,string][] = [
 [/\b(robot|robots|robotic)\b/i,'robot','<path d="M3 22h18M7 22v-4l5-5-4-6 4-4 7 5-3 6-3-2m3-6 5-2m0 0 2 3m-2-3-1-2"/><circle cx="12" cy="13" r="2"/><circle cx="9" cy="7" r="2"/>'],
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
// Larger illustrations use a 48-unit artboard. Quiet solid surfaces provide
// depth on dark editorial panels; the brand accent owns only the focal detail.
// There are no runtime URLs, text payloads, or generated markup in this catalogue.
const ink='var(--ed-asset-surface,#233d50)',light='var(--ed-asset-light,#dbe8ef)',accent='var(--ed-accent,#1688ff)';
const layered:Partial<Record<EditorialAssetId,string>>={
 cooking:`<ellipse cx="24" cy="41" rx="19" ry="3" fill="#000" opacity=".16" stroke="none"/><path d="M9 22h30v10a8 8 0 0 1-8 8H17a8 8 0 0 1-8-8Z" fill="${ink}" stroke="${light}"/><path d="M10 27H5v-5h5m28 5h5v-5h-5" stroke="${light}"/><path d="M8 20h32" stroke="${light}" stroke-width="2.5"/><path d="M14 17c0-3 4-3 4-6s-3-3-3-6m9 12c0-3 4-3 4-6s-3-3-3-6m9 12c0-3 3-3 3-6" stroke="${accent}"/><path d="M13 25v6a5 5 0 0 0 5 5" stroke="${accent}" stroke-width="2.5"/>`,
 cleaning:`<ellipse cx="24" cy="42" rx="20" ry="3" fill="#000" opacity=".16" stroke="none"/><path d="m29 5 4 2-13 25-4-2Z" fill="${light}" stroke="${light}"/><path d="m12 25 15 7-6 10-17-8Z" fill="${ink}" stroke="${light}"/><path d="m8 34 3-6m2 9 4-7m1 9 4-7" stroke="${accent}"/><path d="M37 17v10m-5-5h10M39 4v6m-3-3h6" stroke="${accent}" stroke-width="2"/>`,
 repair:`<ellipse cx="24" cy="42" rx="19" ry="3" fill="#000" opacity=".16" stroke="none"/><path d="M30 5a11 11 0 0 0-12 14L5 32a6 6 0 0 0 9 9l13-13A11 11 0 0 0 42 16l-8 7-8-8 7-9Z" fill="${ink}" stroke="${light}"/><path d="m13 33 12-12" stroke="${accent}" stroke-width="3"/><circle cx="10" cy="36" r="2" fill="${accent}" stroke="none"/><path d="m35 31 7 7m-6-1 3-3" stroke="${accent}"/>`,
 video:`<rect x="3" y="7" width="42" height="30" rx="5" fill="${ink}" stroke="${light}"/><path d="M3 14h42" stroke="${light}" opacity=".5"/><circle cx="8" cy="10.5" r="1" fill="${accent}" stroke="none"/><circle cx="12" cy="10.5" r="1" fill="${light}" stroke="none" opacity=".5"/><path d="m20 19 10 6-10 6Z" fill="${accent}" stroke="none"/><path d="M11 42h26M24 37v5" stroke="${light}"/><path d="M8 33h32" stroke="${light}" opacity=".2"/><path d="M8 33h12" stroke="${accent}" stroke-width="2"/>`,
 ai:`<rect x="11" y="11" width="26" height="26" rx="6" fill="${ink}" stroke="${light}"/><rect x="18" y="18" width="12" height="12" rx="3" fill="${accent}" fill-opacity=".22" stroke="${accent}"/><path d="M17 4v7m7-7v7m7-7v7M17 37v7m7-7v7m7-7v7M4 17h7m-7 7h7m-7 7h7m26-14h7m-7 7h7m-7 7h7" stroke="${light}" opacity=".7"/><path d="m21 24 2 2 4-4" stroke="${accent}" stroke-width="2"/><circle cx="14" cy="14" r="1" fill="${accent}" stroke="none"/>`,
 learning:`<path d="M24 12C18 6 10 7 4 9v29c8-3 15-1 20 3 5-4 12-6 20-3V9c-6-2-14-3-20 3Z" fill="${ink}" stroke="${light}"/><path d="M24 12v29" stroke="${light}"/><path d="M9 16c4-1 7 0 10 2m-10 5c4-1 7 0 10 2m-10 5c4-1 7 0 10 2M29 18c3-2 6-3 10-2m-10 9c3-2 6-3 10-2" stroke="${accent}"/><path d="m32 6 3-3 3 3v8l-3-2-3 2Z" fill="${accent}" stroke="none"/>`,
 money:`<rect x="8" y="7" width="37" height="25" rx="4" fill="${ink}" stroke="${light}" opacity=".35"/><rect x="3" y="13" width="37" height="25" rx="4" fill="${ink}" stroke="${light}"/><path d="M10 18a4 4 0 0 1-3 4v7a4 4 0 0 1 3 4h23a4 4 0 0 1 3-4v-7a4 4 0 0 1-3-4Z" stroke="${light}" opacity=".3"/><circle cx="21.5" cy="25.5" r="6" fill="${accent}" fill-opacity=".18" stroke="${accent}"/><path d="M10 25h2m19 0h2" stroke="${accent}" stroke-width="2"/>`,
 document:`<rect x="9" y="5" width="29" height="39" rx="3" fill="${ink}" stroke="${light}" opacity=".3"/><path d="M6 3h23l10 10v28H6Z" fill="${ink}" stroke="${light}"/><path d="M29 3v10h10" stroke="${light}"/><path d="M12 19h20m-20 7h20m-20 7h12" stroke="${light}" opacity=".5"/><path d="m26 33 3 3 7-8" stroke="${accent}" stroke-width="2.5"/>`,
 idea:`<path d="M17 33c0-6-7-7-7-16a14 14 0 0 1 28 0c0 9-7 10-7 16Z" fill="${ink}" stroke="${light}"/><path d="M19 37h10m-8 5h6" stroke="${light}" stroke-width="2.5"/><path d="m18 19 6 6 6-6m-6 6v8" stroke="${accent}" stroke-width="2"/><path d="M24 1v3M3 16h3m36 0h3M6 4l4 4m28 0 4-4" stroke="${accent}"/>`,
};
export function editorialAsset(label:string,x:number,y:number,size:number,asset?:EditorialAssetId):string {
 const match=asset?assets.find(([,id])=>id===asset):assets.find(([pattern])=>pattern.test(label));
 if(!match)return '';
 const illustration=layered[match[1] as EditorialAssetId];
 return `<svg data-editorial-asset="${match[1]}" data-editorial-detail="${illustration?'layered':'line'}" x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="var(--ed-accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${illustration??`<g transform="scale(2)">${match[2]}</g>`}</svg>`;
}
