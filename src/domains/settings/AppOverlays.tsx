import { lazy, Suspense } from 'react'
import type { CodexSettings, CodexStatus, FilePreview, Workspace, WorkspaceMemory } from '../../types'
import { loadSettingsDialog } from './loadSettingsDialog'

const SettingsDialog = lazy(loadSettingsDialog)
const MemoryDialog = lazy(() => import('./Dialogs').then((module) => ({ default: module.MemoryDialog })))
const OnboardingDialog = lazy(() => import('./Dialogs').then((module) => ({ default: module.OnboardingDialog })))
const PreviewDialog = lazy(() => import('./Dialogs').then((module) => ({ default: module.PreviewDialog })))

interface AppOverlaysProps {
  settingsOpen: boolean
  settings: CodexSettings
  status: CodexStatus
  workspaces: Workspace[]
  memoryOpen: boolean
  memory: WorkspaceMemory
  preview: FilePreview | null
  onboardingOpen: boolean
  activeId: string | null
  workspace: string
  onSettingsClose(): void
  onSaveSettings(value: CodexSettings): Promise<void>
  onNotify(message: string): void
  onOpenOnboarding(): void
  onMemoryClose(): void
  onSaveMemory(content: string, rules: string): Promise<void>
  onPreviewClose(): void
  onError(message: string | null): void
  onWorkspace(): Promise<void>
  onOpenSettings(): void
  onRecheck(): Promise<void>
  onDismissOnboarding(): void
  onCompleteOnboarding(): void
}

export function AppOverlays({ settingsOpen, settings, status, workspaces, memoryOpen, memory, preview, onboardingOpen, activeId, workspace, onSettingsClose, onSaveSettings, onNotify, onOpenOnboarding, onMemoryClose, onSaveMemory, onPreviewClose, onError, onWorkspace, onOpenSettings, onRecheck, onDismissOnboarding, onCompleteOnboarding }: AppOverlaysProps) {
  return <Suspense fallback={null}>
    {settingsOpen && <SettingsDialog value={settings} status={status} workspaces={workspaces} onClose={onSettingsClose} onSave={onSaveSettings} onNotify={onNotify} onOnboarding={onOpenOnboarding}/>}
    {memoryOpen && <MemoryDialog value={memory} onClose={onMemoryClose} onSave={onSaveMemory}/>}
    {preview && <PreviewDialog preview={preview} activeId={activeId} onClose={onPreviewClose} onError={onError} onNotify={onNotify}/>}
    {onboardingOpen && <OnboardingDialog settings={settings} status={status} hasWorkspace={Boolean(workspace)} onWorkspace={onWorkspace} onSettings={onOpenSettings} onRecheck={onRecheck} onDismiss={onDismissOnboarding} onComplete={onCompleteOnboarding}/>}
  </Suspense>
}
