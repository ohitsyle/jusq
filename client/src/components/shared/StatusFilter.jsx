// src/admin/components/common/StatusFilter.jsx
// Status filter for toolbars — a compact dropdown ("Status: All ▾") so filter
// bars stay on one line. Same API as before: value, onChange(value), options.
import React from 'react';
import { FilterSelect } from './ThemedControls';

export default function StatusFilter({ value, onChange, options, label = 'Status' }) {
  return (
    <FilterSelect
      label={label}
      value={value}
      onChange={onChange}
      defaultValue=""
      options={[{ value: '', label: 'All' }, ...options]}
    />
  );
}
