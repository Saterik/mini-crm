import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, User, MessageSquare } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { TaskStatus } from '@/types'
import { useAuth } from '@/components/auth/AuthContext'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog'
import { Label } from '@/components/ui/Label'
import { Separator } from '@/components/ui/Separator'
import { formatDate, formatDateShort } from '@/utils/cn'
import { toast } from '@/components/ui/Toaster'

const STATUS_BADGE_VARIANTS: Record<TaskStatus, 'default' | 'secondary' | 'destructive' | 'success' | 'warning'> = {
  new: 'default',
  in_progress: 'secondary',
  on_review: 'warning',
  accepted: 'success',
  rework: 'destructive',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  on_review: 'На проверке',
  accepted: 'Принята',
  rework: 'На доработке',
}

interface HistoryItem {
  id: string
  task_id: string
  changed_by: string
  from_status: TaskStatus | null
  to_status: TaskStatus
  comment: string | null
  created_at: string
  changed_by_profile: { id: string; email: string; full_name: string | null; role: string } | null
}

interface TaskWithRelations {
  id: string
  title: string
  description: string | null
  object_id: string
  assignee_id: string | null
  status: TaskStatus
  author_id: string
  created_at: string
  updated_at: string
  object: { id: string; name: string }
  assignee: { id: string; email: string; full_name: string | null; role: string } | null
  author: { id: string; email: string; full_name: string | null; role: string } | null
  status_history: HistoryItem[]
}

