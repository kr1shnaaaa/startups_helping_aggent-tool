# STATE.md — StartupLink Project State

**Last Updated:** 2026-09-26  
**Phase:** Phase 3 & 4 - 3-Phase Idea Workflow & Candidate Matching Engine  
**Workflow Status:** 3-Phase Idea Persistence & Resumption Complete; Candidate Matching Engine verified and connected

---

## Current State

### ✅ Completed

- [x] Codebase analysis and mapping
- [x] PROJECT.md / REQUIREMENTS.md / ROADMAP.md
- [x] Phase 1 backend foundation + Vercel AI SDK integration
- [x] Phase 1 UAT verification
- [x] Phase 2: deterministic matching engine + ranked snapshots
- [x] Phase 2: invitation lifecycle & team formation
- [x] Phase 4A: 20 Candidate demo data seed script (`npm run seed:candidates`)
- [x] Phase 4B: Talent matching engine audit, scoring verification, and founder self-exclusion
- [x] 3-Phase Idea Workflow Persistence & Resumable UX:
  - Phase 1 (Raw Idea): Create & edit with safe data preservation (`/app/ideas/create`, `/app/ideas/:ideaId/raw`)
  - Phase 2 (Enhanced Concept): Review & edit with explicit AI regeneration (`/app/ideas/:ideaId/enhance`)
  - Phase 3 (Critical Analysis & Approval): View score, team skills, approval flow (`/app/ideas/:ideaId/analysis`)
  - Idea Detail Central Hub (`/app/ideas/:ideaId`)
  - My Ideas status-aware CTAs and score pills (`/app/ideas`)
  - 3-Phase visual stepper component (`IdeaWorkflowProgress`)
  - Zero-data-loss backward and forward navigation across all phases

### 📋 Upcoming

- [ ] End-to-end multi-user UAT test scenarios with live Firebase auth
- [ ] Production deployment prep

---

## Key Decisions Made

| Decision              | Value                            | Rationale                                     |
| --------------------- | -------------------------------- | --------------------------------------------- |
| Primary User          | Idea Founders                    | Most acute pain point                         |
| 3-Phase Persistence   | original + enhanced + aiAnalysis | Zero data loss on backward/forward navigation |
| AI Triggering         | On-demand only                   | Never auto-regenerate on page revisit         |
| AI Provider           | Vercel AI SDK + OpenAI/Gemini    | Configurable in `.env` without code change    |
| Matching weights      | 40/15/15/15/15                   | Locked F4.2 formula, scoringVersion v1        |
| Match identity        | `{ ideaId, userId }`             | One snapshot per idea/candidate               |
| Availability fallback | 0.5 unknown                      | Idea has no hours/work-mode requirement       |

---

## Artifacts Generated

| Artifact        | Location                                                  | Purpose                    |
| --------------- | --------------------------------------------------------- | -------------------------- |
| PROJECT.md      | `.planning/PROJECT.md`                                    | Vision and constraints     |
| ROADMAP.md      | `.planning/ROADMAP.md`                                    | Phase breakdown            |
| API Contract    | `BACKEND_API_CONTRACT.md`                                 | Source of truth for APIs   |
| Stepper UI      | `frontend/src/components/common/IdeaWorkflowProgress.jsx` | 3-Phase progress component |
| Idea Detail Hub | `frontend/src/pages/dashboard/IdeaDetailPage.jsx`         | Central resume/detail page |
| STATE.md        | `.planning/STATE.md`                                      | This file                  |
