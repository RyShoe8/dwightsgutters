'use client';
import { formatPhone } from '../lib/phone.mjs';
export default function PhoneInput({ onChange, onBlur, ...props }) {
  return <input type="tel" placeholder="555-555-5555" {...props} onChange={onChange} onBlur={event => {
    event.target.value = formatPhone(event.target.value);
    onChange?.(event);
    onBlur?.(event);
  }}/>;
}