async function fetchTask(id: string): Promise<TaskWithRelations> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      object:objects!tasks_object_id_fkey (id, name),
      assignee:profiles!tasks_assignee_id_fkey (id, email, full_name, role),
      author:profiles!tasks_author_id_fkey (id, email, full_name, role),
      status_history:task_status_history (
        id, task_id, changed_by, from_status, to_status, comment, created_at,
        changed_by_profile:profiles!task_status_history_changed_by_fkey (id, email, full_name, role)
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error

  if (data.status_history) {
    data.status_history.sort((a: HistoryItem, b: HistoryItem) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  return data
}

function getAvailableTransitions(
  status: TaskStatus,
  _userRole: 'setter' | 'executor',
  isAssignee: boolean,
  isAuthor: boolean
): TaskStatus[] {
  const transitions: Record<TaskStatus, { to: TaskStatus; role: 'setter' | 'executor' }[]> = {
    new: [{ to: 'in_progress', role: 'executor' }],
    in_progress: [{ to: 'on_review', role: 'executor' }],
    on_review: [
      { to: 'accepted', role: 'setter' },
      { to: 'rework', role: 'setter' },
    ],
    rework: [{ to: 'in_progress', role: 'executor' }],
    accepted: [],
  }

  return transitions[status]
    .filter(t => {
      if (t.role === 'executor') return isAssignee
      if (t.role === 'setter') return isAuthor
      return false
    })
    .map(t => t.to)
}

export function TaskDetailPage() {
  const { id, objectId } = useParams<{ id: string; objectId: string }>()
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [comment, setComment] = useState('')
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null)

  const { data: task, isLoading, error } = useQuery({
    queryKey: ['task', id],
    queryFn: () => fetchTask(id!),
    enabled: !!id,
  })

  const statusMutation = useMutation({
    mutationFn: async ({ newStatus, comment }: { newStatus: TaskStatus; comment: string | null }) => {
      const { error } = await supabase.rpc('update_task_status', {
        p_task_id: id,
        p_new_status: newStatus,
        p_comment: comment,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', id] })
      queryClient.invalidateQueries({ queryKey: ['objects'] })
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
      toast({ title: 'Успешно', description: 'Статус изменен', variant: 'success' })
      setPendingStatus(null)
      setComment('')
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' })
      setPendingStatus(null)
      setComment('')
    },
  })

  const handleStatusChange = (newStatus: TaskStatus, requiresComment: boolean) => {
    if (requiresComment) {
      setPendingStatus(newStatus)
    } else {
      statusMutation.mutate({ newStatus, comment: null })
    }
  }

  const handleConfirmStatusChange = () => {
    if (pendingStatus) {
      statusMutation.mutate({ newStatus: pendingStatus, comment: comment || null })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Задача не найдена</p>
        <Button variant="outline" onClick={() => navigate(`/objects/${objectId}`)} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          К объекту
        </Button>
      </div>
    )
  }

  const isAssignee = task.assignee_id === profile?.id
  const isAuthor = task.author_id === profile?.id
  const availableTransitions = getAvailableTransitions(task.status, profile?.role || 'executor', isAssignee, isAuthor)

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate(`/objects/${objectId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          К объекту
        </Button>
        <Link to={`/objects/${objectId}`} className="text-sm text-gray-500 hover:text-gray-700">
          {task.object.name}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-2xl">{task.title}</CardTitle>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <Badge variant={STATUS_BADGE_VARIANTS[task.status]} className="text-base px-3 py-1">
                  {STATUS_LABELS[task.status]}
                </Badge>
                <span className="text-sm text-gray-500">
                  Создана: {formatDateShort(task.created_at)}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {task.description && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-900">Описание</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Автор</h4>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <span>{task.author?.full_name || task.author?.email}</span>
              </div>
            </div>
            {task.assignee && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Исполнитель</h4>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span>{task.assignee.full_name || task.assignee.email}</span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {availableTransitions.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-900">Доступные действия</h4>
              <div className="flex flex-wrap gap-2">
                {availableTransitions.map(status => {
                  const requiresComment = status === 'rework'
                  const isPending = pendingStatus === status

                  if (isPending) {
                    return (
                      <Dialog open onOpenChange={open => { if (!open) setPendingStatus(null); }}>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Комментарий обязателен</DialogTitle>
                            <DialogDescription>Укажите причину возврата на доработку</DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            <div className="space-y-2">
                              <Label htmlFor="rework-comment">Комментарий *</Label>
                              <Textarea
                                id="rework-comment"
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                placeholder="Опишите, что нужно исправить..."
                                rows={3}
                                required
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setPendingStatus(null)}>
                              Отмена
                            </Button>
                            <Button onClick={handleConfirmStatusChange} disabled={statusMutation.isPending || !comment.trim()}>
                              {statusMutation.isPending ? 'Отправка...' : 'Подтвердить'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )
                  }

                  return (
                    <Button
                      key={status}
                      variant={status === 'accepted' ? 'default' : status === 'rework' ? 'destructive' : 'outline'}
                      onClick={() => handleStatusChange(status, requiresComment)}
                      disabled={statusMutation.isPending}
                    >
                      {status === 'in_progress' && 'Взять в работу'}
                      {status === 'on_review' && 'Отправить на проверку'}
                      {status === 'accepted' && 'Принять'}
                      {status === 'rework' && 'На доработку'}
                    </Button>
                  )
                })}
              </div>
            </div>
          )}

          <Separator />

          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-4">История изменений статуса</h4>
            {task.status_history && task.status_history.length > 0 ? (
              <div className="space-y-4">
                {task.status_history.map((history: HistoryItem) => (
                  <div key={history.id} className="relative pl-6 pb-4 border-l border-gray-200 last:border-0 last:pb-0">
                    <div className="absolute left-[-6px] top-0 h-2 w-2 rounded-full bg-blue-600 border-2 border-white" />
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900">
                            {history.changed_by_profile?.full_name || history.changed_by_profile?.email || 'Неизвестно'}
                          </span>
                          <span className="text-xs text-gray-500">{formatDate(history.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {history.from_status && (
                            <>
                              <Badge variant={STATUS_BADGE_VARIANTS[history.from_status]}>
                                {STATUS_LABELS[history.from_status]}
                              </Badge>
                              <span className="text-gray-400">→</span>
                            </>
                          )}
                          <Badge variant={STATUS_BADGE_VARIANTS[history.to_status]}>
                            {STATUS_LABELS[history.to_status]}
                          </Badge>
                        </div>
                        {history.comment && (
                          <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                              <MessageSquare className="h-3 w-3" />
                              <span>Комментарий:</span>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{history.comment}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">История пуста</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}