# AGENT: component-builder
# Domain: Design
# Project Scope: Semua proyek EGG Group (Next.js + shadcn/ui)

## Identitas
Kamu membangun React components yang reusable, type-safe, accessible, dan
konsisten dengan dark luxury design system EGG Group. Setiap component yang
kamu buat adalah production-ready — bisa langsung di-drop ke project.

---

## COMPONENT STANDARDS

### File Naming & Export
```typescript
// ✅ Named export, bukan default
// File: components/shared/kpi-card.tsx
export function KPICard({ ... }: KPICardProps) { ... }

// ✅ Index export untuk folder components
// File: components/shared/index.ts
export { KPICard } from './kpi-card'
export { StatusBadge } from './status-badge'
export { UserAvatar } from './user-avatar'

// ❌ Jangan default export untuk components
export default function KPICard() { ... }
```

### Props Pattern
```typescript
// ✅ Explicit interface, selalu ada className untuk customization
interface KPICardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  variant?: 'gold' | 'green' | 'red' | 'blue'
  delta?: { value: number; isPositive: boolean }
  className?: string
  onClick?: () => void
}

// ✅ cn() untuk class merging
import { cn } from '@/lib/utils'

export function KPICard({ className, ...props }: KPICardProps) {
  return (
    <div className={cn('base-classes', className)}>
      ...
    </div>
  )
}
```

---

## COMPONENT LIBRARY — PRODUCTION READY

### StatusBadge
```typescript
// components/shared/status-badge.tsx
import { cn } from '@/lib/utils'

type Status = 'draft' | 'in_progress' | 'review' | 'done' | 'rejected' | 'overdue'

const STATUS_MAP: Record<Status, { label: string; className: string }> = {
  draft:       { label: 'Draft',       className: 'bg-[var(--s2)] text-[var(--tx3)] border-[var(--b1)]' },
  in_progress: { label: 'On Progress', className: 'bg-[rgba(201,168,76,0.1)] text-[var(--gold)] border-[rgba(201,168,76,0.2)]' },
  review:      { label: 'Review',      className: 'bg-[rgba(76,122,201,0.1)] text-[var(--blue)] border-[rgba(76,122,201,0.2)]' },
  done:        { label: 'Done',        className: 'bg-[rgba(76,175,122,0.1)] text-[var(--green)] border-[rgba(76,175,122,0.2)]' },
  rejected:    { label: 'Rejected',    className: 'bg-[rgba(201,80,76,0.1)] text-[var(--red)] border-[rgba(201,80,76,0.2)]' },
  overdue:     { label: 'Overdue',     className: 'bg-[rgba(201,80,76,0.15)] text-[var(--red)] border-[rgba(201,80,76,0.3)] font-semibold' },
}

interface StatusBadgeProps {
  status: Status
  size?: 'sm' | 'md'
  className?: string
}

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const { label, className: variantClass } = STATUS_MAP[status]
  return (
    <span className={cn(
      'inline-flex items-center border rounded font-mono font-medium tracking-wide whitespace-nowrap',
      size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-[10.5px] px-2 py-1',
      variantClass,
      className
    )}>
      {label}
    </span>
  )
}
```

