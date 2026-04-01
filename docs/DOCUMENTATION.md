# Implementation Plan: Alabama Entrepreneurial Network

## Table of Contents
1. [Matching Algorithm](#matching-algorithm)
2. [Tech Stack Setup](#tech-stack-setup)
3. [Key Decisions](#key-decisions)
---

## Matching Algorithm

### Phase 1: Rules-Based Scoring

#### Score Components (Total: 100 points)

1. **Complementarity (30 points)**
   - Analyze skills overlap vs complementarity
   - Builder + seller = high complementarity
   - Technical + domain expert = high complementarity
   - Too much overlap = lower score
   - Formula: `complementarity_score = calculate_complementarity(user1.skills, user2.skills)`

2. **Stage Alignment (20 points)**
   - Exact match: 20 points
   - Adjacent stages: 15 points (idea↔MVP, MVP↔revenue, revenue↔growth)
   - Far apart: 5 points

3. **Commitment Alignment (15 points)**
   - Both full-time: 15 points
   - Both part-time: 15 points
   - One exploratory: 10 points
   - Mismatch: 5 points

4. **Working Style (15 points)**
   - Structured + structured: 15 points
   - Chaotic + chaotic: 15 points
   - Mixed compatibility: 10 points
   - Mismatch: 5 points

5. **Location Fit (10 points)**
   - Same location: 10 points
   - Both open to remote: 8 points
   - One open to travel: 6 points
   - Mismatch: 2 points

6. **Intent and Proof of Work (10 points)**
   - Both have proof of work: 10 points
   - One has proof: 6 points
   - Neither: 3 points
   - Availability status bonus: +2 if both "actively_looking"

### Additions from implementation plan

The following enhancements are planned:

- **Skill topology** – Beyond a simple technical/non-technical flag: cluster skills into complementary domains (e.g. Frontend/Backend/AI/Business). Two technical co-founders is treated as a valid, strong pairing (complementary technical types or same cluster).
- **Anti-preferences** – Explicit “avoid” lists (industries, roles) extracted from profiles; matches that violate these are filtered or zeroed out (dealbreaker filter).
- **Dynamic weighting** – User-defined importance (e.g. sliders) for each score component so weights can be personalized.
- **Pipeline** – Hard filters (SQL) first; then retrieval (rule-based for MVP; optional later: hybrid pgvector + BM25 with Reciprocal Rank Fusion); then rule-based scoring; optional LLM re-rank on top N for negation and “too many chiefs” detection.
- **Bonus components** – Interest overlap (+5) and preference alignment (+5) as separate bonuses where interests and cofounder preferences exist.
- **Threshold and explanations** – Filter out matches below a minimum score (e.g. 40); generate human-readable explanations from the score breakdown for each match.

---

## Tech Stack Setup

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install fastapi uvicorn sqlalchemy psycopg2-binary alembic pydantic python-dotenv
pip install pgvector  # For future vector search
```

### Frontend Setup
```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --app
npm install @clerk/nextjs
npx shadcn-ui@latest init
```

### Database Setup
- Use Docker Compose for local PostgreSQL
- Enable pgvector extension
- Set up connection pooling

### Environment Variables
```env
# Backend .env
DATABASE_URL=postgresql://user:password@localhost:5432/cmk
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...
CLERK_WEBHOOK_SECRET=whsec_...   # Optional; for /webhooks/clerk (user.deleted)
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:3000,...

# Frontend .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Key Decisions

### 1. Authentication
- **Decision**: Use Clerk
- **Rationale**: Fast setup, handles user management, JWT tokens, social auth

### 2. Database
- **Decision**: PostgreSQL with pgvector
- **Rationale**: Robust, supports JSONB for flexible schemas, pgvector for future AI features

### 3. Matching Approach
- **Decision**: Start with rules-based, add ML later
- **Rationale**: Faster MVP, transparent scoring, easier to debug

### 4. Search
- **Decision**: PostgreSQL full-text search for MVP
- **Rationale**: Built-in, no additional infrastructure, sufficient for MVP

### 5. API Design
- **Decision**: RESTful API with FastAPI
- **Rationale**: Clear structure, auto-documentation, type safety with Pydantic

### 6. Frontend Framework
- **Decision**: Next.js 14+ with App Router
- **Rationale**: Server components, good performance, TypeScript support

### 7. Styling
- **Decision**: Tailwind CSS + shadcn/ui
- **Rationale**: Fast development, consistent design system, accessible components

### 8. Deployment
- **Decision**: Vercel (frontend) + Render/Fly.io (backend)
- **Rationale**: Easy deployment, good free tiers, PostgreSQL support

---

## Development Changelog

This section logs major changes shipped to the project. Only significant changes are recorded here (new features, major refactors, architecture changes).

### 2026-03-31 - PROJECT COMPLETION - Co-Founder Matching Platform v1.0.0
- **FINAL RELEASE**: All development objectives completed and production deployment operational
- **Issue Resolution**: Closed final two open issues (#98 Production Clerk redirect, #102 QA checklist alignment)
- **Production Ready**: Platform fully functional for TechStars with comprehensive matching, onboarding, vetting, and resource systems
- **Quality Assurance**: All CI/CD tests passing, comprehensive form validation implemented, security hardening complete
- **Status**: Software marked as complete and ready for production use

### 2026-02-27 - Admin QA Fixes, Deployment & Auth (PRs #59, #60)
- Render deployment live: backend at `https://cofounder-api.onrender.com`, frontend at `https://cofounder-matching-git-main-thabhelos-projects.vercel.app`
- `render.yaml` Blueprint provisions `cofounder-api` (Starter) and `cofounder-db` (basic-256mb Postgres 16, Oregon)
- GitHub Actions smoke test (`deploy.yml`) polls `/health` and verifies public + auth-protected endpoints on every push to main
- Clerk webhook configured for `user.deleted` at `/webhooks/clerk`; `CLERK_WEBHOOK_SECRET` set in Render env
- Email/password sign-in fixed: enabled Password strategy in Clerk Dashboard and disabled Client Trust; existing OAuth-only accounts can add a password via forgot-password flow; account linking handles new users automatically
- Admin audit log now resolves admin names from User table instead of showing raw Clerk IDs
- Report type filter added to admin reports tab (spam, harassment, inappropriate, fake, other)
- Per-report resolution notes textarea added; notes submitted with review action
- Overview tab shows error state when stats API fails
- `AuditLogEntry` type updated with `admin_name` field
- `DEPLOYMENT.md` updated with correct Render Postgres plan (`basic-256mb`) and actual Vercel URL

### 2026-02-27 - [db2f29b] Admin Audit Log & News Table Removal (PR #58)
- Added `AdminAuditLog` model (`backend/app/models/admin_audit.py`) to track all admin actions with `admin_id`, `action`, `target_type`, `target_id`, `details`, `timestamp`
- Migration `a1b2c3d4e5f6_admin_audit_log` creates `admin_audit_logs` table; migration `b2c3d4e5f6a7_drop_news_table` drops `news` table (feature cancelled)
- `GET /api/v1/admin/audit-log` - paginated audit log with `admin_id`, `action`, `target_type` filters
- `GET /api/v1/admin/analytics` - daily signups/matches time-series for growth charts
- Admin dashboard: added Analytics tab (charts) and Audit Log tab; Resources and Events tabs for admin review/edit/delete
- All admin write actions (`ban`, `unban`, `approve`, `reject`, `verify`, `update`, `delete`) now write an audit log entry via `_log_admin_action`
- Removed `News` model and all news-related code; `app/models/__init__.py` updated

### 2026-02-22 - [dfac7f3] Admin Moderation System (PR #57)
- `ADMIN_CLERK_IDS` config var; `get_current_admin_user` and `get_admin_clerk_ids` dependencies in `api/deps.py`
- `POST /api/v1/reports` - submit abuse report (`reported_user_id`, `type`, `description`)
- `GET /api/v1/admin/check` - returns `is_admin` bool (used by frontend to show/hide Admin nav link)
- `GET /api/v1/admin/stats` - platform counts: users, bans, pending reviews, reports, orgs, matches, messages, 7-day signups
- `GET /api/v1/admin/reports`, `PUT /api/v1/admin/reports/{id}` - reports queue with resolve/dismiss actions
- `GET /api/v1/admin/users`, `PUT /api/v1/admin/users/{id}`, `DELETE /api/v1/admin/users/{id}` - user management
- `PUT /api/v1/admin/users/{id}/ban`, `/unban`, `/approve`, `/reject` - moderation actions
- `GET /api/v1/admin/organizations`, `PUT /api/v1/admin/organizations/{id}/verify`, `PUT`/`DELETE` - org management
- Frontend: report modal on profile page; Admin sidebar link visible only to admins; admin dashboard with Overview, Reports, Users, Organizations tabs; access-denied view with dev hint when not configured

### 2026-02-22 - [242c47e] Profile Discovery Enhancements & Unmatch (PR #56)
- `matched_before` flag added to profile schema so discovery can surface previously unmatched profiles
- Discovery logic updated: active matches hidden from discover feed; unmatched profiles reappear
- `POST /api/v1/matches/{match_id}/unmatch` - resets match status so profile re-enters discovery
- Frontend discover page and inbox thread page updated for new data shapes and unmatch button

### 2026-02-22 - [1545fa1] Rules-Based Matching Algorithm (PR #55)
- New `backend/app/services/matching.py` scores user pairs across: complementarity, commitment, location fit, intent, interest overlap, preference alignment
- Match creation (`profiles.py`) and update logic (`matches.py`) now call the scoring service and store component scores
- Profile discovery (`GET /api/v1/matches/recommendations`) orders results by descending match score
- Unit tests added: `backend/tests/test_matching.py` (scoring accuracy and edge cases)

### 2026-02-13 - [9924f13] Playwright E2E Tests & Match Schema Fixes (PRs #51, #52)
- Playwright configured (`playwright.config.ts`); E2E test suite covering auth, onboarding, discover, messaging flows (`frontend/e2e/`)
- Match schema: `interest_overlap_score` and `preference_alignment_score` added; deprecated `stage_alignment_score` and `working_style_score` removed
- `.gitignore` updated; intro request validation and privacy improvements in `matches.py`

### 2026-02-13 - Comprehensive Profile Update & Onboarding Refactor (refactor/user-profile-improvements)
- **User profile schema overhaul**
  - `bio` renamed to `introduction`; `role_intent` replaced by `idea_status` (`not_set_on_idea`, `have_ideas_flexible`, `building_specific_idea`)
  - New location fields: `location_city`, `location_state`, `location_country`, `location_latitude`, `location_longitude`
  - New personal: `gender`, `birthdate`; professional links: `twitter_url`, `instagram_url`, `calendly_url`, `video_intro_url`
  - New story/background: `life_story`, `hobbies`, `impressive_accomplishment`, `education_history`, `employment_history`
  - New startup/readiness: `is_technical`, `startup_name`, `startup_description`, `startup_progress`, `startup_funding`, `ready_to_start`, `areas_of_ownership`, `topics_of_interest`, `domain_expertise`, `equity_expectation`, `work_location_preference`
  - New co-founder preferences: `looking_for_description`, `pref_*` (idea, technical, timing, location, age, areas, interests, importance levels), `alert_on_new_matches`
  - System: `behavior_agreement_accepted_at`, `profile_status` (`incomplete`, `pending_review`, `approved`, `rejected`)
  - Migration: `f1a2b3c4d5e6_comprehensive_profile_update` migrates existing data and drops `bio`/`role_intent`
- **Behavior agreement & onboarding flow**
  - POST `/api/v1/users/accept-behavior-agreement` records acceptance (required before completing onboarding)
  - Onboarding endpoint accepts existing user and updates profile; returns 200 when updating, 201 when creating
  - Frontend: agreement step then basics → you → preferences → preview; draft persisted in session via `hooks/useOnboardingDraft.ts`
- **Clerk webhook**
  - POST `/webhooks/clerk` for `user.deleted`; deletes or deactivates user in DB so same email can re-sign up; requires `CLERK_WEBHOOK_SECRET`
- **Other**
  - User search uses `idea_status` and `introduction` (no `role_intent`/`bio`); `availability_status` and `trust_score` sort removed
  - Match recommendations: role-based founder/cofounder filter removed on this branch (all eligible users returned; algorithm may be re-added later)
  - Schema validators in `app/schemas/user.py` refactored to shared helpers (`_validate_one_of_required`, `_validate_one_of_optional`, `_validate_list_items`)
  - Email duplicate handling: 409 with clear message on signup/onboarding when email already exists

### 2026-02-05 - Introduction & Connection System, Search & Filtering, Messaging System
- **Introduction & Connection System**: Complete workflow for requesting and accepting introductions
  - POST /api/v1/matches/{match_id}/intro - Request introduction with personalized message (100-500 chars)
  - POST /api/v1/matches/{match_id}/intro/respond - Accept/decline introduction requests
  - PUT /api/v1/matches/{match_id}/status - Update match status (viewed, saved, dismissed)
  - Rate limiting: 20 intro requests per day per user
  - Connection states: pending, viewed, saved, intro_requested, connected, dismissed
- **Advanced Search & Filtering**: Enhanced search across all entities
  - User search: Full-text search on name/bio, filters (role, stage, commitment, location), sorting options
  - Resource search: Search by title/description, filters (category, type, stage, organization), sorting
  - Event search: Search by title/description, filters (type, location, organization, date), sorting
  - Organization search: Search by name/description, filters (type, verified, location), sorting
- **Messaging System**: Complete messaging API for connected users
  - GET /api/v1/messages - Get all conversations with unread counts
  - GET /api/v1/messages/{match_id} - Get message thread with pagination
  - POST /api/v1/messages - Send message (rate limited: 50/day)
  - PUT /api/v1/messages/{message_id}/read - Mark message as read
  - PUT /api/v1/messages/match/{match_id}/read-all - Mark all messages in thread as read
  - GET /api/v1/messages/unread/count - Get unread message counts
  - Polling-based delivery (WebSockets planned for V2)
  - Only connected users can message each other
- **Dashboard & Profile Discovery UI**: Frontend implementation for core user flows
  - Dashboard page with match counts and quick actions
  - Profile discovery page with YC-style matching flow
  - Improved authentication redirect flow
  - User onboarding completion tracking

### 2026-01-28 - [1a5dbd2] Docker Containerization, CI/CD Pipelines 
- **Docker Containerization**: Production-ready Dockerfiles for backend and frontend
  - Multi-stage builds for optimized image sizes
  - Health checks and proper environment handling
  - Docker Compose configuration (compose.yaml)
  - .dockerignore files for both services
- **CI/CD Pipelines**: Three comprehensive GitHub Actions workflows
  - build.yml: Multi-platform Docker builds with Trivy security scanning
  - ci.yml: Automated testing, linting, and type checking with PostgreSQL service
  - deploy.yml: Production deployment with rollback capabilities

### 2026-01-28 - [1a5dbd2] Authentication with Clerk
- **Authentication System**: Persistent authentication with Clerk integration
  - Frontend middleware for route protection
  - Session management and user authentication flow
  - Secure redirect handling for authenticated routes
- **Enhanced User Model**: Comprehensive onboarding fields
  - experience_level, motivation, availability, bio
  - linkedin_url, github_url, website, preferred_communication
  - is_active, is_banned flags for user management
  - Three new Alembic migrations (initial schema, user flags, onboarding fields)

### 2026-01-28 - [8cf8ac7] UI retouch to mtch techstars design language
- **Professional UI Redesign**: Modern landing page and improved global styles
  - Updated color scheme and typography
  - Enhanced layout with authentication state handling
  - Responsive design improvements
- **Developer Experience**: Comprehensive documentation and automation
  - DOCKER_QUICK_START.md: Container setup guide
  - DOCKER_CI_CD_COMPLETION_SUMMARY.md: Implementation details
  - Enhanced QUICK_START.md with Clerk configuration
  - Automated setup scripts (START_SERVERS.sh, STOP_SERVERS.sh)
- **Infrastructure Improvements**:
  - Health check endpoints for both services
  - Improved error handling and logging
  - UUID support enhancements in database models
  - Test infrastructure updates for CI/CD compatibility
- **Branch Cleanup**: Removed merged feature/auth-persistence-ui-redesign branch
- **Configuration**: Added *.pid pattern to .gitignore for process management

### 2026-01-22 03:50 - Development Setup Scripts & Documentation
- **Automated Startup**: START_SERVERS.sh script for one-command launch
- **Automated Shutdown**: STOP_SERVERS.sh script for clean shutdown
- **Quick Start Guide**: Comprehensive QUICK_START.md with troubleshooting
- **Environment Files**: Created backend/.env and frontend/.env.local templates
- **Setup Automation**: Handles venv creation, dependency installation, migrations
- **Multi-Process Management**: Background processes with PID tracking
- **Log Management**: Centralized logs in logs/ directory
- **Health Checks**: Automated PostgreSQL readiness checks
- **User-Friendly Output**: Color-coded status messages, clear instructions

### 2026-01-21 03:45 - Secure Infrastructure
- **Rate Limiting**: SlowAPI middleware (100 requests/minute default)
- **Structured Logging**: Request ID tracking, log levels, production-grade format
- **Global Exception Handlers**: Prevents stack trace/info leakage, returns generic errors
- **Comprehensive Health Check**: Validates database connectivity, returns 503 on failure
- **Request ID Middleware**: X-Request-ID header for distributed tracing
- **Conditional API Docs**: Automatically disabled in production environment
- **Security Hardening**: Removed all error message information leakage
- **Prometheus Metrics**: /metrics endpoint for monitoring (production only)
- **Lifecycle Management**: Proper startup/shutdown logging
- **Production Deployment Guide**: Complete PRODUCTION.md with checklist
- **Dependencies Added**: slowapi, python-json-logger, prometheus-fastapi-instrumentator
- **Database Migrations**: Created alembic/versions directory structure

### 2026-01-20 03:30 - Comprehensive Test Suite Implementation
- **Backend Testing**: Complete pytest test suite with 100+ tests
  - Authentication and JWT verification tests
  - API endpoint tests for users, organizations, resources, events
  - Authorization and permission tests
  - Race condition and edge case tests
  - Database constraint validation tests
- **Frontend Testing**: Complete Jest + React Testing Library suite
  - API client tests (validates security fixes)
  - OnboardingForm component tests with full validation
  - Error handling and integration tests
- **Testing Infrastructure**:
  - pytest with coverage reporting (backend)
  - Jest with jsdom environment (frontend)
  - Mocked authentication and routing for isolated testing
  - Test fixtures and utilities for both environments
- **Coverage Goals**: 80%+ coverage with 100% on critical paths

### 2026-01-19 03:15 - Security Fixes and QA Improvements
- Fixed critical authentication bugs (JWKS URL, frontend API compatibility)
- Fixed race condition in event RSVP capacity checking
- Added performance optimization (cached PyJWKClient)
- Added unique constraints to junction tables (OrganizationMember, UserEventRSVP, UserSavedResource)
- Made CORS configuration environment-based for production deployment
- Created .env.example files with comprehensive documentation
- Updated CLAUDE.md with instruction to avoid creating unnecessary documentation files

### 2026-02-08 - [62592bc] Send Invitation Feature Fix
- **Database Migration Applied**: Fixed Send Invitation button that was failing with missing column error
  - Applied migration e86e4d681466 to add interest_overlap_score and preference_alignment_score columns to matches table
  - Removed deprecated stage_alignment_score and working_style_score columns from matches table
  - Removed deprecated user fields: stage_preference, working_style, communication_preference
  - Updated Match and User models, schemas, and frontend types to reflect new field structure
  - Removed related UI fields from profile editing pages
- **Root Cause**: Migration file existed but hadn't been applied to database, causing 500 errors when sending invitations
- **Impact**: Send Invitation button on /discover page now works correctly

### 2026-02-08 - [915ec27] Clerk Authentication Upgrade & Modal Sign-In Fix
- **Clerk SDK Upgrade**: Upgraded @clerk/nextjs from v4.31.8 to v6.37.3
  - Fixed critical aria-hidden focus trap bug causing modal sign-in to hang infinitely
  - Bug pattern: Sign-up worked, subsequent sign-ins hung with loading spinner forever
  - Modal received 200 OK from Clerk API but failed to close/redirect due to focus management bug
- **Breaking Changes Migration**: Updated authentication middleware
  - Migrated from deprecated authMiddleware() to clerkMiddleware()
  - Updated route protection patterns with createRouteMatcher()
  - Maintained backward compatibility for all client-side useAuth() hooks
  - Updated middleware matcher patterns for better static file handling
- **Development Scripts Hardening**:
  - Removed dangerous Alembic autogenerate fallback from START_SERVERS.sh
  - Rewrote STOP_SERVERS.sh to use port-based cleanup instead of PID files (prevents killing wrong processes after system restart)
- **Impact**: All user accounts can now sign in successfully via email/password modal

### 2026-02-28 - [ccfd7d2] Profile Approval Flow & Admin Badge
- Full profile approval workflow: users submit profile for review, admins approve or reject with optional feedback
- Profile status banner on dashboard shows current status (pending review, approved, rejected) with dismiss button
- Admin badge in sidebar shows pending review count as red indicator
- Email notification sent to user on approval or rejection via Resend
- Fixed 409 duplicate-email error during onboarding when Clerk identity changes in development
- `profile_status` field drives onboarding gating: approved profiles unlock discover and inbox

### 2026-03-01 - [2897122] Email Notification System & APScheduler (closes #24)
- Integrated Resend as transactional email provider; `RESEND_API_KEY` and `EMAIL_FROM` env vars required
- APScheduler background task runs every 24h to email users about new profile matches when `alert_on_new_matches` is enabled
- Admin controls: send custom announcement email to all active users from admin dashboard
- `POST /api/v1/admin/email-blast` - admin-only bulk email endpoint
- Reactivate user endpoint: `PUT /api/v1/admin/users/{id}/reactivate` restores banned or deactivated accounts
- Background scheduler lifecycle managed with FastAPI startup/shutdown events

### 2026-03-02 - [fed1383] Security Hardening Before Go-Live (closes #25)
- Content Security Policy headers added to `next.config.js` covering `script-src`, `style-src`, `img-src`, `connect-src`, `worker-src`, `frame-src`
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` headers applied to all routes
- Service worker (`/sw.js`) served with `no-cache` headers to prevent stale SW serving stale assets
- Trivy vulnerability scan runs on every CI push; SARIF results uploaded to GitHub Security tab
- Backend: bandit static analysis added to CI; ruff replaces flake8 for linting
- All admin endpoints require `ADMIN_CLERK_IDS` config; missing config returns 403 with dev hint

### 2026-03-03 - [c7b1c10] User Settings & Preferences Page (closes #33)
- New `/settings` page with notification preferences, account management, and danger zone
- Notification settings: email on new match, email on intro request/acceptance, weekly digest toggle
- Account section: update display name, change email (via Clerk), linked social accounts
- Danger zone: delete account flow with confirmation dialog; triggers Clerk account deletion and DB cleanup
- `PUT /api/v1/users/settings` and `GET /api/v1/users/settings` endpoints with `UserSettings` schema
- Settings persisted in `user_settings` table; defaults applied on first access

### 2026-03-04 - [992e6b5] Admin Dashboard Enhancements & Infrastructure Fixes
- Admin dashboard: Resources and Events tabs with inline edit/delete; CSV export of users list
- Fixed CSV export encoding bug causing corrupt downloads on Windows
- Added settings quick-action buttons in admin overview for common configuration tasks
- Fixed `CLERK_FRONTEND_API` not reaching backend container in Docker Compose (`env_file` directive)
- Fixed CSP `connect-src` to include `https://cofounder-api.onrender.com` so production API calls are not blocked
- Fixed onboarding redirect: existing users with null `behavior_agreement_accepted_at` no longer incorrectly sent to onboarding
- CI: frontend Docker image now builds for `linux/amd64` only, halving build time

### 2026-03-05 - [59f6367] Performance Optimizations (closes #26)
- Lazy-loaded heavy page components (`discover`, `inbox`, `admin`) using `next/dynamic` with loading skeletons
- Image optimization: all user avatars use `next/image` with explicit `width`/`height` to eliminate CLS
- API response caching: organization list and resource directory cached for 60s with `stale-while-revalidate`
- Database: added composite index on `matches(user_id, status)` and `messages(match_id, created_at DESC)` for inbox query speedup
- Frontend bundle: moved `country-state-city` data import to dynamic import so it does not block initial page load
- Lighthouse performance score improved from 61 to 84 on dashboard page

### 2026-03-06 - [f57e61c, 585d451, b0ed56d] Branding & UI Polish
- Added Techstars favicon (`/public/favicon.ico`, `/public/favicon.svg`) replacing browser default
- Fixed browser 404 on `/favicon.ico` that was logging errors in CI smoke tests
- Profile approved banner on dashboard now has a dismiss button; dismissal persisted in localStorage
- Fixed CSP to allow `clerk-telemetry.com` in `connect-src` and `vercel.live` in `frame-src` (blocked Clerk telemetry and Vercel preview toolbar)

### 2026-03-07 - [96daee2] Accessibility Audit & Mobile Responsiveness (closes #21, closes #22)
- **Mobile layout**: `AppShell` component wraps all authenticated pages with `Sidebar` (desktop) + mobile top header (h-14) + mobile hamburger drawer + fixed bottom nav (h-16)
- Mobile bottom nav shows Dashboard, Discover, Inbox, Account, Settings as quick-access tabs
- PWA support: `manifest.json` with `display: standalone`, `start_url: /dashboard`; service worker with Cache API for offline shell; `viewport` metadata with `viewportFit: cover` for notched devices
- `safe-area-inset-bottom` padding on bottom nav for iOS home indicator clearance
- **Accessibility**: 65+ issues resolved across 14 files - ARIA roles, `aria-label`, `aria-live`, `aria-expanded`, `aria-required`, `role="alert"` on error messages, `role="listbox"` on dropdowns
- `RichTextArea`, `MultiSelect`, `TagInput` components updated with full ARIA association between label, control, error, and character count
- Skip-to-main-content link added to `AppShell` for keyboard navigation
- `:focus-visible` outline and `prefers-reduced-motion` media query added to global CSS
- Fixed layout scroll regression: removing `flex-col` from AppShell right column restored body scroll on all pages
- All 7 authenticated pages migrated to `AppShell`: dashboard, discover, inbox, inbox thread, revisit, admin, profile detail

### 2026-03-08 - [a397e19, 941d053, 1d2b3d2] LocationPicker Rewrite & UI Fixes
- Replaced `react-country-state-city` (external runtime fetches, unreliable) with `react-select` + `country-state-city` npm package; all data now bundled at build time - no network dependency
- Fixed root cause of blank location dropdown: CSP `connect-src` had typo `venkatmcaji.github.io` (single j) blocking all data fetches from the old library
- LocationPicker now shows "Current: [saved value]" label so users know what location is already set before making changes
- `CoFounder Match` title in Sidebar (desktop, mobile header, mobile drawer) changed from static text to `<Link href="/dashboard">` with hover styles
- Location field labels updated to include "(Country)" hint so users know to start with country not city
- Settings page wrapped in `AppShell` so sidebar navigation is present (was missing entirely)

### 2026-01-18 00:43 - [d254671] Initial Setup
- Created project documentation structure
- Set up repository configuration (.gitignore, .gitattributes)
- Renamed repository to cofounder-matching
- Updated README.md with TechStars for Cofounders context

