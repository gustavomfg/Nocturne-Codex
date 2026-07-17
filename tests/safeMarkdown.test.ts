import { describe, expect, it } from 'vitest'
import { safeExternalUrl } from '../src/shared/markdownSecurity'

describe('links Markdown seguros', () => {
  it('aceita somente HTTPS absoluto', () => {
    expect(safeExternalUrl('https://example.com/path')).toBe('https://example.com/path')
  })
  it.each(['http://localhost:3000', 'javascript:alert(1)', 'file:///tmp/secret', 'data:text/html,test', '../relative.md', '/absolute'])('bloqueia %s', (value) => expect(safeExternalUrl(value)).toBeNull())
})
