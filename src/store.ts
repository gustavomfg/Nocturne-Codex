import { create } from 'zustand'
import type { Activity, Approval, Artifact, ChangedFile, CodexStatus, Conversation, Message, PlanStep, Suggestion } from './types'

interface AppState {
  conversations: Conversation[]; activeId: string | null; messages: Message[]
  status: CodexStatus; streaming: string; diff: string; activities: Activity[]; approvals: Approval[]; files: ChangedFile[]; artifacts: Artifact[]; suggestions: Suggestion[]; plan: PlanStep[]; planExplanation: string; error: string | null
  setConversations(value: Conversation[]): void; setActive(id: string | null): void; setMessages(value: Message[]): void
  addMessage(value: Message): void; setStatus(value: CodexStatus): void; appendStream(value: string): void; clearRun(): void
  setDiff(value: string): void; upsertActivity(value: Activity): void; addApproval(value: Approval): void
  resolveApproval(key: string, status: 'accepted' | 'declined'): void; setError(value: string | null): void
  setFiles(value: ChangedFile[]): void; addFiles(value: ChangedFile[]): void
  setArtifacts(value: Artifact[]): void; setSuggestions(value: Suggestion[]): void; setPlan(value: PlanStep[], explanation?: string): void
}

const MAX_ACTIVITIES = 300
const MAX_ACTIVITY_DETAIL = 64_000
const MAX_STREAM_SIZE = 2_000_000

export const useAppStore = create<AppState>((set) => ({
  conversations: [], activeId: null, messages: [], status: 'disconnected', streaming: '', diff: '', activities: [], approvals: [], files: [], artifacts: [], suggestions: [], plan: [], planExplanation: '', error: null,
  setConversations: (conversations) => set({ conversations }), setActive: (activeId) => set({ activeId }),
  setMessages: (messages) => set({ messages }), addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setStatus: (status) => set({ status }), appendStream: (value) => set((state) => ({ streaming: `${state.streaming}${value}`.slice(0, MAX_STREAM_SIZE) })),
  clearRun: () => set({ streaming: '', diff: '', activities: [], approvals: [], files: [], plan: [], planExplanation: '', error: null }), setDiff: (diff) => set({ diff }),
  upsertActivity: (activity) => set((state) => ({ activities: [...state.activities.filter((item) => item.id !== activity.id), { ...activity, detail: activity.detail?.slice(-MAX_ACTIVITY_DETAIL) }].slice(-MAX_ACTIVITIES) })),
  addApproval: (approval) => set((state) => ({ approvals: [...state.approvals.filter((item) => item.key !== approval.key), approval] })),
  resolveApproval: (key, status) => set((state) => ({ approvals: state.approvals.map((item) => item.key === key ? { ...item, status } : item) })),
  setFiles: (files) => set({ files }), addFiles: (files) => set((state) => ({ files: [...state.files.filter((old) => !files.some((item) => item.path === old.path)), ...files] })),
  setArtifacts: (artifacts) => set({ artifacts }), setSuggestions: (suggestions) => set({ suggestions }), setPlan: (plan, planExplanation = '') => set({ plan, planExplanation }),
  setError: (error) => set({ error }),
}))
