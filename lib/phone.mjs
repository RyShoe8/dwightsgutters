// Format US numbers consistently without truncating international numbers or extensions.
export function formatPhone(value = '') {
  const original = String(value ?? '').trim();
  const extension = original.match(/\s*(?:ext\.?|x|#)\s*(\d+)$/i);
  const number = extension ? original.slice(0, extension.index).trim() : original;
  let digits = number.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10 || /[a-z]/i.test(number)) return original;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}${extension ? ` ext. ${extension[1]}` : ''}`;
}
