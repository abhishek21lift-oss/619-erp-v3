import type { Client } from './api';

const INDIA_CODE = '91';

export function whatsappNumber(mobile?: string | null, countryCode?: string | null) {
  const digits = String(mobile || '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length > 10) return digits;

  const cc = String(countryCode || INDIA_CODE).replace(/\D/g, '') || INDIA_CODE;
  return `${cc}${digits}`;
}

export function whatsappHref(
  mobile?: string | null,
  message = '',
  countryCode?: string | null,
) {
  const phone = whatsappNumber(mobile, countryCode);
  if (!phone) return '';
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${phone}${text}`;
}

export function memberWhatsAppMessage(client: Pick<Client, 'name' | 'pt_end_date' | 'balance_amount'>) {
  const parts = [`Hi ${client.name || 'there'}, this is 619 Fitness Studio.`];
  if (client.pt_end_date) parts.push(`Your membership end date is ${client.pt_end_date}.`);
  if (Number(client.balance_amount || 0) > 0) {
    parts.push(`Your pending balance is Rs ${Number(client.balance_amount || 0).toLocaleString('en-IN')}.`);
  }
  parts.push('Please reply here if you need any help.');
  return parts.join(' ');
}
