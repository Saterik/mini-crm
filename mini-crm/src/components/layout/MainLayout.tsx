import { Outlet } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Toaster } from '@/components/ui/Toaster'

export function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
      <Toaster />
    </div>
  )
}