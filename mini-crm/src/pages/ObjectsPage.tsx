import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Building2, Search, MoreVertical, Edit, Trash2, Loader2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { TaskStatus } from '@/types'
import { useAuth } from '@/components/auth/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/DropdownMenu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/Dialog'
import { Label } from '@/components/ui/Label'
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

async function fetchObjects(): Promise<ObjectWithTasks[]> {
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
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as ObjectWithTasks[]
}

async function createObject(data: { name: string; address: string }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: obj, error } = await supabase
    .from('objects')
    .insert({ ...data, created_by: user.id })
    .select()
    .single()

  if (error) throw error
  return obj
}

async function updateObject(id: string, data: { name: string; address: string }) {
  const { error } = await supabase.from('objects').update(data).eq('id', id)
  if (error) throw error
}

async function deleteObject(id: string) {
  const { error } = await supabase.from('objects').delete().eq('id', id)
  if (error) throw error
}

export function ObjectsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingObject, setEditingObject] = useState<ObjectWithTasks | null>(null)
  const [formData, setFormData] = useState({ name: '', address: '' })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isExecutor = profile?.role === 'executor'

  const { data: objects, isLoading, error } = useQuery({
    queryKey: ['objects'],
    queryFn: fetchObjects,
  })

  // Для исполнителей: фильтруем объекты и задачи
  const visibleObjects = (objects?.map(obj => {
    if (!isExecutor) return obj
    const myTasks = obj.tasks?.filter(t => t.assignee_id === profile?.id) || []
    return myTasks.length > 0 ? { ...obj, tasks: myTasks } : null
  }).filter(Boolean) || []) as ObjectWithTasks[]

  const createMutation = useMutation({
    mutationFn: createObject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects'] })
      toast({ title: 'Успешно', description: 'Объект создан', variant: 'success' })
      setIsCreateDialogOpen(false)
      setFormData({ name: '', address: '' })
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; address: string } }) => updateObject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects'] })
      toast({ title: 'Успешно', description: 'Объект обновлен', variant: 'success' })
      setEditingObject(null)
      setFormData({ name: '', address: '' })
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteObject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objects'] })
      toast({ title: 'Успешно', description: 'Объект удален', variant: 'success' })
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingObject) {
      updateMutation.mutate({ id: editingObject.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = (object: ObjectWithTasks) => {
    setEditingObject(object)
    setFormData({ name: object.name, address: object.address || '' })
  }

  const handleDelete = (id: string) => {
    if (confirm('Удалить объект? Все задачи этого объекта также будут удалены.')) {
      deleteMutation.mutate(id)
    }
  }

  const filteredObjects = visibleObjects?.filter(obj =>
    obj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    obj.address?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

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
          <h1 className="text-3xl font-bold text-gray-900">Объекты</h1>
          <p className="text-gray-500 mt-1">Список стройплощадок и их задачи</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Поиск по названию или адресу..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditingObject(null); setFormData({ name: '', address: '' }); setIsCreateDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Новый объект
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>{editingObject ? 'Редактировать объект' : 'Новый объект'}</DialogTitle>
                  <DialogDescription>Заполните данные объекта</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Название *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Например: ЖК Солнечный"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Адрес</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="ул. Ленина, 123"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {createMutation.isPending || updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filteredObjects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Объектов не найдено</h3>
            <p className="text-gray-500 mb-4">{searchQuery ? 'Попробуйте изменить запрос поиска' : 'Создайте первый объект, нажав кнопку «Новый объект»'}</p>
            {!searchQuery && (
              <Button onClick={() => { setEditingObject(null); setFormData({ name: '', address: '' }); setIsCreateDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Создать объект
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredObjects.map(object => (
            <Card key={object.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{object.name}</CardTitle>
                    {object.address && (
                      <p className="text-sm text-gray-500 mt-1">{object.address}</p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(object)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Редактировать
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => navigate(`/objects/${object.id}`)}
                        className="font-medium"
                      >
                        <Building2 className="h-4 w-4 mr-2" />
                        Открыть
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(object.id)}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-2">
                  {object.tasks.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Задач нет</p>
                  ) : (
                    object.tasks.slice(0, 3).map(task => (
                      <Link
                        key={task.id}
                        to={`/objects/${object.id}/tasks/${task.id}`}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                          <p className="text-xs text-gray-500 truncate">{task.description || 'Без описания'}</p>
                        </div>
                        <Badge variant={STATUS_BADGE_VARIANTS[task.status]}>
                          {STATUS_LABELS[task.status]}
                        </Badge>
                      </Link>
                    ))
                  )}
                  {object.tasks.length > 3 && (
                    <Link
                      to={`/objects/${object.id}`}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1 p-2"
                    >
                      <span>Ещё {object.tasks.length - 3} задач</span>
                    </Link>
                  )}
                </div>
              </CardContent>
              <div className="border-t border-gray-100 px-4 py-3">
                <Link
                  to={`/objects/${object.id}`}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1"
                >
                  Посмотреть все задачи →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}