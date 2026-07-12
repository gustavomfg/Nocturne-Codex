import { useEffect, useState } from 'react'
import { Check, GitBranch } from 'lucide-react'
import type { GitInfo } from '../../types'
import { errorMessage } from '../../shared/format'

export function GitPanel({ activeId, gitInfo, onRefresh, onError }: { activeId: string | null; gitInfo: GitInfo; onRefresh(): void; onError(value: string): void }) {
  const [commitMessage, setCommitMessage] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => setSelected(gitInfo.files.map((file) => file.path)), [gitInfo.files])
  const toggle = (file: string) => setSelected((current) => current.includes(file) ? current.filter((item) => item !== file) : [...current, file])
  const commit = async () => {
    if (!activeId || !commitMessage.trim() || !selected.length) return
    try { await window.nocturne.git.commit(activeId, commitMessage, selected); setCommitMessage(''); onRefresh() }
    catch (error) { onError(errorMessage(error)) }
  }
  return <div className="git-panel"><div className="diff-title"><GitBranch size={14}/>Git · {gitInfo.branch}<span>{selected.length}/{gitInfo.files.length}</span></div>
    <div className="git-file-list">{gitInfo.files.map((file) => <label key={file.path}><input type="checkbox" checked={selected.includes(file.path)} onChange={() => toggle(file.path)}/><span className="git-file-status">{file.status}</span><span title={file.path}>{file.path}</span></label>)}</div>
    {!gitInfo.files.length && <p className="git-clean">Workspace limpo</p>}
    <div className="commit-row"><label className="sr-only" htmlFor="commit-message">Mensagem do commit</label><input id="commit-message" value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Mensagem do commit"/><button aria-label="Criar commit com arquivos selecionados" title="Criar commit" disabled={!commitMessage.trim() || !selected.length} onClick={commit}><Check size={13}/></button></div>
  </div>
}
