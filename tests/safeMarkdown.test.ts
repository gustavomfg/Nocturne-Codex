import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { safeExternalUrl } from '../src/shared/markdownSecurity'
import { SafeMarkdown } from '../src/shared/SafeMarkdown'

describe('links Markdown seguros', () => {
  it('aceita somente HTTPS absoluto', () => {
    expect(safeExternalUrl('https://example.com/path')).toBe('https://example.com/path')
  })
  it.each(['http://localhost:3000', 'javascript:alert(1)', 'file:///tmp/secret', 'data:text/html,test', '../relative.md', '/absolute'])('bloqueia %s', (value) => expect(safeExternalUrl(value)).toBeNull())
  it('não renderiza imagens nem HTML fornecidos pelo modelo', () => {
    const rendered = renderToStaticMarkup(SafeMarkdown({
      children: '![rastreador](https://example.com/pixel.png)\n\n<img src="data:image/svg+xml,hostil">',
    }))
    expect(rendered).not.toContain('<img')
    expect(rendered).toContain('&lt;img src=&quot;data:image')
    expect(rendered).toContain('rastreador')
  })
})
