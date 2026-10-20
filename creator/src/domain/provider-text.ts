// PostgreSQL JSONB rejects NUL and unpaired UTF-16 surrogates. Social captions
// often contain emoji; truncating by code unit can split one in half.
export function providerText(value:string,limit:number):string {
 const clean=Array.from(value).filter(char=>char!=='\u0000'&&!(char.length===1&&char.charCodeAt(0)>=0xd800&&char.charCodeAt(0)<=0xdfff)).join('');
 const cut=clean.slice(0,limit);
 return /[\uD800-\uDBFF]$/.test(cut)?cut.slice(0,-1):cut;
}
