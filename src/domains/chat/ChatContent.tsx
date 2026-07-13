import { memo } from 'react'
import { Code2, FileCode2, FolderOpen, GitBranch, MessageSquarePlus, Paperclip, Sparkles } from 'lucide-react'
import type { Message } from '../../types'
import { SafeMarkdown } from '../../shared/SafeMarkdown'

export function Welcome({ onNew, onWorkspace, onPrompt }: { onNew(): void; onWorkspace(): void; onPrompt(prompt: string): void }) {
  return <div className="welcome"><div className="welcome-orb"><Sparkles size={30}/></div><h2>O que vamos construir?</h2><p>Converse com o Codex, explore seu projeto e transforme ideias em código — com você no controle.</p><div className="welcome-actions"><button onClick={onWorkspace}><FolderOpen size={17}/>Abrir projeto</button><button onClick={onNew}><MessageSquarePlus size={17}/>Nova conversa</button></div><div className="suggestions" aria-label="Modelos de pedido"><button onClick={() => onPrompt('Analise este projeto. Explique a arquitetura, dependências, pontos de entrada, riscos e sugira próximos passos práticos.')}><Code2/><span><strong>Analisar este projeto</strong><small>Preencha o pedido para revisar antes de enviar</small></span></button><button onClick={() => onPrompt('Crie uma documentação completa deste projeto em Markdown, incluindo instalação, arquitetura, uso, scripts e solução de problemas. Salve em DOCUMENTACAO.md.')}><FileCode2/><span><strong>Criar documentação</strong><small>Prepare a instrução sem iniciar automaticamente</small></span></button><button onClick={() => onPrompt('Revise todas as alterações Git atuais. Aponte bugs, riscos, problemas de segurança e testes ausentes. Não modifique arquivos sem pedir.')}><GitBranch/><span><strong>Revisar alterações</strong><small>Confira o escopo antes de executar</small></span></button></div></div>
}

export const MessageBubble = memo(function MessageBubble({ message }: { message: Message }) {
  if (message.role !== 'user') return <AssistantMessage content={message.content}/>
  let attachments: string[] = []
  try { attachments = JSON.parse(message.metadata || '{}').attachments || [] } catch { attachments = [] }
  return <div className="user-row"><div className="user-message">{message.content}{!!attachments.length && <div className="message-attachments">{attachments.map((filePath) => <span key={filePath}><Paperclip size={10}/>{filePath.split(/[/\\]/).pop()}</span>)}</div>}</div><div className="mini-avatar">G</div></div>
})

export function AssistantMessage({ content, streaming }: { content: string; streaming?: boolean }) {
  const renderAsText = content.length > 300_000
  return <div className="assistant-row"><div className="assistant-avatar"><Sparkles size={15}/></div><div className="assistant-content"><div className="assistant-name">Nocturne Codex {streaming && <span>escrevendo</span>}</div>{renderAsText ? <><p>Resposta extensa; renderização Markdown simplificada para preservar estabilidade.</p><pre className="large-response">{content.slice(-300_000)}</pre></> : <SafeMarkdown>{content}</SafeMarkdown>}{streaming && <span className="caret"/>}</div></div>
}
