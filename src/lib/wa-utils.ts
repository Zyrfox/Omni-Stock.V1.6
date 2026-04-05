export const DEFAULT_WA_TEMPLATE =
  "Assalammualaikum ka, kami dari {outlet} ingin mengajukan pesanan..........";

export function formatWANumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("62")) return digits;
  return digits;
}

export function buildWAUrl(
  phone: string,
  template: string,
  outletName: string,
): string {
  const text = template.replace(/\{outlet\}/g, outletName);
  return `https://wa.me/${formatWANumber(phone)}?text=${encodeURIComponent(text)}`;
}
