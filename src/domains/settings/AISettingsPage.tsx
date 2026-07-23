import { AIConnectionPage } from './AIConnectionPage'

interface AISettingsPageProps {
  workspaceId: string
  onNotify(message: string): void
}

export function AISettingsPage({
  workspaceId,
  onNotify,
}: AISettingsPageProps) {
  return <div className="ai-settings" role="region" aria-label="Configuração de IA">
    <AIConnectionPage
      workspaceId={workspaceId}
      onNotify={onNotify}
    />
  </div>
}
