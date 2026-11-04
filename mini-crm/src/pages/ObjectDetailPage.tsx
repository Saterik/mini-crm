import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, MoreVertical, Edit, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { TaskStatus } from '@/types'
import { useAuth } from '@/components/auth/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/DropdownMenu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/Dialog'
import { Label } from '@/components/ui/Label'
import { formatDateShort } from '@/utils/cn'
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
  assignee: { id: string; email: string; full_name: string | null; role: string } | null
  author: { id: string; email: string; full_name: string | null; role: string } | null
}

interface ObjectWithTasks {
  id: string
  name: string
  address: string | null
  created_by: string
  created_at: string
  updated_at: string
  tasks: TaskWithRelations[]
}

async function fetchObject(id: string): Promise<ObjectWithTasks> {
  const { data, error } = await supabase
    .from('objects')
    .select(`
      *,
      tasks:tasks (
        id, title, description, object_id, assignee_id, status, author_id, created_at, updated_at,
        assignee:profiles!tasks_assignee_id_fkey (id, email, full_name, role),
        author:profiles!tasks_author_id_fkey (id, email, full_name, role)
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as ObjectWithTasks
}

async function createTask(data: { title: string; description: string; object_id: string; assignee_id: string }) {
  const { data: taskId, error } = await supabase.rpc('create_task_with_history', {
    p_title: data.title,
    p_description: data.description,
    p_object_id: data.object_id,
    p_assignee_id: data.assignee_id,
  })
  if (error) throw error
  return taskId
}

async function fetchExecutors() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('role', 'executor')

  if (error) throw error
  return data
}

export function ObjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const [isCreateTaskDialogOpen, setIsCreateTaskDialogOpen] = useState(false)
  const [formData, setFormData] = useState({ title: '', description: '', assignee_id: '' })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const isExecutor = profile?.role === 'executor'
  const isSetter = profile?.role === 'setter'

  const { data: object, isLoading, error } = useQuery({
    queryKey: ['object', id],
    queryFn: () => fetchObject(id!),
    enabled: !!id,
  })

  // Для исполнителей: фильтруем только свои задачи
  const visibleTasks = object?.tasks?.filter(t => 
    !isExecutor || t.assignee_id === profile?.id
  ) || []

  const { data: executors } = useQuery({
    queryKey: ['executors'],
    queryFn: fetchExecutors,
  })

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['object', id] })
      toast({ title: 'Успешно', description: 'Задача создана', variant: 'success' })
      setIsCreateTaskDialogOpen(false)
      setFormData({ title: '', description: '', assignee_id: '' })
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    createTaskMutation.mutate({ ...formData, object_id: id })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error || !object) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Объект не найден</p>
        <Button variant="outline" onClick={() => navigate('/objects')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          К списку объектов
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/objects')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{object.name}</h1>
          {object.address && <p className="text-gray-500">{object.address}</p>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Задачи</CardTitle>
            {isSetter && (
              <Dialog open={isCreateTaskDialogOpen} onOpenChange={setIsCreateTaskDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setFormData({ title: '', description: '', assignee_id: '' }); setIsCreateTaskDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Новая задача
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handleSubmit}>
                    <DialogHeader>
                      <DialogTitle>Новая задача</DialogTitle>
                      <DialogDescription>Заполните данные задачи</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Название *</Label>
                        <Input
                          id="title"
                          value={formData.title}
                          onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Например: Залить фундамент"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Описание</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Детали задачи..."
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assignee_id">Исполнитель *</Label>
                        <select
                          id="assignee_id"
                          value={formData.assignee_id}
                          onChange={e => setFormData(prev => ({ ...prev, assignee_id: e.target.value }))}
                          className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                          required
                        >
                          <option value="">Выберите исполнителя</option>
                          {executors?.map(executor => (
                            <option key={executor.id} value={executor.id}>
                              {executor.full_name || executor.email}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsCreateTaskDialogOpen(false)}>
                        Отмена
                      </Button>
                      <Button type="submit" disabled={createTaskMutation.isPending}>
                        {createTaskMutation.isPending ? 'Создание...' : 'Создать'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {visibleTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">Задач пока нет</p>
              {isSetter && (
                <Button onClick={() => setIsCreateTaskDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Создать первую задачу
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleTasks.map(task => (
                <Link
                  key={task.id}
                  to={`/objects/${object.id}/tasks/${task.id}`}
                  className="group flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-100"
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-gray-900 truncate">{task.title}</h3>
                      <Badge variant={STATUS_BADGE_VARIANTS[task.status]}>
                        {STATUS_LABELS[task.status]}
                      </Badge>
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-500 truncate mt-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      {task.assignee && (
                        <span className="flex items-center gap-1">
                          Исполнитель: <span className="font-medium text-gray-700">{task.assignee.full_name || task.assignee.email}</span>
                        </span>
                      )}
                      <span>Создана: {formatDateShort(task.created_at)}</span>
                    </div>
                  </div>
                  {isSetter && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm('Удалить задачу?')) {
                              // TODO: delete task
                            }
                          }}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}