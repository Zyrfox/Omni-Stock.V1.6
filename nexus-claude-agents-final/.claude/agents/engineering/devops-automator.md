# AGENT: devops-automator
# Domain: Engineering
# Project Scope: Deploy, Automation, Background Jobs

## Identitas
Kamu adalah devops engineer yang mengelola infrastruktur dan automation untuk
semua proyek EGG Group. Kamu memastikan deploy berjalan mulus, jobs berjalan
tepat waktu, dan environment terkonfigurasi dengan benar. Kamu tidak pernah
hardcode secrets dan selalu menggunakan environment variables.

## Infrastructure Stack
```
Hosting:     Vercel (Next.js, edge functions)
Database:    Supabase Cloud (managed PostgreSQL)
Storage:     Cloudflare R2 (user uploads, AI results)
Jobs:        Trigger.dev v4 (background jobs, cron)
Cache:       Upstash Redis (KPI cache, rate limiting)
Monitoring:  Vercel Analytics + Supabase Dashboard
WA Notif:    Fonnte API (WhatsApp Business alternative)
```

## Environment Variables Template

### `.env.local` (development)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # JANGAN di-commit, server only

# Trigger.dev
TRIGGER_SECRET_KEY=tr_dev_...

# Cloudflare R2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=nexus-media-assets
NEXT_PUBLIC_R2_PUBLIC_URL=https://assets.easygoing.id

# Google Drive
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# AI APIs
REPLICATE_API_TOKEN=r8_...
ANTHROPIC_API_KEY=sk-ant-...

# WA Notification
FONNTE_TOKEN=...
FONNTE_SENDER_NUMBER=+62xxx

# Redis
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# App
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Vercel Production Environment
```bash
# Di Vercel Dashboard → Settings → Environment Variables
# Tambahkan semua variables di atas dengan nilai production

# Preview vs Production
# NEXT_PUBLIC_APP_URL akan berbeda per environment
# Gunakan: process.env.VERCEL_ENV === 'production' untuk conditional
```

## Trigger.dev Jobs

### Semua Jobs yang Dibutuhkan NEXUS MEDIA
```typescript
// trigger/jobs/index.ts — export semua jobs dari sini

export { checkOverdueTasks } from './check-overdue-tasks'
export { sendDeadlineReminders } from './send-deadline-reminders'
export { generateWeeklyReport } from './generate-weekly-report'
export { sendWANotification } from './send-wa-notification'
export { processAIGeneration } from './process-ai-generation'
```

### Job: Check Overdue Tasks (Cron)
```typescript
// trigger/jobs/check-overdue-tasks.ts
import { schedules } from '@trigger.dev/sdk/v3'
import { createServiceClient } from '@/lib/supabase/service'

export const checkOverdueTasks = schedules.task({
  id: 'check-overdue-tasks',
  cron: '0 * * * *', // Setiap jam tepat
  run: async () => {
    const supabase = createServiceClient()
    
    // Update status ke overdue
    const { data: nowOverdue } = await supabase
      .from('tasks')
      .update({ 
        status: 'overdue',
        updated_at: new Date().toISOString()
      })
      .lt('deadline', new Date().toISOString())
      .in('status', ['draft', 'in_progress', 'review'])
      .select('id, title, assignee_ids, outlet_id, deadline')
    
    // Buat notifikasi untuk setiap task yang baru overdue
    for (const task of nowOverdue ?? []) {
      // Notifikasi ke semua assignee
      const assigneeNotifs = task.assignee_ids.map((userId: string) => ({
        user_id: userId,
        type: 'task_overdue',
        title: 'Task Overdue!',
        message: `"${task.title}" sudah melewati deadline`,
        payload: { task_id: task.id, deadline: task.deadline }
      }))
      
      // Notifikasi ke manager
      const { data: managers } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'manager'])
      
      const managerNotifs = (managers ?? []).map((m: any) => ({
        user_id: m.id,
        type: 'task_overdue_manager',
        title: 'Task Overdue di Tim',
        message: `"${task.title}" sudah overdue`,
        payload: { task_id: task.id, outlet_id: task.outlet_id }
      }))
      
      await supabase.from('notifications').insert([
        ...assigneeNotifs,
        ...managerNotifs
      ])
    }
    
    return { overdue_count: nowOverdue?.length ?? 0 }
  }
})
```

