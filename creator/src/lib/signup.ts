export function signupValidation(password: string, confirmation: string): string {
  if (password.length < 12) return 'Use at least 12 characters for your password.';
  if (password !== confirmation) return 'Your passwords do not match.';
  return '';
}

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s().-]/g, '');
}

export function phoneValidation(phone: string): string {
  return /^\+[1-9]\d{7,14}$/.test(normalizePhone(phone))
    ? ''
    : 'Enter a valid international phone number, including + and country code.';
}

export function setupStep(hasCreator: boolean, profileCount: number): 'creator'|'audience'|null {
  return !hasCreator ? 'creator' : profileCount === 0 ? 'audience' : null;
}

export function signupError(error: unknown): string {
  const code = String((error as {code?: string})?.code ?? '');
  if (code.includes('rate_limit') || code === 'over_email_send_rate_limit') return 'Too many requests. Please wait a minute before trying again.';
  if (code === 'weak_password') return 'Choose a stronger password with at least 12 characters.';
  if (code === 'signup_disabled') return 'Account creation is temporarily unavailable. Please try again later.';
  return 'We could not complete this request. Check your connection and try again, or use Sign in / Reset password if you already have an account.';
}