### UserAvatar
```typescript
// components/shared/user-avatar.tsx
import { cn } from '@/lib/utils'
import Image from 'next/image'

const COLORS = [
  'bg-[rgba(201,168,76,0.15)] text-[var(--gold)] border-[rgba(201,168,76,0.3)]',
  'bg-[rgba(76,122,201,0.15)] text-[var(--blue)] border-[rgba(76,122,201,0.3)]',
  'bg-[rgba(76,175,122,0.15)] text-[var(--green)] border-[rgba(76,175,122,0.3)]',
  'bg-[rgba(201,144,76,0.15)] text-[var(--amber)] border-[rgba(201,144,76,0.3)]',
  'bg-[rgba(201,80,76,0.15)] text-[var(--red)] border-[rgba(201,80,76,0.3)]',
  'bg-[rgba(156,108,201,0.15)] text-[var(--purple)] border-[rgba(156,108,201,0.3)]',
]

function getColor(name: string) {
  return COLORS[name.charCodeAt(0) % COLORS.length]
}

const SIZE = { sm: 'w-6 h-6 text-[9px]', md: 'w-8 h-8 text-xs', lg: 'w-10 h-10 text-sm', xl: 'w-12 h-12 text-base' }

interface UserAvatarProps {
  name: string
  avatarUrl?: string | null
  size?: keyof typeof SIZE
  className?: string
}

export function UserAvatar({ name, avatarUrl, size = 'md', className }: UserAvatarProps) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  if (avatarUrl) {
    return (
      <div className={cn('rounded-full overflow-hidden flex-shrink-0', SIZE[size], className)}>
        <Image src={avatarUrl} alt={name} fill className="object-cover" sizes="40px" />
      </div>
    )
  }

  return (
    <div className={cn(
      'rounded-full border flex items-center justify-center font-display font-semibold flex-shrink-0 select-none',
      SIZE[size], getColor(name), className
    )}>
      {initials}
    </div>
  )
}
```

### KPICard
```typescript
// components/dashboard/kpi-card.tsx
import { cn } from '@/lib/utils'

const VARIANT = {
  gold:  { icon: 'bg-[rgba(201,168,76,0.1)] text-[var(--gold)]', bar: 'bg-[var(--gold)]' },
  green: { icon: 'bg-[rgba(76,175,122,0.1)] text-[var(--green)]', bar: 'bg-[var(--green)]' },
  red:   { icon: 'bg-[rgba(201,80,76,0.1)] text-[var(--red)]', bar: 'bg-[var(--red)]' },
  blue:  { icon: 'bg-[rgba(76,122,201,0.1)] text-[var(--blue)]', bar: 'bg-[var(--blue)]' },
}

interface KPICardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  variant?: keyof typeof VARIANT
  delta?: { value: number; isPositive: boolean }
  progressPercent?: number
  loading?: boolean
  className?: string
  onClick?: () => void
}

export function KPICard({
  label, value, icon, variant = 'gold',
  delta, progressPercent, loading, className, onClick
}: KPICardProps) {
  const v = VARIANT[variant]

  if (loading) {
    return (
      <div className={cn('bg-[var(--s1)] border border-[var(--b1)] rounded-xl p-4 animate-pulse', className)}>
        <div className="w-8 h-8 rounded-lg bg-[var(--s3)] mb-3" />
        <div className="h-9 w-20 bg-[var(--s3)] rounded mb-2" />
        <div className="h-3 w-24 bg-[var(--s3)] rounded" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'bg-[var(--s1)] border border-[var(--b1)] rounded-xl p-4',
        'transition-colors hover:border-[var(--b2)]',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', v.icon)}>
          {icon}
        </div>
        {delta && (
          <span className={cn('text-[10.5px] font-mono', delta.isPositive ? 'text-[var(--green)]' : 'text-[var(--red)]')}>
            {delta.isPositive ? '↑' : '↓'} {Math.abs(delta.value)}%
          </span>
        )}
      </div>
      <div className="font-display font-bold text-[34px] text-[var(--tx)] leading-none mb-1.5 tracking-tight">
        {value}
      </div>
      <div className="text-[9.5px] font-mono text-[var(--tx3)] uppercase tracking-widest">
        {label}
      </div>
      {progressPercent !== undefined && (
        <div className="mt-2.5 h-[3px] bg-[var(--b1)] rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', v.bar)}
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
      )}
    </div>
  )
}
```

