# NEXUS AGENT SYSTEM — Easy Going Group
# Master Index v1.0 | Owner: Ilham (Manager Komersial)

## Arsitektur
Sistem ini adalah kumpulan agent instruction files (.md) yang dirancang untuk
Claude Code CLI. Setiap file mendefinisikan persona, konteks, dan behavior
spesifik untuk satu domain kerja. Ketika kamu memulai sesi baru, panggil
agent yang paling relevan dengan konteks pekerjaan yang akan dilakukan.

## Cara Pakai
1. Di awal sesi Claude Code: `Use the [agent-name] agent from .claude/agents/`
2. Atau: copy paste isi file .md sebagai system prompt
3. Atau: referensikan langsung `See .claude/agents/domain/nexus-media-agent.md`

---

## DIREKTORI AGENTS

### engineering/
| File | Fungsi |
|------|--------|
| frontend-developer.md | Next.js 14+, React, Tailwind, shadcn/ui, TypeScript |
| backend-architect.md | Supabase, PostgreSQL, RLS, Server Actions, API design |
| database-engineer.md | Schema design, migrations, indexing, RLS policies |
| devops-automator.md | Vercel deploy, Trigger.dev, Redis, CI/CD, env config |
| api-integrator.md | Google Drive, Replicate, Claude API, Fonnte, OAuth |
| realtime-engineer.md | Supabase Realtime, WebSocket, live dashboard updates |
| rapid-prototyper.md | HTML/CSS/JS satu file, prototype cepat, validasi ide |

### product/
| File | Fungsi |
|------|--------|
| prd-writer.md | Buat PRD lengkap, user stories, acceptance criteria |
| feature-planner.md | Breakdown fitur ke tasks, estimasi effort, dependencies |
| sprint-prioritizer.md | Prioritas backlog, MoSCoW framework, scope decision |
| roadmap-architect.md | Roadmap multi-phase, milestone, go/no-go criteria |

### design/
| File | Fungsi |
|------|--------|
| ui-architect.md | Layout system, component hierarchy, design tokens |
| component-builder.md | shadcn/ui components, reusable patterns, dark mode |
| ux-researcher.md | User flow, pain points, usability review |
| brand-guardian.md | EGG brand identity, outlet color, typography rules |

### marketing/
| File | Fungsi |
|------|--------|
| content-strategist.md | Strategi konten per outlet, kalender editorial |
| caption-writer.md | Caption IG/TikTok/FB dalam Bahasa Indonesia |
| social-media-planner.md | Jadwal posting, platform mix, engagement strategy |
| growth-analyst.md | Analisis performa konten, KPI sosmed, A/B test ide |

### operations/
| File | Fungsi |
|------|--------|
| project-manager.md | Task breakdown, timeline, risk management, standup |
| qa-tester.md | Test case, bug report, edge case hunting |
| documentation-writer.md | README, SOP, user guide, changelogs |
| performance-optimizer.md | Query optimization, bundle size, Core Web Vitals |

### domain/
| File | Fungsi |
|------|--------|
| nexus-media-agent.md | Expert NEXUS MEDIA platform — full context |
| omni-stock-agent.md | Expert OMNI-STOCK V1.6 inventory system |
| nexus-hris-agent.md | Expert NEXUS HRIS Google Sheets HR system |
| trading-ea-engineer.md | MQL4/MQL5 Expert Advisor, XAU/USD & BTC/USD |
| lifeos-architect.md | LifeOS wellness app — diet, habit, AI assistant |
| varx-engineer.md | VARX AI video editing agent, DaVinci Resolve Python API |
| egg-group-context.md | Konteks bisnis EGG Group — semua outlet, tim, goals |

### meta/
| File | Fungsi |
|------|--------|
| task-router.md | Agent yang membantu pilih agent mana yang tepat |
| code-reviewer.md | Review code quality, security, performance, best practices |

---

## STACK GLOBAL EGG GROUP
```
Frontend:  Next.js 14+ (App Router) · TypeScript · Tailwind CSS · shadcn/ui
Backend:   Supabase (PostgreSQL + RLS + Realtime + Auth)
Jobs:      Trigger.dev v4
Storage:   Cloudflare R2 (assets) + Google Drive API (archival)
AI:        Anthropic Claude API (text) + Replicate API (image)
Cache:     Redis via Upstash
Notif:     Supabase Realtime + Fonnte (WA)
Deploy:    Vercel
VCS:       GitHub
```

## PRINSIP KERJA
- PRD dulu sebelum kode — tidak ada kode tanpa spec
- Output production-ready, bukan scaffold
- Bahasa komunikasi: Bahasa Indonesia informal (Jakarta register)
- Kode: TypeScript strict, no any, clean architecture
- Setiap perubahan DB: tulis migration file, jangan langsung edit
