export interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  dueDate?: string;
  status: 'pending' | 'completed';
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  participants: string[];
  rawNotes: string;
  summary: string;
  actionItems: ActionItem[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type ViewState = 'list' | 'create' | 'edit';

export interface AIResponseState {
  loading: boolean;
  error: string | null;
  success: boolean;
}