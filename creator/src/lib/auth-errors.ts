export function signInError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
  if (code === 'over_email_send_rate_limit') return 'The sign-in email limit has been reached. Wait for the email quota to reset; repeated attempts will not help. The workspace administrator needs to configure a production email provider.';
  if (code === 'email_address_not_authorized') return 'This email address cannot receive sign-in emails from the current test email service. A production email provider must be configured before everyone can sign in.';
  if (code === 'over_request_rate_limit' || status === 429) return 'Too many sign-in attempts. Please wait before requesting another email link.';
  if (code === 'email_address_invalid' || code === 'validation_failed') return 'Enter a valid email address and try again.';
  if (code === 'signup_disabled') return 'New account registration is currently disabled. Contact the workspace administrator.';
  return 'The sign-in email could not be sent. Please check your connection. If this continues, the workspace administrator needs to check email delivery.';
}
