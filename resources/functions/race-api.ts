import { sharedRequest, state } from '@stacksjs/stx'
import { useSessionStorage } from '@stacksjs/composables'

/** The established LSU race identity. It is separate from the HQ coaching session. */
export function raceAccount() {
  const stored = useSessionStorage('lsu.runner.session', '', { serializer: { read: raw => raw, write: value => value } })
  const user = state<any>(null)
  const applications = state<any[]>([])
  const events = state<any[]>([])
  const busy = state(false)
  const error = state('')
  const message = state('')
  const mode = state('login')
  const signedIn = state(Boolean(stored.value))
  const owners = sharedRequest()
  let currentOwner = owners.latest()

  async function request(path: string, method = 'GET', body?: unknown) {
    const token = stored.value
    const response = await fetch(`https://api.lastsoulultra.com/v1${path}`, {
      method,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const result = response.status === 204 ? null : await response.json()
    if (!response.ok) {
      if (response.status === 401 && stored.value === token) {
        currentOwner = owners.latest()
        stored.value = ''
        signedIn.set(false)
        user.set(null)
        applications.set([])
      }
      const detail = result?.error || result
      throw new Error(detail?.message || `The request could not be completed (${response.status})`)
    }
    return result
  }

  async function load() {
    const valid = currentOwner
    error.set('')
    try {
      const catalog = await request('/events')
      if (!valid()) return
      events.set(catalog.upcoming || [])
      if (stored.value) {
        const [profile, entries] = await Promise.all([request('/me'), request('/me/applications')])
        if (!valid()) return
        user.set(profile)
        applications.set(entries)
        signedIn.set(true)
      }
    }
    catch (cause) { if (valid()) error.set(cause instanceof Error ? cause.message : 'Please try again') }
  }

  async function authenticate(input: { first_name: string, last_name: string, email: string, password: string, code: string }) {
    if (busy()) return
    busy.set(true)
    error.set('')
    message.set('')
    try {
      const body = mode() === 'register' ? { first_name: input.first_name, last_name: input.last_name, email: input.email, password: input.password }
        : mode() === 'verify' ? { email: input.email, code: input.code }
          : mode() === 'forgot' ? { email: input.email }
            : mode() === 'reset' ? { email: input.email, code: input.code, password: input.password }
              : { email: input.email, password: input.password }
      const action = mode()
      const result = await request(`/auth/${action}`, 'POST', body)
      if (result?.token) {
        currentOwner = owners.latest()
        stored.value = result.token
        signedIn.set(true)
        await load()
      }
      else if (action === 'reset') {
        mode.set('login')
        message.set('Your password has been updated. Sign in to continue.')
      }
      else {
        mode.set(action === 'forgot' ? 'reset' : 'verify')
        message.set('Check your email for the verification code.')
      }
    }
    catch (cause) { error.set(cause instanceof Error ? cause.message : 'Please try again') }
    finally { busy.set(false) }
  }

  async function logout() {
    const pending = request('/auth/logout', 'POST')
    currentOwner = owners.latest()
    stored.value = ''
    signedIn.set(false)
    user.set(null)
    applications.set([])
    try { await pending }
    catch (cause) { error.set(cause instanceof Error ? cause.message : 'You are signed out on this device.') }
  }
  return { user, applications, events, busy, error, message, mode, signedIn, load, authenticate, logout, request }
}

export function formValues(event: Event): Record<string, FormDataEntryValue> {
  const form = event.currentTarget
  if (!(form instanceof HTMLFormElement)) throw new Error('Use the application form')
  return Object.fromEntries(new FormData(form))
}
