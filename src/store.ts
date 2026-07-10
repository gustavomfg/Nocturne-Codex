import { create } from 'zustand'
import type { Activity, Approval, ChangedFile, CodexStatus, Conversation, Message } from './types'

interface AppState {
  conversations: Conversation[]; activeId: string | null; messages: Message[]
  status: CodexStatus; streaming: string; diff: string; activities: Activity[]; approvals: Approval[]; files: ChangedFile[]; error: string | null
  setConversations(value: Conversation[]): void; setActive(id: string | null): void; setMessages(value: Message[]): void
  addMessage(value: Message): void; setStatus(value: CodexStatus): void; appendStream(value: string): void; clearRun(): void
  setDiff(value: string): void; upsertActivity(value: Activity): void; addApproval(value: Approval): void
  resolveApproval(key: string, status: 'accepted' | 'declined'): void; setError(value: string | null): void
  setFiles(value: ChangedFile[]): void; addFiles(value: ChangedFile[]): void
}

export const useAppStore = create<AppState>((set) => ({
  conversations: [], activeId: null, messages: [], status: 'offline', streaming: '', diff: '', activities: [], approvals: [], files: [], error: null,
  setConversations: (conversations) => set({ conversations }), setActive: (activeId) => set({ activeId }),
  setMessages: (messages) => set({ messages }), addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setStatus: (status) => set({ status }), appendStream: (value) => set((state) => ({ streaming: state.streaming + value })),
  clearRun: () => set({ streaming: '', diff: '', activities: [], approvals: [], files: [], error: null }), setDiff: (diff) => set({ diff }),
  upsertActivity: (activity) => set((state) => ({ activities: [...state.activities.filter((item) => item.id !== activity.id), activity] })),
  addApproval: (approval) => set((state) => ({ approvals: [...state.approvals.filter((item) => item.key !== approval.key), approval] })),
  resolveApproval: (key, status) => set((state) => ({ approvals: state.approvals.map((item) => item.key === key ? { ...item, status } : item) })),
  setFiles: (files) => set({ files }), addFiles: (files) => set((state) => ({ files: [...state.files.filter((old) => !files.some((item) => item.path === old.path)), ...files] })),
  setError: (error) => set({ error }),
}))
