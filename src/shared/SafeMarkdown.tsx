import type { ComponentProps, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import { safeExternalUrl } from './markdownSecurity'

function SafeLink({ href, children }: ComponentProps<'a'>) {
  const external = safeExternalUrl(href)
  return external ? <a href={external} target="_blank" rel="noreferrer noopener">{children}</a> : <span className="blocked-markdown-link" title="Link não permitido">{children}</span>
}

export function SafeMarkdown({ children }: { children: ReactNode }) {
  return <ReactMarkdown components={{ a: SafeLink }}>{String(children ?? '')}</ReactMarkdown>
}
