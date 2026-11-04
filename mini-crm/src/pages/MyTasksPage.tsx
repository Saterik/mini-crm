import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Filter, ListTodo, Building2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { TaskStatus } from '@/types'
import { useAuth } from '@/components/auth/AuthContext'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDateShort } from '@/utils/cn'

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
  object: { id: string; name: string }
  assignee: { id: string; email: string; full_name: string | null; role: string } | null
  author: { id: string; email: string; full_name: string | null; role: string } | null
}

async function fetchMyTasks(userId: string): Promise<TaskWithRelations[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      object:objects!tasks_object_id_fkey (id, name),
      assignee:profiles!tasks_assignee_id_fkey (id, email, full_name, role),
      author:profiles!tasks_author_id_fkey (id, email, full_name, role)
    `)
    .eq('assignee_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as TaskWithRelations[]
}

export function MyTasksPage() {
  const { profile } = useAuth()
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')

  const { data: tasks, isLoading, error } = useQuery({
    queryKey: ['my-tasks', profile?.id],
    queryFn: () => fetchMyTasks(profile!.id),
    enabled: !!profile?.id,
  })

  const filteredTasks = tasks?.filter(task => 
    statusFilter === 'all' || task.status === statusFilter
  ) || []

  const taskCounts = tasks?.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1
    return acc
  }, {} as Record<TaskStatus, number>) || {} as Record<TaskStatus, number>

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Ошибка загрузки: {(error as Error).message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Мои задачи</h1>
          <p className="text-gray-500 mt-1">Задачи, назначенные на вас</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Фильтр
          </Button>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-md"
              onClick={() => setStatusFilter('all')}
            >
              Все ({tasks?.length || 0})
            </Button>
            {(['new', 'in_progress', 'on_review', 'rework'] as TaskStatus[]).map(status => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'ghost'}
                size="sm"
                className="rounded-md"
                onClick={() => setStatusFilter(status)}
              >
                {STATUS_LABELS[status]} ({taskCounts[status] || 0})
              </Button>
            ))}
            <Button
              variant={statusFilter === 'accepted' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-md"
              onClick={() => setStatusFilter('accepted')}
            >
              Принятые ({taskCounts.accepted || 0})
            </Button>
          </div>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ListTodo className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {statusFilter === 'all' ? 'Задач не найдено' : `Нет задач со статусом «${STATUS_LABELS[statusFilter as TaskStatus]}»`}
            </h3>
            <p className="text-gray-500 mb-4">
              {statusFilter === 'all'
                ? 'Когда вам назначат задачу, она появится здесь'
                : 'Попробуйте изменить фильтр'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map(task => (
            <Card key={task.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="font-medium text-gray-900 truncate">{task.title}</h3>
                      <Badge variant={STATUS_BADGE_VARIANTS[task.status]}>
                        {STATUS_LABELS[task.status]}
                      </Badge>
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-500 truncate mb-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        <Link
                          to={`/objects/${task.object.id}`}
                          className="hover:text-blue-600 font-medium"
                        >
                          {task.object?.name}
                        </Link>
                      </span>
                      <span>Автор: {task.author?.full_name || task.author?.email}</span>
                      <span>Создана: {formatDateShort(task.created_at)}</span>
                    </div>
                  </div>
                  <Link
                    to={`/objects/${task.object.id}/tasks/${task.id}`}
                    className="flex-shrink-0"
                  >
                    <Button variant="outline" size="sm">
                      Открыть
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}