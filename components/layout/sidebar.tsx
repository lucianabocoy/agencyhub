'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { type UserRole } from '@/types/index'
import {
  LayoutDashboard, Users, Clock, CheckSquare,
  Ticket, Target, BarChart3, TrendingUp, FileText, LogOut, Bell,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles: UserRole[]
}

const NAV: NavItem[] = [
  { label: 'Home', href: '/home', icon: LayoutDashboard, roles: ['admin', 'trafficker'] },
  { label: 'Clientes', href: '/clientes', icon: Users, roles: ['admin', 'trafficker'] },
  { label: 'Tiempo', href: '/tiempo', icon: Clock, roles: ['admin', 'trafficker'] },
  { label: 'Kanban', href: '/kanban', icon: CheckSquare, roles: ['admin', 'trafficker'] },
  { label: 'Tickets', href: '/tickets', icon: Ticket, roles: ['admin', 'trafficker'] },
  { label: 'Objetivos', href: '/objetivos', icon: Target, roles: ['admin', 'trafficker'] },
  { label: 'Métricas', href: '/metricas', icon: TrendingUp, roles: ['admin', 'trafficker'] },
  { label: 'Reportes', href: '/reportes', icon: FileText, roles: ['admin', 'trafficker'] },
  { label: 'Dashboard', href: '/dashboard', icon: BarChart3, roles: ['admin', 'trafficker'] },
]

interface SidebarProps {
  role: UserRole
  userName: string
  color: string
  unreadCount?: number
}

export function Sidebar({ role, userName, color, unreadCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const items = NAV.filter((i) => i.roles.includes(role))
  const initials = userName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex flex-col w-56 min-h-screen bg-surface border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-yesica/20 border border-yesica/30 flex items-center justify-center">
          <span className="font-mono font-bold text-yesica text-xs">AH</span>
        </div>
        <span className="font-bold text-text text-sm">AgencyHub</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== '/home' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-yesica/15 text-yesica'
                  : 'text-muted hover:text-text hover:bg-surface-2'
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer: notificaciones + usuario */}
      <div className="px-2 py-3 border-t border-border space-y-1">
        <Link
          href="/notificaciones"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted hover:text-text hover:bg-surface-2 transition-colors"
        >
          <div className="relative">
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-danger text-bg text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          Notificaciones
        </Link>

        <div className="flex items-center gap-2.5 px-3 py-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-bg flex-shrink-0"
            style={{ backgroundColor: color }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text truncate">{userName}</p>
            <p className="text-xs text-muted capitalize">{role}</p>
          </div>
          <button onClick={logout} className="text-muted hover:text-danger transition-colors">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
