'use client';
// Reopens the CookieScript consent banner so visitors can change their choice.
export default function CookieSettingsLink({ children = 'Cookie settings', className }) {
  return <a href="#cookie-settings" className={className} onClick={e => { e.preventDefault(); window.CookieScript?.instance?.show(); }}>{children}</a>;
}
