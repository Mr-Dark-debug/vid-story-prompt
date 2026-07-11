export function isForbiddenAddress(address: string) {
  if (address === "0.0.0.0" || address === "::" || address === "::1") return true;
  if (address.includes(":")) { const value = address.toLowerCase(); return value.startsWith("fc") || value.startsWith("fd") || /^fe[89ab]/.test(value) || value.startsWith("::ffff:127.") || value.startsWith("::ffff:10.") || value.startsWith("::ffff:192.168."); }
  const parts = address.split(".").map(Number); const [a,b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224 || address === "169.254.169.254";
}
