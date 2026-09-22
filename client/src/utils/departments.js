// client/src/utils/departments.js
// Readable department names for a concern's `reportTo`, which is stored as a
// department code (sysad, treasury, motorpool, …), an older office name, or a
// merchant's business name.
const NAMES = {
  sysad: 'System Administrator',
  itso: 'System Administrator',
  treasury: 'Treasury',
  'treasury office': 'Treasury',
  motorpool: 'Motorpool',
  'nu shuttle service': 'Motorpool',
  merchant: 'Merchants',
  merchants: 'Merchants',
  'merchant office': 'Merchants',
  accounting: 'Accounting',
  marketing: 'Marketing',
};

export function departmentName(reportTo) {
  if (!reportTo) return 'N/A';
  return NAMES[String(reportTo).trim().toLowerCase()] || reportTo; // merchant names stay as they are
}
