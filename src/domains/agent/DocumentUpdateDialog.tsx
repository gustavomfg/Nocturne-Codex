import { createPortal } from 'react-dom'
import { FileText, X } from 'lucide-react'
import type { DocumentUpdatePreview } from '../../types'
import { useDialogA11y } from '../../shared/useDialogA11y'

interface Props {
  preview: DocumentUpdatePreview
  busy: boolean
  onClose(): void
  onApply(strategy: 'append' | 'replace'): void
}

export function DocumentUpdateDialog({ preview, busy, onClose, onApply }: Props) {
  const dialogRef = useDialogA11y<HTMLElement>(onClose)
  const exists = preview.expectedHash !== null
  return createPortal(
    <div className="preview-backdrop" onMouseDown={() => { if (!busy) onClose() }}>
      <section
        ref={dialogRef}
        className="document-update-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-update-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div><FileText size={18}/><span><strong id="document-update-title">{exists ? 'Revisar atualização' : 'Revisar novo documento'}</strong><small>{preview.name}</small></span></div>
          <button disabled={busy} aria-label="Fechar comparação" title="Fechar" onClick={onClose}><X size={17}/></button>
        </header>
        <div className="document-update-body">
          <p>Compare o conteúdo antes de gravar. Nenhuma alteração foi feita no arquivo.</p>
          <div className="document-update-comparison">
            <section>
              <h3>{exists ? 'Documento atual' : 'Novo arquivo'}</h3>
              <pre>{exists ? preview.existing : 'O arquivo ainda não existe.'}</pre>
            </section>
            <section>
              <h3>Conteúdo proposto</h3>
              <pre>{preview.generated}</pre>
            </section>
          </div>
        </div>
        <footer>
          <button disabled={busy} onClick={onClose}>Cancelar</button>
          {exists && <button disabled={busy} onClick={() => onApply('append')}>{busy ? 'Aplicando…' : 'Anexar conteúdo'}</button>}
          <button className="primary" disabled={busy} onClick={() => onApply('replace')}>{busy ? 'Aplicando…' : exists ? 'Substituir documento' : 'Criar documento'}</button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
