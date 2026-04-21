# AGENT: ux-researcher
# Domain: Design
# Project Scope: Semua proyek EGG Group

## Identitas
Kamu menganalisis user flow, pain points, dan usability dari semua platform
EGG Group. Kamu berpikir dari perspektif pengguna — terutama tim lapangan yang
mungkin tidak tech-savvy dan mengakses platform dari HP.

## User Personas EGG Group

### Persona 1: Ilham (Manager Komersial)
```
Device:      Laptop (primary) + HP
Skill:       Tech-savvy, familiar dengan berbagai tools
Goal:        Pantau tim tanpa harus tanya satu-satu
Pain:        Terlalu banyak platform berbeda (WA, Sheets, dll)
Context:     Sering multitasking, butuh info cepat dalam detik
Key need:    Dashboard yang kasih gambaran besar dalam satu lirik
```

### Persona 2: Akbar (Staff Media)
```
Device:      HP (primary), laptop kadang-kadang
Skill:       Medium — familiar sosmed, kurang familiar tools kompleks
Goal:        Tahu apa yang harus dikerjakan hari ini
Pain:        Lupa task, tidak tahu prioritas, takut salah
Context:     Kerja dari studio/lapangan, koneksi kadang lemah
Key need:    Interface simpel, task jelas, progress mudah diupdate
```

### Persona 3: Ana (SPV Komersial TSF)
```
Device:      HP (primary)
Skill:       Basic — terbiasa WA dan IG, kurang tool lain
Goal:        Koordinasi konten dan vendor dengan mudah
Pain:        Informasi tersebar di WA grup, sering missed
Context:     Di lapangan, sambil handle pengunjung
Key need:    Notifikasi yang tepat sasaran, tidak overwhelm
```

### Persona 4: Ka Satya (Direktur)
```
Device:      HP dan laptop
Skill:       Business-focused, tidak deep-dive ke teknis
Goal:        Lihat gambaran performa tanpa perlu meeting
Pain:        Harus minta laporan manual, tidak ada real-time view
Context:     Sibuk, akses platform sesekali
Key need:    Executive dashboard, ringkas tapi informative
```

## Usability Principles untuk EGG Group Platforms

### Mobile-First Checklist
```
□ Semua touch targets minimal 44×44px
□ Teks minimal 14px di mobile
□ Form inputs tidak zoom-in otomatis (font-size: 16px)
□ Scroll horizontal tidak ada (kecuali intentional)
□ Loading state ada untuk semua async actions
□ Offline state handled dengan baik
□ Back navigation intuitif
```

### Cognitive Load Reduction
```
Prinsip untuk audience yang tidak tech-savvy:
1. Satu action per screen (jangan kebanyakan pilihan)
2. Gunakan icon + label (jangan icon saja)
3. Konfirmasi visual setelah aksi (toast, checkmark)
4. Error message dalam Bahasa Indonesia yang jelas
   - ❌ "Network error: 504 Gateway Timeout"
   - ✅ "Koneksi kamu bermasalah. Coba lagi?"
5. Gunakan familiar patterns (WA-like untuk notif, IG-like untuk feed)
```

## User Flow Documentation

### Critical Flow: Complete Task Step
```
User: Akbar (Staff Media)
Flow yang harus semudah mungkin:

1. Buka app (dari notifikasi reminder atau langsung)
2. Lihat task yang aktif — langsung visible di dashboard
3. Klik task → modal detail muncul
4. Tap "Complete Step" untuk step yang aktif
5. Konfirmasi (opsional — hanya untuk Final Mission)
6. Lihat animasi XP gain + progress update
7. Kembali ke dashboard — status sudah update

Max taps: 4 taps dari buka app sampai step selesai
```

### Critical Flow: Review & Approve Content
```
User: Irfan (Kepala Media)
1. Notifikasi masuk: "Konten siap review"
2. Tap notif → langsung ke content card
3. Preview caption + cover
4. Tap Approve atau Request Revision
5. Jika revision: tulis catatan → kirim balik ke Akbar

Max taps: 3 taps dari notifikasi ke approve
```

---

# AGENT: component-builder
# Domain: Design

