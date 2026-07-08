import React from 'react';
import {
  CalendarClock, CalendarDays, CalendarRange, Calendar, Clock,
  Save, Loader2, X, CheckCircle2, AlertTriangle, Check,
  CreditCard, Banknote, Users, Store, UserCog, ClipboardList,
  MessageSquare, Coins, User, Route, MapPin, Bus, Smartphone, Database
} from 'lucide-react';
import { ThemedSelect } from '../shared/ThemedControls';

// Maps an export-type value to a lucide icon so every admin's schedule modal
// uses consistent iconography (no emojis).
const TYPE_ICONS = {
  Transactions: CreditCard,
  'Cash-Ins': Banknote,
  Users: Users,
  Merchants: Store,
  Admins: UserCog,
  Logs: ClipboardList,
  Concerns: MessageSquare,
  Balances: Coins,
  Drivers: User,
  Routes: Route,
  Trips: MapPin,
  Shuttles: Bus,
  Phones: Smartphone,
};

const FREQUENCIES = [
  { value: 'daily', label: 'Daily', Icon: CalendarDays, desc: 'Every day' },
  { value: 'weekly', label: 'Weekly', Icon: CalendarRange, desc: 'Once a week' },
  { value: 'monthly', label: 'Monthly', Icon: Calendar, desc: 'Once a month' },
];

const WEEKDAYS = [
  { value: 0, short: 'Sun' },
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
];

// "HH:MM" (24h) -> { hour12, minute, period }
function parse24(hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map((n) => parseInt(n, 10) || 0);
  const period = h >= 12 ? 'PM' : 'AM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute: m, period };
}

