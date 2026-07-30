import { AIConnectionPage } from './AIConnectionPage'

interface AISettingsPageProps {
  workspaceId: string
  onNotify(message: string): void
  onCodexModelChange(modelId: string): Promise<void>
}

export function AISettingsPage({
  workspaceId,
  onNotify,
  onCodexModelChange,
}: AISettingsPageProps) {
  return <div className="ai-settings" role="region" aria-label="Configuração de IA">
    <AIConnectionPage
      workspaceId={workspaceId}
      onNotify={onNotify}
      onCodexModelChange={onCodexModelChange}
    />
  </div>
}
