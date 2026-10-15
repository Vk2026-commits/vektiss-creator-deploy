type StoreValue = string | number | null;

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url.replace(/\/$/, ''))) {
    throw new Error('Managed Content Supabase storage is not configured');
  }
  return { url: url.replace(/\/$/, ''), key };
}

// The matching SQL function is service-role-only and touches only the
// managed_content_internal schema. No Creator tables are read or written.
export async function store(command: (string | number)[]): Promise<StoreValue> {
  const { url, key } = config();
  const [operation, storageKey, value, ...options] = command;
  if (typeof operation !== 'string' || typeof storageKey !== 'string' || !storageKey.startsWith('managed:')) {
    throw new Error('Invalid managed storage command');
  }
  const upper = operation.toUpperCase();
  const nx = options.includes('NX');
  const exIndex = options.indexOf('EX');
  const ttl = exIndex >= 0 ? Number(options[exIndex + 1]) : upper === 'EXPIRE' ? Number(value) : null;
  const response = await fetch(`${url}/rest/v1/rpc/managed_content_store`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_command: upper,
      p_key: storageKey,
      p_value: value === undefined || upper === 'EXPIRE' ? null : String(value),
      p_nx: nx,
      p_ttl_seconds: ttl,
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Managed Content storage returned ${response.status}`);
  const result: unknown = await response.json();
  if (result === null || typeof result === 'string' || typeof result === 'number') return result;
  throw new Error('Invalid managed storage result');
}

export async function recordMetric(name: string) {
  const day = new Date().toISOString().slice(0, 10);
  await store(['INCR', `managed:metrics:${day}:${name}`]);
}