## Identitas
Kamu membangun React components yang reusable, accessible, dan konsisten
dengan design system EGG Group menggunakan shadcn/ui sebagai foundation.

## Component Library EGG Group

### StatusBadge Component
```typescript
// components/shared/status-badge.tsx
import { cn } from '@/lib/utils'

type TaskStatus = 'draft' | 'in_progress' | 'review' | 'done' | 'rejected' | 'overdue'

const STATUS_CONFIG: Record<TaskStatus, {
  label: string
  className: string
}> = {
  draft:       { label: 'Draft',       className: 'bg-surface-2 text-muted border-border-1' },
  in_progress: { label: 'On Progress', className: 'bg-gold/10 text-gold border-gold/20' },
  review:      { label: 'Review',      className: 'bg-blue/10 text-blue border-blue/20' },
  done:        { label: 'Done',        className: 'bg-green/10 text-green border-green/20' },
  rejected:    { label: 'Rejected',    className: 'bg-red/10 text-red border-red/20' },
  overdue:     { label: 'Overdue',     className: 'bg-red/15 text-red border-red/30 font-semibold' },
}

interface StatusBadgeProps {
  status: TaskStatus
  size?: 'sm' | 'md'
  className?: string
}

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  
  return (
    <span className={cn(
      'inline-flex items-center border rounded font-mono font-medium tracking-wide',
      size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
      config.className,
      className
    )}>
      {config.label}
    </span>
  )
}
```

### UserAvatar Component
```typescript
// components/shared/user-avatar.tsx
interface UserAvatarProps {
  name: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE_MAP = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
}

// Consistent color per user (based on name hash)
function getAvatarColor(name: string): string {
  const colors = [
    'bg-gold/15 text-gold border-gold/30',
    'bg-blue/15 text-blue border-blue/30',
    'bg-green/15 text-green border-green/30',
    'bg-amber/15 text-amber border-amber/30',
    'bg-red/15 text-red border-red/30',
    'bg-purple/15 text-purple border-purple/30',
  ]
  const index = name.charCodeAt(0) % colors.length
  return colors[index]
}

export function UserAvatar({ name, avatarUrl, size = 'md', className }: UserAvatarProps) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn('rounded-full border', SIZE_MAP[size], className)}
      />
    )
  }
  
  return (
    <div className={cn(
      'rounded-full border flex items-center justify-center font-display font-semibold flex-shrink-0',
      SIZE_MAP[size],
      getAvatarColor(name),
      className
    )}>
      {initials}
    </div>
  )
}
```

### KPICard Component
```typescript
// components/dashboard/kpi-card.tsx
interface KPICardProps {
  label: string
  value: string | number
  delta?: { value: number; isPositive: boolean }
  icon: React.ReactNode
  iconVariant?: 'gold' | 'green' | 'red' | 'blue'
  progressPercent?: number
  onClick?: () => void
}

const ICON_VARIANTS = {
  gold:  'bg-gold/10 text-gold',
  green: 'bg-green/10 text-green',
  red:   'bg-red/10 text-red',
  blue:  'bg-blue/10 text-blue',
}

export function KPICard({
  label, value, delta, icon,
  iconVariant = 'gold', progressPercent, onClick
}: KPICardProps) {
  return (
    <div
      className={cn(
        'bg-surface-1 border border-border-1 rounded-xl p-4',
        'transition-colors hover:border-border-2',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          ICON_VARIANTS[iconVariant]
        )}>
          {icon}
        </div>
        {delta && (
          <span className={cn(
            'text-[10px] font-mono',
            delta.isPositive ? 'text-green' : 'text-red'
          )}>
            {delta.isPositive ? '↑' : '↓'} {Math.abs(delta.value)}%
          </span>
        )}
      </div>
      
      <div className="font-display font-bold text-3xl text-primary leading-none mb-1.5">
        {value}
      </div>
      <div className="text-[10px] font-mono text-muted uppercase tracking-widest">
        {label}
      </div>
      
      {progressPercent !== undefined && (
        <div className="mt-2.5 h-[3px] bg-border-1 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gold transition-all duration-500"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
      )}
    </div>
  )
}
```
