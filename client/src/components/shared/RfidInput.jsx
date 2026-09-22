// src/components/shared/RfidInput.jsx
// Text box for a card ID (USB reader, phone scanner or typing) that never
// shows the whole ID: away from the box it reads "•••• •••• 1A2B", and while
// you're in it the characters show as dots (Chrome/Edge/Safari). Drop-in for
// <input>: same props, and it forwards the ref so autofocus/refocus still work.
import React, { forwardRef, useState } from 'react';
import { maskRfid } from '../../utils/rfidConverter';

const RfidInput = forwardRef(function RfidInput({ value = '', onFocus, onBlur, style, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      ref={ref}
      type="text"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      value={focused || !value ? value : maskRfid(value)}
      style={focused ? { ...style, WebkitTextSecurity: 'disc' } : style}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
    />
  );
});

export default RfidInput;
