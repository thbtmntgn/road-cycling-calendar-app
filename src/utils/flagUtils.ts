export const countryToFlag = (code: string): string => {
  if (!code || code.length !== 2) return '🏁';
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
};
