# AGENT: nexus-media-agent
# Domain: Domain Expert
# Project Scope: NEXUS MEDIA — Internal Media Team Platform

## Identitas
Kamu adalah expert untuk platform NEXUS MEDIA milik Easy Going Group.
Kamu tahu setiap detail sistem ini dari database schema, fitur, tech stack,
hingga business context-nya. Gunakan agent ini ketika mengerjakan apapun
yang berkaitan dengan NEXUS MEDIA.

## Project Context
```
Platform:     NEXUS MEDIA v1.0
Stack:        Next.js 14 + TypeScript + Tailwind + shadcn/ui + Supabase
Jobs:         Trigger.dev v4
Storage:      Cloudflare R2 + Google Drive API
AI:           Anthropic Claude API + Replicate API
Notif:        Supabase Realtime + Fonnte (WA)
Cache:        Redis (Upstash)
Deploy:       Vercel
Repo:         github.com/easygoinggroup/nexus-media
```

## Struktur Aplikasi
```
/apps/nexus-media/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── callback/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Sidebar + topbar shell
│   │   ├── page.tsx            # Dashboard KPI
│   │   ├── tasks/
│   │   │   ├── page.tsx        # Task list/kanban/timeline
│   │   │   └── [id]/page.tsx   # Task detail modal
│   │   ├── planner/
│   │   │   └── page.tsx        # Content planner + ideas + caption AI
│   │   ├── notifications/
│   │   │   └── page.tsx        # Notification inbox
│   │   ├── ai-cover/
│   │   │   └── page.tsx        # AI image generator
│   │   ├── assets/
│   │   │   └── page.tsx        # Asset database
│   │   ├── brand/
│   │   │   └── page.tsx        # Brand guideline
│   │   └── admin/
│   │       └── users/page.tsx  # User management
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── webhooks/trigger/route.ts
│       ├── ai/cover/route.ts
│       ├── ai/caption/route.ts
│       └── drive/[...path]/route.ts
├── components/
│   ├── dashboard/              # Dashboard-specific components
│   ├── tasks/                  # Task management components
│   ├── planner/                # Content planner components
│   └── shared/                 # Shared across pages
├── lib/
│   ├── supabase/
│   ├── actions/
│   ├── ai/
│   ├── r2.ts
│   ├── google-drive.ts
│   └── fonnte.ts
├── trigger/
│   └── jobs/
└── types/
    └── supabase.ts             # Auto-generated dari Supabase CLI
```

## Business Rules
```
1. TASK CATEGORIES & STEPS
   VIDEO:   Raw Cut → Fine Cut → Editing Final → Review → Rendering → Upload (6 steps)
   DESIGN:  Brief → Konsep → Design → Revisi → Final → Cetak/Deploy (6 steps)
   COPY:    Draft → Review → Approval (3 steps)
   EVENT:   Konsep → Vendor → Promosi → Pelaksanaan → Laporan (5 steps)
   SALES:   Brief → Proposal → Deal/Closing (3 steps)
   PARTNER: Approach → Negosiasi → Deal → Aktivasi/Live (4 steps)

2. XP SYSTEM
   Setiap step memiliki XP sesuai complexity-nya
   Total XP per task = 100 XP
   Level user = floor(total_xp / 100) + 1
   8 achievements tersedia

3. CONTENT PIPELINE STAGES
   Ideas → Brief → In Production → Review → Scheduled → Published

4. NOTIFICATION TRIGGERS (Otomatis via Trigger.dev)
   - Task overdue: cek setiap jam
   - Reminder H-1 dan H-3: setiap hari jam 08:00
   - Weekly report: setiap Senin jam 08:00

5. ROLE-BASED DATA ACCESS
   - Manager: lihat semua outlet
   - SPV: hanya outlet sendiri
   - Kepala Media: semua outlet (media scope)
   - Staff Media: semua outlet (execute only)
   - Guest: view-only brand guideline
```

## Current Development Status (V1)
```
Phase 1 (Minggu 1-2): Auth + Role + Layout Shell
Phase 2 (Minggu 3-4): Task Manager + Notifikasi
Phase 3 (Minggu 5-6): Dashboard KPI + Content Planner
Phase 4 (Minggu 7-8): QA + Deploy

V2 (Post-launch):
- AI Cover Generator (F6)
- Asset Database + Drive (F7)
- Brand Guideline (F8)
```

## Key Decisions Made
```
✅ Blitz.js ditolak → gunakan Next.js + Supabase
✅ Supabase Storage ditolak untuk assets → gunakan Cloudflare R2
✅ WA Business API ditunda ke V2 → gunakan Fonnte di V1
✅ Notifikasi V1 = in-app + copy button WA manual
✅ Gamified progress = XP system per kategori task
✅ Database: PostgreSQL via Supabase, RLS per outlet_id
```
