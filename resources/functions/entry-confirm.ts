/**
 * Confirming a race place, for a runner the LSU team has selected.
 *
 * Three things, in any order, before the deadline on the entry: sign the
 * participant agreement, save the race details (address, sizes, emergency
 * contact), and pay the entry fee. The service confirms the place itself the
 * moment the last one is done. These helpers are the pure parts; the profile
 * component owns the state and the requests.
 */

export const LOGISTICS_FIELDS = ['address_line1', 'city', 'postcode', 'country', 'phone', 'top_size', 'bottom_size', 'emergency_name', 'emergency_phone', 'emergency_relationship'] as const

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const

export interface EntryTasks { signed: boolean, details: boolean, paid: boolean, done: number }

export function entryTasks(entry: any): EntryTasks {
  const waiver = entry?.waiver || {}
  const signed = Boolean(waiver.signed_version_id) && waiver.signed_version_id === waiver.required_version_id
  const details = LOGISTICS_FIELDS.every(field => (entry?.logistics?.[field] ?? '') !== '')
  const paid = entry?.payment?.status === 'paid'
  return { signed, details, paid, done: [signed, details, paid].filter(Boolean).length }
}

/** Format the service's minor units without rounding away a payable fraction. */
export function entryFee(payment: any): string {
  if (!payment?.currency || !Number.isSafeInteger(payment.amount) || payment.amount < 0) return ''
  try {
    const format = new Intl.NumberFormat('en-GB', { style: 'currency', currency: payment.currency })
    const digits = format.resolvedOptions().maximumFractionDigits ?? 2
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: payment.currency, minimumFractionDigits: 0 }).format(payment.amount / 10 ** digits)
  }
  catch {
    return ''
  }
}

/** "Sunday 15 November, 18:00", in the reader's own time zone. */
export function entryDeadline(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date)
}

/** The first selected or confirmed entry with a place attached, which is the one to confirm. */
export function placeToConfirm(applications: any[]): any | null {
  return applications.find(item => ['selected', 'confirmed'].includes(item.application?.display_status || item.application?.status) && item.entry) || null
}

/** Where the payment provider sends the runner back to. */
export function profileReturnUrl(): string {
  return `${location.origin}/profile`
}

/** Only ever leave the site for an https checkout page the service handed back. */
export function openCheckout(url: unknown): boolean {
  try {
    const target = new URL(String(url))
    if (target.protocol !== 'https:') return false
    location.assign(target.toString())
    return true
  }
  catch {
    return false
  }
}

export const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

export interface EntryPaymentOutcome {
  status: 'paid' | 'failed' | 'pending' | 'unavailable' | 'abandoned'
  message: string
}

/** Confirm server state after checkout; the return URL is never payment proof. */
export async function confirmEntryPayment(options: {
  refresh: () => Promise<string>
  isCurrent?: () => boolean
  delay?: () => Promise<void>
  attempts?: number
}): Promise<EntryPaymentOutcome> {
  const attempts = options.attempts ?? 10
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 30) throw new Error('Payment confirmation needs 1 to 30 attempts')
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (options.isCurrent && !options.isCurrent()) return { status: 'abandoned', message: '' }
    try {
      const status = await options.refresh()
      if (options.isCurrent && !options.isCurrent()) return { status: 'abandoned', message: '' }
      if (status === 'paid') return { status: 'paid', message: 'Payment received. Thank you.' }
      if (status === 'failed') return { status: 'failed', message: 'The payment did not go through. Check your payment details and try again.' }
    }
    catch {
      return { status: 'unavailable', message: 'Your payment status could not be checked. Refresh to check it before trying to pay again.' }
    }
    if (attempt + 1 < attempts) await (options.delay ?? (() => wait(2000)))()
  }
  return { status: 'pending', message: 'Your payment is still being confirmed. Check your current status before trying to pay again.' }
}
