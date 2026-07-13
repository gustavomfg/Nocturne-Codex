import { describe, expect, it } from 'vitest'
import { safeExternalUrl } from '../src/shared/markdownSecurity'

describe('links Markdown seguros', () => {
  it('aceita somente HTTP e HTTPS absolutos', () => {
    expect(safeExternalUrl('https://example.com/path')).toBe('https://example.com/path')
    expect(safeExternalUrl('http://localhost:3000')).toBe('http://localhost:3000/')
  })
  it.each(['javascript:alert(1)', 'file:///tmp/secret', 'data:text/html,test', '../relative.md', '/absolute'])('bloqueia %s', (value) => expect(safeExternalUrl(value)).toBeNull())
})