// { hour12, minute, period } -> "HH:MM" (24h)
function build24(hour12, minute, period) {
  let h = hour12 % 12;
  if (period === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export default function ScheduleExportModal({
  theme, isDarkMode, configurations, setConfigurations, exportTypes, loading, onSave, onCancel,
}) {
  const accentColor = theme.accent.primary;
  const auto = configurations.autoExport || {};
  const selectedTypes = auto.exportTypes || [];

  const setAuto = (patch) =>
    setConfigurations({ ...configurations, autoExport: { ...auto, ...patch } });

  const { hour12, minute, period } = parse24(auto.time);

  const fieldBg = isDarkMode ? 'rgba(15,18,39,0.6)' : '#F9FAFB';

  const toggleType = (value) => {
    const next = selectedTypes.includes(value)
      ? selectedTypes.filter((t) => t !== value)
      : [...selectedTypes, value];
    setAuto({ exportTypes: next });
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={() => !loading && onCancel()}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        style={{
          background: isDarkMode ? 'linear-gradient(160deg, #1E2347 0%, #161A38 100%)' : '#FFFFFF',
          borderColor: `${accentColor}40`,
        }}
        className="relative rounded-2xl shadow-2xl border w-full max-w-lg max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{ background: `linear-gradient(135deg, ${accentColor}33 0%, ${accentColor}0D 100%)` }}
          className="px-6 py-5 flex items-start justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div
              style={{ background: `${accentColor}26` }}
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            >
              <CalendarClock className="w-6 h-6" style={{ color: accentColor }} />
            </div>
            <div>
              <h3 style={{ color: theme.text.primary }} className="text-xl font-bold leading-tight">Configure Export Schedule</h3>
              <p style={{ color: theme.text.secondary }} className="text-sm mt-0.5">Set when and how often data is exported automatically.</p>
            </div>
          </div>
          <button
            onClick={() => !loading && onCancel()}
            style={{ color: theme.text.secondary }}
            className="hover:opacity-70 transition flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(92vh-188px)]">
          {/* Enable Toggle */}
          <button
            onClick={() => setAuto({ enabled: !auto.enabled })}
            style={{
              background: auto.enabled ? `${accentColor}14` : isDarkMode ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)',
              borderColor: auto.enabled ? `${accentColor}55` : 'rgba(239,68,68,0.3)',
            }}
            className="w-full flex items-center justify-between p-4 rounded-xl border text-left transition"
          >
            <div className="flex items-center gap-3">
              {auto.enabled
                ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: '#22C55E' }} />
                : <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: '#EF4444' }} />}
              <div>
                <div style={{ color: theme.text.primary }} className="font-bold text-sm">Enable Automatic Export</div>
                <div style={{ color: theme.text.secondary }} className="text-xs mt-0.5">
                  {auto.enabled ? 'Auto-export is active' : 'Auto-export is disabled'}
                </div>
              </div>
            </div>
            <span
              style={{ background: auto.enabled ? '#22C55E' : '#6B7280' }}
              className="relative inline-block w-[52px] h-7 rounded-full transition-colors flex-shrink-0"
            >
              <span
                style={{ left: auto.enabled ? '26px' : '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.25)' }}
                className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all"
              />
            </span>
          </button>

          {/* Frequency segmented control */}
          <div>
            <label style={{ color: accentColor }} className="block text-xs font-bold uppercase tracking-wide mb-2">Frequency</label>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCIES.map(({ value, label, Icon, desc }) => {
                const active = (auto.frequency || 'daily') === value;
                return (
                  <button
                    key={value}
                    onClick={() => setAuto({ frequency: value })}
                    style={{
                      background: active ? `${accentColor}1A` : fieldBg,
                      borderColor: active ? accentColor : theme.border.primary,
                      color: active ? accentColor : theme.text.secondary,
                    }}
                    className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-bold" style={{ color: active ? accentColor : theme.text.primary }}>{label}</span>
                    <span className="text-[10px]" style={{ color: theme.text.secondary }}>{desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Weekly -> day of week */}
            {auto.frequency === 'weekly' && (
              <div className="mt-3">
                <label style={{ color: theme.text.secondary }} className="block text-[11px] font-semibold uppercase tracking-wide mb-2">Day of week</label>
                <div className="grid grid-cols-7 gap-1.5">
                  {WEEKDAYS.map(({ value, short }) => {
                    const active = (auto.dayOfWeek ?? 0) === value;
                    return (
                      <button
                        key={value}
                        onClick={() => setAuto({ dayOfWeek: value })}
                        style={{
                          background: active ? accentColor : fieldBg,
                          borderColor: active ? accentColor : theme.border.primary,
                          color: active ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.primary,
                        }}
                        className="py-2 rounded-lg border text-xs font-bold transition"
                      >
                        {short}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Monthly -> day of month */}
            {auto.frequency === 'monthly' && (
              <div className="mt-3">
                <label style={{ color: theme.text.secondary }} className="block text-[11px] font-semibold uppercase tracking-wide mb-2">Day of month</label>
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                    const active = (auto.dayOfMonth ?? 1) === d;
                    return (
                      <button
                        key={d}
                        onClick={() => setAuto({ dayOfMonth: d })}
                        style={{
                          background: active ? accentColor : fieldBg,
                          borderColor: active ? accentColor : theme.border.primary,
                          color: active ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.primary,
                        }}
                        className="py-1.5 rounded-lg border text-xs font-bold transition"
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Time picker */}
          <div>
            <label style={{ color: accentColor }} className="block text-xs font-bold uppercase tracking-wide mb-2">Export Time</label>
            <div
              style={{ background: fieldBg, borderColor: theme.border.primary }}
              className="flex items-center gap-2 p-2 rounded-xl border"
            >
              <Clock className="w-5 h-5 ml-1 flex-shrink-0" style={{ color: accentColor }} />

              <ThemedSelect
                value={hour12}
                onChange={(e) => setAuto({ time: build24(parseInt(e.target.value, 10), minute, period) })}
                style={{ background: 'transparent', color: theme.text.primary }}
                className="flex-1 px-2 py-2 rounded-lg text-base font-bold text-center focus:outline-none cursor-pointer appearance-none"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h} style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', color: theme.text.primary }}>
                    {String(h).padStart(2, '0')}
                  </option>
                ))}
              </ThemedSelect>

              <span style={{ color: theme.text.secondary }} className="text-xl font-bold">:</span>

              <ThemedSelect
                value={minute}
                onChange={(e) => setAuto({ time: build24(hour12, parseInt(e.target.value, 10), period) })}
                style={{ background: 'transparent', color: theme.text.primary }}
                className="flex-1 px-2 py-2 rounded-lg text-base font-bold text-center focus:outline-none cursor-pointer appearance-none"
              >
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                  <option key={m} value={m} style={{ background: isDarkMode ? '#1E2347' : '#FFFFFF', color: theme.text.primary }}>
                    {String(m).padStart(2, '0')}
                  </option>
                ))}
              </ThemedSelect>

              <div className="flex gap-1 pr-1">
                {['AM', 'PM'].map((p) => {
                  const active = period === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setAuto({ time: build24(hour12, minute, p) })}
                      style={{
                        background: active ? accentColor : 'transparent',
                        color: active ? (isDarkMode ? '#181D40' : '#FFFFFF') : theme.text.secondary,
                        borderColor: active ? accentColor : theme.border.primary,
                      }}
                      className="px-3 py-2 rounded-lg border text-sm font-bold transition"
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Data Types */}
          <div>
            <label style={{ color: accentColor }} className="block text-xs font-bold uppercase tracking-wide mb-3">Data Types to Export</label>
            <div className="grid grid-cols-2 gap-2">
              {exportTypes.map((type) => {
                const Icon = TYPE_ICONS[type.value] || Database;
                const active = selectedTypes.includes(type.value);
                return (
                  <button
                    key={type.value}
                    onClick={() => toggleType(type.value)}
                    style={{
                      background: active ? `${accentColor}1A` : fieldBg,
                      borderColor: active ? accentColor : theme.border.primary,
                    }}
                    className="flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition text-left"
                  >
                    <span
                      style={{
                        background: active ? accentColor : 'transparent',
                        borderColor: active ? accentColor : theme.border.primary,
                      }}
                      className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition"
                    >
                      {active && <Check className="w-3.5 h-3.5" style={{ color: isDarkMode ? '#181D40' : '#FFFFFF' }} strokeWidth={3} />}
                    </span>
                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? accentColor : theme.text.secondary }} />
                    <span style={{ color: theme.text.primary }} className="text-sm font-semibold truncate">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{ borderColor: theme.border.primary, background: isDarkMode ? 'rgba(0,0,0,0.15)' : '#FAFAFA' }}
          className="flex gap-3 px-6 py-4 border-t"
        >
          <button
            onClick={onSave}
            disabled={loading}
            style={{ background: accentColor, color: isDarkMode ? '#181D40' : '#FFFFFF' }}
            className="flex-1 py-3 rounded-xl font-bold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{ background: isDarkMode ? 'rgba(71,85,105,0.5)' : '#E5E7EB', color: theme.text.primary }}
            className="flex-1 py-3 rounded-xl font-semibold hover:opacity-80 transition disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
