// Single source of truth for export scoping per admin role:
//  - which export TYPES each role is allowed to export (whitelist), and
//  - the department-scoped DB queries for shared collections (logs, concerns,
//    phones) so one role never exports another department's data.

// Export types each role may export. Mirrors the client EXPORT_TYPES lists.
export const ROLE_EXPORT_TYPES = {
  motorpool: ['Drivers', 'Routes', 'Trips', 'Shuttles', 'Phones', 'Logs', 'Concerns'],
  merchant: ['Merchants', 'Phones', 'Logs', 'Concerns'],
  treasury: ['Transactions', 'Cash-Ins', 'Logs', 'Concerns'],
  accounting: ['Transactions', 'Cash-Ins', 'Balances', 'Logs'],
  sysad: ['Transactions', 'Users', 'Merchants', 'Admins', 'Logs', 'Concerns'],
  marketing: ['Logs'],
};

// Keep only the export types a given role is actually allowed to export.
export function filterTypesForRole(types, role) {
  if (!Array.isArray(types)) return [];
  const allowed = ROLE_EXPORT_TYPES[role];
  if (!allowed) return types; // unknown role (e.g. sysad/global) — allow all
  const norm = (t) => String(t).toLowerCase().replace(/\s+/g, '');
  const allowedNorm = new Set(allowed.map(norm));
  return types.filter((t) => allowedNorm.has(norm(t)));
}

// ---- Department-scoped queries for shared collections -----------------------

// EventLog: what logs a department can see. Mirrors the /admin/event-logs filter.
export function buildDepartmentLogQuery(role) {
  const excludeSysad = {
    $and: [
      { $or: [{ 'metadata.adminRole': { $ne: 'sysad' } }, { 'metadata.adminRole': { $exists: false } }] },
      { $or: [{ department: { $ne: 'sysad' } }, { department: { $exists: false } }] }
    ]
  };

  if (!role || role === 'sysad') return {};

  if (role === 'motorpool') {
    return {
      $or: [
        { eventType: { $in: ['login', 'logout'] }, 'metadata.adminRole': 'motorpool' },
        { eventType: { $in: ['login', 'logout'] }, department: 'motorpool' },
        { eventType: { $in: ['crud_create', 'crud_update', 'crud_delete'] }, 'metadata.adminRole': 'motorpool' },
        { eventType: { $in: ['note_added', 'note_updated', 'concern_resolved'] }, 'metadata.adminRole': 'motorpool' },
        { eventType: { $in: ['driver_login', 'driver_logout'] } },
        { eventType: 'shuttle_selection' },
        { eventType: 'driver_assignment' },
        { eventType: { $in: ['trip_start', 'trip_end', 'route_start', 'route_end', 'route_change', 'refund'] } },
        { eventType: { $in: ['phone_assigned', 'phone_unassigned'] }, 'metadata.adminRole': 'motorpool' },
        { eventType: { $in: ['auto_export_config_change', 'manual_export', 'export_manual', 'export_auto', 'config_updated'] }, 'metadata.adminRole': 'motorpool' },
        { department: 'motorpool' }
      ],
      ...excludeSysad
    };
  }

  if (role === 'merchant') {
    return {
      $or: [
        { eventType: { $in: ['login', 'logout'] }, 'metadata.adminRole': 'merchant' },
        { eventType: { $in: ['login', 'logout'] }, department: 'merchant' },
        { eventType: { $in: ['crud_create', 'crud_update', 'crud_delete'] }, 'metadata.adminRole': 'merchant' },
        { eventType: { $in: ['note_added', 'note_updated', 'concern_resolved'] }, 'metadata.adminRole': 'merchant' },
        { eventType: { $in: ['merchant_login', 'merchant_logout'] } },
        { eventType: { $in: ['auto_export_config_change', 'manual_export', 'export_manual', 'export_auto', 'config_updated'] }, 'metadata.adminRole': 'merchant' },
        { department: 'merchant' }
      ],
      ...excludeSysad
    };
  }

  if (role === 'treasury') {
    return {
      $or: [
        { eventType: { $in: ['login', 'logout'] }, 'metadata.adminRole': 'treasury' },
        { eventType: { $in: ['login', 'logout'] }, department: 'treasury' },
        { eventType: { $in: ['crud_create', 'crud_update', 'crud_delete'] }, 'metadata.adminRole': 'treasury' },
        { eventType: { $in: ['note_added', 'note_updated', 'concern_resolved'] }, 'metadata.adminRole': 'treasury' },
        { eventType: 'cash_in', 'metadata.adminRole': 'treasury' },
        { eventType: 'registration', 'metadata.adminRole': 'treasury' },
        { eventType: { $in: ['auto_export_config_change', 'manual_export', 'export_manual', 'export_auto', 'config_updated'] }, 'metadata.adminRole': 'treasury' },
        { department: 'treasury' }
      ],
      ...excludeSysad
    };
  }

  if (role === 'accounting') {
    return {
      $or: [
        { eventType: { $in: ['login', 'logout'] }, 'metadata.adminRole': 'accounting' },
        { eventType: { $in: ['login', 'logout'] }, department: 'accounting' },
        { eventType: { $in: ['crud_create', 'crud_update', 'crud_delete'] }, 'metadata.adminRole': 'accounting' },
        { eventType: { $in: ['auto_export_config_change', 'manual_export', 'export_manual', 'export_auto', 'config_updated'] }, 'metadata.adminRole': 'accounting' },
        { department: 'accounting' }
      ],
      ...excludeSysad
    };
  }

  if (role === 'marketing') {
    return {
      $or: [
        { eventType: { $in: ['login', 'logout'] }, 'metadata.adminRole': 'marketing' },
        { eventType: { $in: ['login', 'logout'] }, department: 'marketing' },
        { eventType: { $in: ['crud_create', 'crud_update', 'crud_delete'] }, 'metadata.adminRole': 'marketing' },
        { eventType: { $in: ['note_added', 'note_updated', 'concern_resolved'] }, 'metadata.adminRole': 'marketing' },
        { eventType: { $in: ['auto_export_config_change', 'manual_export', 'export_manual', 'export_auto', 'config_updated'] }, 'metadata.adminRole': 'marketing' },
        { department: 'marketing' }
      ],
      ...excludeSysad
    };
  }

  return { department: role };
}

// UserConcern: which concerns a department can see (by reportTo).
export function buildDepartmentConcernQuery(role) {
  if (!role || role === 'sysad') return {};
  if (role === 'motorpool') {
    return {
      $or: [
        { reportTo: 'NU Shuttle Service' },
        { reportTo: { $regex: 'motorpool', $options: 'i' } },
        { reportTo: { $regex: 'shuttle', $options: 'i' } }
      ]
    };
  }
  if (role === 'merchant') {
    return { $or: [{ reportTo: 'Merchant Office' }, { reportTo: { $regex: 'merchant', $options: 'i' } }] };
  }
  if (role === 'treasury' || role === 'accounting') {
    return { $or: [{ reportTo: 'Treasury Office' }, { reportTo: { $regex: 'treasury', $options: 'i' } }] };
  }
  return {};
}

// Phone: merchant phones vs driver phones (shared collection).
export function buildDepartmentPhoneQuery(role) {
  if (role === 'merchant') {
    return {
      $or: [
        { assignedMerchantId: { $ne: null } },
        { assignedDriverId: null, assignedMerchantId: null }
      ]
    };
  }
  if (role === 'motorpool') {
    return {
      $or: [
        { assignedDriverId: { $ne: null } },
        { assignedDriverId: null, assignedMerchantId: null }
      ]
    };
  }
  return {}; // sysad / unknown — all phones
}