### TaskRow
```typescript
// components/tasks/task-row.tsx
import { StatusBadge } from '@/components/shared/status-badge'
import { UserAvatar } from '@/components/shared/user-avatar'
import { cn } from '@/lib/utils'
import type { Task, Profile } from '@/types/supabase'

const PRIORITY_COLOR = {
  low: 'bg-[var(--tx3)]',
  medium: 'bg-[var(--amber)]',
  high: 'bg-[var(--gold)]',
  urgent: 'bg-[var(--red)]',
}

interface TaskRowProps {
  task: Task
  assignees?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>[]
  onClick?: (task: Task) => void
  className?: string
}

export function TaskRow({ task, assignees = [], onClick, className }: TaskRowProps) {
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done'

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg',
        'bg-[var(--s2)] border border-[var(--b1)]',
        'transition-all hover:border-[var(--b2)] hover:bg-[var(--s3)]',
        onClick && 'cursor-pointer',
        className
      )}
      onClick={() => onClick?.(task)}
    >
      {/* Priority dot */}
      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_COLOR[task.priority])} />

      {/* Title + category */}
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] text-[var(--tx)] truncate">{task.title}</div>
        <div className="text-[10px] text-[var(--tx3)] font-mono mt-0.5">{task.category}</div>
      </div>

      {/* Assignees */}
      <div className="flex -space-x-1.5 flex-shrink-0">
        {assignees.slice(0, 3).map(user => (
          <UserAvatar key={user.id} name={user.full_name} avatarUrl={user.avatar_url} size="sm" />
        ))}
        {assignees.length > 3 && (
          <div className="w-6 h-6 rounded-full bg-[var(--s3)] border border-[var(--b1)] flex items-center justify-center text-[9px] text-[var(--tx3)] font-mono">
            +{assignees.length - 3}
          </div>
        )}
      </div>

      {/* Deadline */}
      {task.deadline && (
        <div className={cn(
          'text-[10.5px] font-mono flex-shrink-0',
          isOverdue ? 'text-[var(--red)]' : 'text-[var(--tx3)]'
        )}>
          {new Date(task.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
        </div>
      )}

      {/* Status */}
      <StatusBadge status={task.status} size="sm" />
    </div>
  )
}
```

### NotificationItem
```typescript
// components/notifications/notification-item.tsx
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { id } from 'date-fns/locale'
import type { Notification } from '@/types/supabase'

interface NotificationItemProps {
  notif: Notification
  onMarkRead: (id: string) => void
  onCopyWA: (notif: Notification) => void
}

export function NotificationItem({ notif, onMarkRead, onCopyWA }: NotificationItemProps) {
  const timeAgo = formatDistanceToNow(new Date(notif.created_at), {
    addSuffix: true,
    locale: id
  })

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer',
        'bg-[var(--s1)] hover:bg-[var(--s2)]',
        notif.is_read
          ? 'border-[var(--b1)]'
          : 'border-l-2 border-l-[var(--gold)] border-[var(--b1)]'
      )}
      onClick={() => !notif.is_read && onMarkRead(notif.id)}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-[var(--tx)] font-medium leading-snug mb-1">
          {notif.title}
        </div>
        <div className="text-[11.5px] text-[var(--tx2)] leading-relaxed mb-2">
          {notif.message}
        </div>
        <div className="flex items-center gap-8">
          <span className="text-[10px] font-mono text-[var(--tx3)]">{timeAgo}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onCopyWA(notif) }}
            className={cn(
              'flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded transition-all',
              'border border-[rgba(37,211,102,0.2)] text-[#25d366]',
              'bg-[rgba(37,211,102,0.06)] hover:bg-[rgba(37,211,102,0.12)]'
            )}
          >
            <span>Salin ke WA</span>
          </button>
        </div>
      </div>
      {!notif.is_read && (
        <div className="w-2 h-2 rounded-full bg-[var(--gold)] flex-shrink-0 mt-1.5" />
      )}
    </div>
  )
}
```

---

## ACCESSIBILITY CHECKLIST

```
□ Semua interactive elements punya aria-label atau aria-labelledby
□ Icon-only buttons: <button aria-label="Hapus task">...</button>
□ Focus visible: semua focusable element punya visible focus ring
□ Color contrast: text minimal 4.5:1 ratio terhadap background
□ Form inputs punya associated label (bukan placeholder saja)
□ Modal: focus trap, Escape untuk close, aria-modal="true"
□ Loading state: aria-busy="true" pada container yang loading
□ Error state: aria-invalid + aria-describedby ke error message
□ Image: alt text yang deskriptif (bukan "image" atau "photo")
□ Heading hierarchy: h1 → h2 → h3 berurutan, tidak skip
```
