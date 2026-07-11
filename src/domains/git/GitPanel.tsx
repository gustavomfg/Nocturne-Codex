import { useState } from 'react'
import { Check, GitBranch } from 'lucide-react'
import type { GitInfo } from '../../types'
import { errorMessage } from '../../shared/format'

export function GitPanel({ activeId, gitInfo, onRefresh, onError }: { activeId: string | null; gitInfo: GitInfo; onRefresh(): void; onError(value: string): void }) {
  const [commitMessage, setCommitMessage] = useState('')
  const commit = async () => { if (!activeId || !commitMessage.trim()) return; try { await window.nocturne.git.commit(activeId, commitMessage); setCommitMessage(''); onRefresh() } catch (error) { onError(errorMessage(error)) } }
  return <div className="git-panel"><div className="diff-title"><GitBranch size={14}/>Git · {gitInfo.branch}</div><pre>{gitInfo.status || 'Workspace limpo'}</pre><div className="commit-row"><input value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Mensagem do commit"/><button disabled={!commitMessage.trim() || !gitInfo.status} onClick={commit}><Check size={13}/></button></div></div>
}
