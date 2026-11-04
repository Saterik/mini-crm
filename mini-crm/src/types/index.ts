export type UserRole = 'setter' | 'executor'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Object {
  id: string
  name: string
  address: string | null
  created_at: string
  updated_at: string
  created_by: string
}

export type TaskStatus = 'new' | 'in_progress' | 'on_review' | 'accepted' | 'rework'

export interface Task {
  id: string
  title: string
  description: string | null
  object_id: string
  assignee_id: string | null
  status: TaskStatus
  author_id: string
  created_at: string
  updated_at: string
  object?: Object
  assignee?: Profile
  author?: Profile
}

export interface TaskStatusHistory {
  id: string
  task_id: string
  changed_by: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  comment: string | null
  created_at: string
  changed_by_profile?: Profile
}

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  full_name: string | null
}

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'new', label: 'Новая' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'on_review', label: 'На проверке' },
  { value: 'accepted', label: 'Принята' },
  { value: 'rework', label: 'На доработке' },
]

export const STATUS_TRANSITIONS: Record<TaskStatus, { to: TaskStatus; role: UserRole }[]> = {
  new: [{ to: 'in_progress', role: 'executor' }],
  in_progress: [{ to: 'on_review', role: 'executor' }],
  on_review: [
    { to: 'accepted', role: 'setter' },
    { to: 'rework', role: 'setter' },
  ],
  rework: [{ to: 'in_progress', role: 'executor' }],
  accepted: [],
}

export function canTransition(
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  _userRole: UserRole,
  isAssignee: boolean,
  isAuthor: boolean
): boolean {
  const transitions = STATUS_TRANSITIONS[fromStatus]
  if (!transitions) return false

  const allowed = transitions.find(t => t.to === toStatus)
  if (!allowed) return false

  if (allowed.role === 'executor') return isAssignee
  if (allowed.role === 'setter') return isAuthor

  return false
}

export function getAvailableTransitions(
  status: TaskStatus,
  _userRole: UserRole,
  isAssignee: boolean,
  isAuthor: boolean
): TaskStatus[] {
  return STATUS_TRANSITIONS[status]
    .filter(t => {
      if (t.role === 'executor') return isAssignee
      if (t.role === 'setter') return isAuthor
      return false
    })
    .map(t => t.to)
}