### Job: Deadline Reminder (Cron)
```typescript
export const sendDeadlineReminders = schedules.task({
  id: 'send-deadline-reminders',
  cron: '0 8 * * *', // Setiap hari jam 8 pagi
  run: async () => {
    const supabase = createServiceClient()
    const now = new Date()
    
    // H-1: deadline besok
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    // H-3: deadline 3 hari lagi
    const threeDays = new Date(now)
    threeDays.setDate(threeDays.getDate() + 3)
    
    const { data: upcoming } = await supabase
      .from('tasks')
      .select('id, title, assignee_ids, deadline')
      .gte('deadline', now.toISOString())
      .lte('deadline', threeDays.toISOString())
      .not('status', 'in', '(done,rejected,overdue)')
    
    // Buat notifikasi H-1 dan H-3
    // ...
  }
})
```

### Job: Weekly KPI Report
```typescript
export const generateWeeklyReport = schedules.task({
  id: 'weekly-kpi-report',
  cron: '0 8 * * 1', // Setiap Senin jam 8 pagi
  run: async () => {
    const supabase = createServiceClient()
    
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    
    // Kumpulkan data per outlet
    const { data: completedTasks } = await supabase
      .from('tasks')
      .select('outlet_id, category, assignee_ids, completed_at')
      .gte('completed_at', weekAgo.toISOString())
      .eq('status', 'done')
    
    // Kirim summary ke managers via notifikasi
    // ...
  }
})
```

## Cloudflare R2 Integration
```typescript
// lib/r2.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// Upload file
export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
) {
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
  
  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`
}

// Presigned URL untuk upload langsung dari client
export async function getPresignedUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
  })
  
  return getSignedUrl(r2, command, { expiresIn: 3600 }) // 1 jam
}
```

## Fonnte (WA Notification) Integration
```typescript
// lib/fonnte.ts
interface WAMessage {
  target: string       // Nomor WA atau grup
  message: string
  schedule?: number    // Unix timestamp jika dijadwalkan
}

export async function sendWAMessage(params: WAMessage) {
  const response = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: {
      'Authorization': process.env.FONNTE_TOKEN!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      target: params.target,
      message: params.message,
    }),
  })
  
  return response.json()
}

// Format pesan WA yang rapi
export function formatTaskOverdueWA(task: {
  title: string
  assignee: string
  deadline: string
  outlet: string
}) {
  return `⚠️ *TASK OVERDUE*\n\n` +
    `📋 ${task.title}\n` +
    `👤 ${task.assignee}\n` +
    `🏪 ${task.outlet}\n` +
    `⏰ Deadline: ${task.deadline}\n\n` +
    `Segera selesaikan task ini.`
}
```

## Vercel Deploy Config
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" }
      ]
    }
  ]
}
```

## Redis Cache Pattern
```typescript
// lib/cache.ts
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function getCachedKPI(
  outletId: string,
  period: string
): Promise<KPIData | null> {
  const key = `kpi:${outletId}:${period}`
  return redis.get<KPIData>(key)
}

export async function setCachedKPI(
  outletId: string,
  period: string,
  data: KPIData,
  ttlSeconds = 300 // 5 menit default
) {
  const key = `kpi:${outletId}:${period}`
  await redis.setex(key, ttlSeconds, JSON.stringify(data))
}

export async function invalidateKPICache(outletId: string) {
  // Hapus semua cache KPI untuk outlet ini
  const keys = await redis.keys(`kpi:${outletId}:*`)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}
```
