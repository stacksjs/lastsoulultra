/** Only a public HQ receipt hint may cross the website's embedding boundary. */
export function publicCheckoutReceipt(value: unknown): string {
  return typeof value === 'string' && /^\d{1,16}$/.test(value) ? value : ''
}
