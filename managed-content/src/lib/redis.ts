type RedisValue = string | number | null;

function config() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis is not configured');
  return { url: url.replace(/\/$/, ''), token };
}

export async function redis(command: (string | number)[]): Promise<RedisValue> {
  const { url, token } = config();
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), cache: 'no-store' });
  if (!response.ok) throw new Error(`Redis returned ${response.status}`);
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('result' in body)) throw new Error('Invalid Redis response');
  const result = (body as { result: unknown }).result;
  if (result === null || typeof result === 'string' || typeof result === 'number') return result;
  throw new Error('Invalid Redis result');
}

export async function recordMetric(name: string) {
  const day = new Date().toISOString().slice(0, 10);
  await redis(['INCR', `managed:metrics:${day}:${name}`]);
}
