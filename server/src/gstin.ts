/**
 * GSTIN validation, including the official check-digit algorithm.
 *
 * A GSTIN is 15 characters:
 *   [2 digit state code][10 char PAN][1 entity code][Z][1 check digit]
 *
 * The 15th character is a checksum computed over the first 14 using a
 * "Luhn mod N" scheme over the 36-character alphabet 0-9 A-Z.
 */

const CODEPOINT_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MOD = CODEPOINT_CHARS.length; // 36

const STRUCTURE =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/** Compute the check digit character for the first 14 chars of a GSTIN. */
export function gstinCheckDigit(first14: string): string {
  const input = first14.toUpperCase();
  let factor = 2;
  let sum = 0;
  for (let i = input.length - 1; i >= 0; i--) {
    const codePoint = CODEPOINT_CHARS.indexOf(input[i]!);
    if (codePoint < 0) return ''; // invalid character
    let digit = factor * codePoint;
    factor = factor === 2 ? 1 : 2;
    digit = Math.floor(digit / MOD) + (digit % MOD);
    sum += digit;
  }
  const checkCodePoint = (MOD - (sum % MOD)) % MOD;
  return CODEPOINT_CHARS[checkCodePoint]!;
}

/** True if the string has a structurally valid GSTIN shape (no checksum check). */
export function isValidGstinStructure(gstin: string): boolean {
  return STRUCTURE.test(gstin.toUpperCase());
}

/** Full validation: structure AND correct check digit. */
export function isValidGstin(gstin: string): boolean {
  const g = gstin.toUpperCase();
  if (!isValidGstinStructure(g)) return false;
  return gstinCheckDigit(g.slice(0, 14)) === g[14];
}
