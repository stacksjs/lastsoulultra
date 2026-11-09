/**
 * The race-entry window, as the published site has it: every link to the entry
 * page opens one modal over the page you are on (Stage 1 sign in, Stage 2
 * request, Stage 3 complete) instead of leaving it. These are the DOM adapters
 * for it; RacePortal keeps the state.
 */

interface LinkLike { href: string, target?: string }
interface ClickLike {
  button: number
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  defaultPrevented?: boolean
  target: unknown
}

const ENTRY_PATH = /^\/(?:de\/)?lottery\/?$/

/**
 * The query of a plain left click on a same-origin link to the entry page, or
 * null for anything the browser should handle itself: another page, another
 * origin, a new tab or window, or a click something else already took.
 */
export function entryLinkQuery(event: ClickLike, origin: string): URLSearchParams | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return null
  const target = event.target as { closest?: (selector: string) => LinkLike | null } | null
  const link = typeof target?.closest === 'function' ? target.closest('a[href]') : null
  if (!link || (link.target && link.target !== '_self'))
    return null
  let url: URL
  try { url = new URL(link.href, origin) }
  catch { return null }
  return url.origin === origin && ENTRY_PATH.test(url.pathname) ? url.searchParams : null
}

/**
 * Open the window for every entry link on the page. Returns the way to stop.
 *
 * It listens on the window in the capture phase: the stx router takes link
 * clicks on the document and turns them into a page change, so a listener
 * there would only ever see the entry page load.
 */
export function onEntryLinks(open: (query: URLSearchParams) => void): () => void {
  const listener = (event: MouseEvent) => {
    const query = entryLinkQuery(event, location.origin)
    if (!query)
      return
    event.preventDefault()
    event.stopPropagation()
    open(query)
  }
  window.addEventListener('click', listener, true)
  return () => window.removeEventListener('click', listener, true)
}

/** The modal a portal sits in, if it sits in one. */
export function dialogAround(element: Element | null | undefined): HTMLDialogElement | null {
  return (element?.closest('dialog') as HTMLDialogElement | null) || null
}

export function showDialog(dialog: HTMLDialogElement | null): void {
  if (dialog && !dialog.open)
    dialog.showModal()
}

export function closeDialog(dialog: HTMLDialogElement | null): void {
  if (dialog?.open)
    dialog.close()
}

/** A press that started and ended on the backdrop, outside the window's box. */
export function onBackdrop(event: { target: unknown, currentTarget: unknown, clientX: number, clientY: number }): boolean {
  const dialog = event.currentTarget as { getBoundingClientRect?: () => { left: number, right: number, top: number, bottom: number } } | null
  if (!dialog || event.target !== dialog || typeof dialog.getBoundingClientRect !== 'function')
    return false
  const box = dialog.getBoundingClientRect()
  return event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom
}
