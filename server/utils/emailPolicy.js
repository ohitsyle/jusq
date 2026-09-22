// server/utils/emailPolicy.js
// Which email addresses NUCash accounts may use — students, employees and
// admins, everywhere they are created or have their email changed (kiosk and
// app self-registration, System Admin, Treasury registration). Merchant and
// driver accounts are not covered.
//
// Set ACCOUNT_EMAIL_DOMAINS in the server .env to limit it, then restart:
//   ACCOUNT_EMAIL_DOMAINS=nu-laguna.edu.ph,students.nu-laguna.edu.ph
// Unset or empty = any email address (the setting while the system is being
// presented). The kiosk, the app and the admin forms read the same list from
// GET /api/system/email-policy, so nothing else needs changing.

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function accountEmailDomains() {
  return String(process.env.ACCOUNT_EMAIL_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

// null when the email can be used, otherwise the reason to show the person
export function accountEmailProblem(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(value)) return 'Please enter a valid email address.';
  const domains = accountEmailDomains();
  if (domains.length && !domains.includes(value.split('@')[1])) {
    return `Please use a school email (…@${domains.join(' or …@')}).`;
  }
  return null;
}
