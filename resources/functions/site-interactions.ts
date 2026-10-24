/** Small DOM adapters for STX refs; templates keep state and lifecycle ownership. */
export function moveGallery(element: HTMLElement | null, direction: number): void {
  element?.scrollBy({ left: direction * Math.max(240, element.clientWidth * 0.8), behavior: 'auto' })
}

export function galleryPosition(element: HTMLElement | null): { count: number, previous: boolean, next: boolean } {
  if (!element) return { count: 1, previous: false, next: true }
  const first = element.firstElementChild as HTMLElement | null
  const width = first?.getBoundingClientRect().width || 1
  return { count: Math.min(element.children.length, Math.max(1, Math.round((element.scrollLeft + element.clientWidth) / width))), previous: element.scrollLeft > 1, next: element.scrollLeft + element.clientWidth < element.scrollWidth - 2 }
}

export function nextLoop(now = Date.now()): string {
  const seconds = 3600 - (Math.floor(now / 1000) % 3600)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
