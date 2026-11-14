export function providerLimitCode(code: unknown): 'PROVIDER_QUOTA' | 'PROVIDER_RATE_LIMIT' {
  return code === 'insufficient_quota' || code === 'credit_balance_exhausted'
    ? 'PROVIDER_QUOTA'
    : 'PROVIDER_RATE_LIMIT';
}
