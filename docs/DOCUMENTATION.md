# Implementation Plan: Alabama Entrepreneurial Network

## Table of Contents
1. [Database Schema](#database-schema)
2. [API Design](#api-design)
3. [Frontend Architecture](#frontend-architecture)
4. [Matching Algorithm](#matching-algorithm)
5. [Tech Stack Setup](#tech-stack-setup)
6. [Key Decisions](#key-decisions)

---

## Database Schema

### Core Tables

#### users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    
    -- Basics
    introduction TEXT,                -- Formerly bio
    location VARCHAR(255),
    location_city VARCHAR(100),
    location_state VARCHAR(100),
    location_country VARCHAR(100),
    location_latitude FLOAT,
    location_longitude FLOAT,
    
    -- Personal
    gender VARCHAR(20),
    birthdate DATE,
    
    -- Professional / links
    linkedin_url VARCHAR(500),
    twitter_url VARCHAR(500),
    instagram_url VARCHAR(500),
    calendly_url VARCHAR(500),
    video_intro_url VARCHAR(500),
    github_url VARCHAR(500),
    portfolio_url VARCHAR(500),
    
    -- Story & background
    life_story TEXT,
    hobbies TEXT,
    impressive_accomplishment TEXT,
    education_history TEXT,
    employment_history TEXT,
    experience_years INTEGER,
    previous_startups INTEGER,
    
    -- You / startup & readiness
    idea_status VARCHAR(50),          -- 'not_set_on_idea', 'have_ideas_flexible', 'building_specific_idea'
    is_technical BOOLEAN,
    startup_name VARCHAR(255),
    startup_description TEXT,
    startup_progress VARCHAR(50),
    startup_funding VARCHAR(50),
    ready_to_start VARCHAR(50),
    commitment VARCHAR(50),            -- 'full_time', 'part_time'
    areas_of_ownership JSONB,
    topics_of_interest JSONB,
    domain_expertise JSONB,
    equity_expectation TEXT,
    work_location_preference VARCHAR(50),
    
    -- Co-founder preferences
    looking_for_description TEXT,
    pref_idea_status VARCHAR(50),
    pref_idea_importance VARCHAR(20),
    pref_technical BOOLEAN,
    pref_technical_importance VARCHAR(20),
    pref_match_timing BOOLEAN,
    pref_timing_importance VARCHAR(20),
    pref_location_type VARCHAR(50),
    pref_location_distance_miles INTEGER,
    pref_location_importance VARCHAR(20),
    pref_age_min INTEGER,
    pref_age_max INTEGER,
    pref_age_importance VARCHAR(20),
    pref_cofounder_areas JSONB,
    pref_areas_importance VARCHAR(20),
    pref_shared_interests BOOLEAN,
    pref_interests_importance VARCHAR(20),
    alert_on_new_matches BOOLEAN DEFAULT FALSE,
    
    -- System
    behavior_agreement_accepted_at TIMESTAMP WITH TIME ZONE,
    profile_status VARCHAR(50) DEFAULT 'incomplete',  -- 'incomplete', 'pending_review', 'approved', 'rejected'
    is_active BOOLEAN DEFAULT TRUE,
    is_banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_idea_status ON users(idea_status);
CREATE INDEX idx_users_location ON users(location);
CREATE INDEX idx_users_profile_status ON users(profile_status);
```

#### organizations
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    website_url VARCHAR(500),
    logo_url VARCHAR(500),
    
    -- Type and Focus
    org_type VARCHAR(100),            -- 'accelerator', 'university', 'nonprofit', 'coworking', 'government', 'other'
    focus_areas JSONB,                -- Array of focus areas
    location VARCHAR(255),
    
    -- Verification
    is_verified BOOLEAN DEFAULT FALSE,
    verification_method VARCHAR(50),  -- 'domain', 'manual'
    verified_at TIMESTAMP,
    
    -- Contact
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_organizations_type ON organizations(org_type);
CREATE INDEX idx_organizations_verified ON organizations(is_verified);
```

#### organization_members
```sql
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,        -- 'member', 'mentor', 'staff', 'alumni', 'admin'
    is_primary BOOLEAN DEFAULT FALSE, -- Primary organization for user
    joined_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, organization_id)
);

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
```

#### resources
```sql
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Resource Details
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,   -- 'funding', 'mentorship', 'legal', 'accounting', 'prototyping', 'program', 'other'
    resource_type VARCHAR(100),       -- 'grant', 'loan', 'service', 'program', 'tool'
    
    -- Eligibility
    stage_eligibility JSONB,          -- Array of stages: ['idea', 'mvp', 'revenue', 'growth']
    location_eligibility JSONB,       -- Array of locations or 'alabama' or 'all'
    other_eligibility TEXT,
    
    -- Details
    amount_min DECIMAL(12,2),         -- For funding resources
    amount_max DECIMAL(12,2),
    currency VARCHAR(10) DEFAULT 'USD',
    application_url VARCHAR(500),
    deadline DATE,
    
    -- Tags and Metadata
    tags JSONB,                       -- Array of tags
    is_featured BOOLEAN DEFAULT FALSE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_resources_category ON resources(category);
CREATE INDEX idx_resources_org ON resources(organization_id);
CREATE INDEX idx_resources_stage_eligibility ON resources USING GIN(stage_eligibility);
CREATE INDEX idx_resources_tags ON resources USING GIN(tags);
```

#### user_saved_resources
```sql
CREATE TABLE user_saved_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
    saved_at TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    
    UNIQUE(user_id, resource_id)
);
```

#### events
```sql
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Event Details
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    event_type VARCHAR(100),         -- 'workshop', 'networking', 'pitch', 'conference', 'webinar', 'other'
    
    -- Timing
    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP,
    timezone VARCHAR(50) DEFAULT 'America/Chicago',
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule VARCHAR(255),     -- iCal RRULE format
    
    -- Location
    location_type VARCHAR(50),       -- 'in_person', 'virtual', 'hybrid'
    location_address TEXT,
    location_url VARCHAR(500),       -- For virtual events
    
    -- Registration
    registration_url VARCHAR(500),
    registration_required BOOLEAN DEFAULT FALSE,
    max_attendees INTEGER,
    current_attendees INTEGER DEFAULT 0,
    
    -- Tags and Metadata
    tags JSONB,
    is_featured BOOLEAN DEFAULT FALSE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_start_datetime ON events(start_datetime);
CREATE INDEX idx_events_org ON events(organization_id);
CREATE INDEX idx_events_tags ON events USING GIN(tags);
```

#### user_event_rsvps
```sql
CREATE TABLE user_event_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    rsvp_status VARCHAR(50) NOT NULL, -- 'going', 'maybe', 'not_going'
    rsvp_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, event_id)
);
```

#### matches
```sql
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Match Score and Details
    match_score INTEGER NOT NULL,    -- 0-100
    match_explanation TEXT,          -- AI-generated explanation
    
    -- Score Breakdown (for transparency)
    complementarity_score INTEGER,
    commitment_alignment_score INTEGER,
    interest_overlap_score INTEGER,
    preference_alignment_score INTEGER,
    location_fit_score INTEGER,
    intent_score INTEGER,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'viewed', 'saved', 'intro_requested', 'connected', 'dismissed'
    intro_requested_at TIMESTAMP,
    intro_accepted_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(user_id, target_user_id)
);

CREATE INDEX idx_matches_user ON matches(user_id);
CREATE INDEX idx_matches_target ON matches(target_user_id);
CREATE INDEX idx_matches_score ON matches(match_score DESC);
CREATE INDEX idx_matches_status ON matches(status);
```

#### messages
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Message Content
    content TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'message', -- 'message', 'intro_request', 'intro_response'
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_match ON messages(match_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
```

#### news
```sql
CREATE TABLE news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- News Details
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    news_type VARCHAR(100),          -- 'announcement', 'program_launch', 'founder_win', 'policy_update', 'funding_update'
    
    -- Media
    image_url VARCHAR(500),
    external_url VARCHAR(500),
    
    -- Tags
    tags JSONB,
    
    -- Status
    is_featured BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_news_type ON news(news_type);
CREATE INDEX idx_news_published ON news(is_published, published_at DESC);
```

#### reports
```sql
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reported_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reported_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    reported_resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
    reported_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    
    -- Report Details
    report_type VARCHAR(100) NOT NULL, -- 'spam', 'abuse', 'inappropriate', 'fake', 'other'
    description TEXT NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'reviewed', 'resolved', 'dismissed'
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    resolution_notes TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Design

### Authentication
- All endpoints require authentication except public read endpoints
- Use Clerk for auth (JWT tokens)
- Extract user from token in `deps.py`

### Endpoints Structure

#### Users
```
POST   /api/v1/users/accept-behavior-agreement  # Accept behavior agreement (required before onboarding)
POST   /api/v1/users/onboarding                 # Create or complete profile (full onboarding payload)
GET    /api/v1/users/me                          # Get current user profile
PUT    /api/v1/users/me                          # Update current user profile
GET    /api/v1/users/{user_id}                   # Get public user profile
GET    /api/v1/users?q=...&idea_status=...       # Search users (idea_status, commitment, location)
```
**Profile and onboarding:** User profile uses `idea_status` (not_set_on_idea, have_ideas_flexible, building_specific_idea), `introduction` (formerly bio), location components, areas_of_ownership, topics_of_interest, and co-founder preference fields. `behavior_agreement_accepted_at` and `profile_status` (incomplete, pending_review, approved, rejected) support the onboarding flow. See migration and `app/models/user.py` for full field list.

#### Organizations
```
GET    /api/v1/organizations               # List organizations
GET    /api/v1/organizations/{org_id}      # Get organization details
POST   /api/v1/organizations               # Create organization (org admin)
PUT    /api/v1/organizations/{org_id}      # Update organization (org admin)
DELETE /api/v1/organizations/{org_id}      # Delete organization (org admin)
POST   /api/v1/organizations/{org_id}/members  # Add member
DELETE /api/v1/organizations/{org_id}/members/{user_id}  # Remove member
```

#### Resources
```
GET    /api/v1/resources                  # List resources with filters
GET    /api/v1/resources/{resource_id}    # Get resource details
POST   /api/v1/resources                  # Create resource (org admin)
PUT    /api/v1/resources/{resource_id}     # Update resource (org admin)
DELETE /api/v1/resources/{resource_id}    # Delete resource (org admin)
POST   /api/v1/resources/{resource_id}/save  # Save resource
GET    /api/v1/resources/saved            # Get saved resources
```

#### Events
```
GET    /api/v1/events                     # List events with filters
GET    /api/v1/events/{event_id}          # Get event details
POST   /api/v1/events                     # Create event (org admin)
PUT    /api/v1/events/{event_id}          # Update event (org admin)
DELETE /api/v1/events/{event_id}          # Delete event (org admin)
POST   /api/v1/events/{event_id}/rsvp     # RSVP to event
GET    /api/v1/events/calendar            # Get calendar view (ICS export)
```

#### Matches
```
GET    /api/v1/matches                    # Get user's matches
GET    /api/v1/matches/{match_id}         # Get match details
POST   /api/v1/matches/{match_id}/intro   # Request introduction
PUT    /api/v1/matches/{match_id}/status  # Update match status (save/dismiss)
GET    /api/v1/matches/recommendations    # Get match recommendations
```

**Introduction and privacy:** Users can see another user's **profile** (name, introduction, areas, topics, links, etc.) before requesting or accepting an introduction. This is intentional so both sides can evaluate the match. **Email and direct contact details are not exposed** in match or discover responses; they are only available after both parties are connected (intro accepted). Public profile responses use `UserPublicResponse`, which excludes email.

#### Messages
```
GET    /api/v1/messages                   # Get messages (conversations)
GET    /api/v1/messages/{match_id}        # Get messages for a match
POST   /api/v1/messages                   # Send message
PUT    /api/v1/messages/{message_id}/read # Mark as read
```

#### News
```
GET    /api/v1/news                       # List news
GET    /api/v1/news/{news_id}             # Get news article
POST   /api/v1/news                       # Create news (org admin/platform admin)
PUT    /api/v1/news/{news_id}             # Update news
DELETE /api/v1/news/{news_id}             # Delete news
```

#### Admin
```
GET    /api/v1/admin/reports              # Get reports queue
PUT    /api/v1/admin/reports/{report_id}  # Review report
GET    /api/v1/admin/users                # Admin user management
PUT    /api/v1/admin/users/{user_id}/ban  # Ban user
PUT    /api/v1/admin/organizations/{org_id}/verify  # Verify organization
```

#### Clerk webhooks
```
POST   /webhooks/clerk   # Clerk webhook receiver (no auth; payload signed by Clerk)
```
When a user deletes their account in Clerk, we delete the corresponding user in our database so they can sign up again with the same email. Configure in Clerk Dashboard → Webhooks: add endpoint URL `https://your-api.com/webhooks/clerk`, subscribe to **user.deleted**, and set `CLERK_WEBHOOK_SECRET` in the backend `.env` to the endpoint’s signing secret.

---

## Frontend Architecture

### Key Pages

1. **Landing Page** (`/`)
   - Hero section
   - Value proposition
   - CTA to sign up

2. **Onboarding Flow** (`/onboarding`)
   - **Agreement** – Behavior agreement (required; backend records `behavior_agreement_accepted_at`)
   - **Basics** – Name, email, LinkedIn, location, introduction, gender, birthdate, accomplishment, education/employment, experience, links (Calendly, video intro, GitHub, portfolio)
   - **You & your startup** – Idea status, technical flag, ready-to-start, commitment, work location, startup details, areas of ownership, topics of interest, domain expertise, equity expectation, life story, hobbies
   - **Preferences** – What you’re looking for, idea/technical/timing/location/age/cofounder-area preferences, importance levels, alert on new matches
   - **Preview** – Review and submit full profile; draft is persisted in session storage via `useOnboardingDraft` hook across steps

3. **Dashboard** (`/dashboard`)
   - Overview of matches, saved resources, upcoming events
   - Quick actions

4. **Matches** (`/matches`)
   - Match list with filters
   - Match cards with score and explanation
   - Profile detail view
   - Save/intro request actions

5. **Profile** (`/profile`)
   - View/edit own profile
   - Public profile preview

6. **Resources** (`/resources`)
   - Resource directory with filters
   - Resource detail page
   - Saved resources

7. **Events** (`/events`)
   - Event calendar/list view
   - Event detail page
   - RSVP functionality

8. **Organizations** (`/organizations`)
   - Organization directory
   - Organization detail page

### Component Structure

```
components/
├── ui/                    # shadcn/ui base components
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── badge.tsx
│   └── ...
├── forms/
│   ├── ProfileForm.tsx
│   ├── OnboardingForm.tsx (or per-step pages under app/onboarding/)
│   ├── LocationPicker.tsx
│   ├── DatePicker.tsx
│   ├── RichTextArea.tsx
│   ├── MultiSelect.tsx
│   ├── TagInput.tsx
│   ├── ImportanceSelector.tsx
│   ├── ResourceForm.tsx
│   └── EventForm.tsx
├── cards/
│   ├── MatchCard.tsx
│   ├── UserCard.tsx
│   ├── ResourceCard.tsx
│   └── EventCard.tsx
├── layout/
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── Footer.tsx
└── matching/
    ├── MatchScore.tsx
    ├── MatchExplanation.tsx
    └── MatchFilters.tsx
```

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

### 2026-01-18 00:43 - [d254671] Initial Setup
- Created project documentation structure (CLAUDE.md, IMPLEMENTATION_PLAN.md)
- Set up repository configuration (.gitignore, .gitattributes, .claudeignore)
- Renamed repository to cofounder-matching
- Updated README.md with TechStars for Cofounders context
- Installed Exa MCP server for enhanced search capabilities
- Removed unnecessary .claude directory (keeping setup minimal)

