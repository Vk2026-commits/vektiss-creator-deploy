// Exact origins only: never use suffix matching or allow arbitrary subdomains.
export function isAllowedAppOrigin(origin: string, primary: string | undefined, additional = '') {
  return [primary, ...additional.split(',')].some(value => value?.trim() === origin);
}
