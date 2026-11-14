import { relative, resolve, sep } from 'node:path'

/** Audit the rendered links, including fragments and relative asset paths. */
export function documentationLinkAudit(root: string) {
  const ids = new Map<string, Promise<Set<string>>>()
  async function anchors(path: string): Promise<Set<string>> {
    let pending = ids.get(path)
    if (!pending) {
      pending = (async () => {
        const found = new Set<string>()
        await new HTMLRewriter().on('[id], a[name]', {
          element(element) {
            const id = element.getAttribute('id') || element.getAttribute('name')
            if (id) found.add(id)
          },
        }).transform(new Response(await Bun.file(path).text())).text()
        return found
      })()
      ids.set(path, pending)
    }
    return pending
  }

  return async (path: string, html: string, specimen = false): Promise<string[]> => {
    const errors: string[] = []
    const references: { attribute: string, value: string }[] = []
    await new HTMLRewriter().on('[href], [src]', {
      element(element) {
        for (const attribute of ['href', 'src']) {
          const value = element.getAttribute(attribute)
          if (value) references.push({ attribute, value })
        }
      },
    }).transform(new Response(html)).text()
    const page = new URL(`/docs/${relative(root, path).split(sep).join('/')}`, 'https://lsu.stacksjs.com')
    for (const { attribute, value } of references) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) continue
      const url = new URL(value, page)
      if (url.pathname === '/docs') url.pathname = '/docs/'
      if (!url.pathname.startsWith('/docs/')) {
        // Isolated navigation examples deliberately link to website routes.
        if (!(specimen && attribute === 'href')) errors.push(`link escapes docs mount: ${value}`)
        continue
      }
      let local: string
      let fragment: string
      try {
        local = resolve(root, `.${decodeURIComponent(url.pathname.slice('/docs'.length))}`)
        fragment = decodeURIComponent(url.hash.slice(1))
      }
      catch {
        errors.push(`invalid linked URL: ${value}`)
        continue
      }
      if (!local.startsWith(`${resolve(root)}${sep}`) && local !== resolve(root)) {
        errors.push(`link escapes docs directory: ${value}`)
        continue
      }
      if (!await Bun.file(local).exists()) local = resolve(local, 'index.html')
      if (!await Bun.file(local).exists()) {
        errors.push(`missing linked artifact: ${value}`)
        continue
      }
      if (attribute === 'href' && fragment && local.endsWith('.html') && !(await anchors(local)).has(fragment))
        errors.push(`missing linked heading or anchor: ${value}`)
    }
    return errors
  }
}
