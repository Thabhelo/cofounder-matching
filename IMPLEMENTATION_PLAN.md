# Implementation Plan: Alabama Entrepreneurial Network

## Table of Contents
1. [Project Structure](#project-structure)
2. [Database Schema](#database-schema)
3. [API Design](#api-design)
4. [Frontend Architecture](#frontend-architecture)
5. [Matching Algorithm](#matching-algorithm)
6. [Development Phases](#development-phases)
7. [Tech Stack Setup](#tech-stack-setup)
8. [Key Decisions](#key-decisions)

---

## Project Structure

```
cmk/
├── README.md
├── IMPLEMENTATION_PLAN.md
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Configuration management
│   │   ├── database.py          # Database connection & session management
│   │   ├── models/              # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── organization.py
│   │   │   ├── resource.py
│   │   │   ├── event.py
│   │   │   ├── match.py
│   │   │   └── message.py
│   │   ├── schemas/             # Pydantic schemas for API
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── organization.py
│   │   │   ├── resource.py
│   │   │   ├── event.py
│   │   │   └── match.py
│   │   ├── api/                 # API routes
│   │   │   ├── __init__.py
│   │   │   ├── deps.py          # Dependencies (auth, db session)
│   │   │   ├── v1/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── users.py
│   │   │   │   ├── organizations.py
│   │   │   │   ├── resources.py
│   │   │   │   ├── events.py
│   │   │   │   ├── matches.py
│   │   │   │   └── messages.py
│   │   ├── services/            # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── matching.py      # Matching algorithm
│   │   │   ├── search.py        # Search functionality
│   │   │   └── ai.py            # AI services (embeddings, profile builder)
│   │   └── utils/               # Utilities
│   │       ├── __init__.py
│   │       └── verification.py
│   ├── alembic/                 # Database migrations
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── app/                     # Next.js app directory
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Landing/home page
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (dashboard)/
│   │   │   ├── profile/
│   │   │   ├── matches/
│   │   │   ├── resources/
│   │   │   ├── events/
│   │   │   └── organizations/
│   │   ├── api/                 # Next.js API routes (if needed)
│   │   └── admin/               # Admin dashboard
│   ├── components/
│   │   ├── ui/                  # Base UI components (shadcn/ui)
│   │   ├── forms/               # Form components
│   │   ├── cards/               # Card components
│   │   ├── layout/              # Layout components
│   │   └── matching/            # Matching-specific components
│   ├── lib/
│   │   ├── api.ts               # API client
│   │   ├── utils.ts
│   │   └── types.ts             # TypeScript types
│   ├── hooks/                   # React hooks
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   └── tailwind.config.ts
├── docs/                        # Additional documentation
│   ├── API.md
│   └── MATCHING_ALGORITHM.md
└── docker-compose.yml           # Local development (PostgreSQL)
```

---

## Database Schema

### Core Tables

#### users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id VARCHAR(255) UNIQUE NOT NULL,  -- Auth provider ID
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(500),
    
    -- Role and Intent
    role_intent VARCHAR(50) NOT NULL,  -- 'founder', 'cofounder', 'early_employee'
    stage_preference VARCHAR(50),      -- 'idea', 'mvp', 'revenue', 'growth'
    commitment VARCHAR(50),            -- 'full_time', 'part_time', 'exploratory'
    
    -- Location
    location VARCHAR(255),
    location_preference VARCHAR(255),  -- JSON array of acceptable locations
    travel_tolerance VARCHAR(50),      -- 'none', 'occasional', 'frequent'
    
    -- Working Style
    working_style VARCHAR(50),        -- 'structured', 'chaotic', 'flexible'
    communication_preference VARCHAR(50), -- 'async', 'sync', 'mixed'
    
    -- Skills and Experience
    skills JSONB,                     -- Array of skill objects {name, level, years}
    experience_years INTEGER,
    previous_startups INTEGER DEFAULT 0,
    
    -- Proof of Work
    proof_of_work JSONB,              -- Array of {type, url, description}
    github_url VARCHAR(500),
    portfolio_url VARCHAR(500),
    linkedin_url VARCHAR(500),
    
    -- Trust and Verification
    trust_score INTEGER DEFAULT 0,    -- 0-100
    is_verified BOOLEAN DEFAULT FALSE,
    verification_method VARCHAR(50), -- 'domain', 'manual', null
    
    -- Availability
    availability_status VARCHAR(50),  -- 'actively_looking', 'open', 'not_looking'
    availability_date DATE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_active_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    is_banned BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_users_role_intent ON users(role_intent);
CREATE INDEX idx_users_stage_preference ON users(stage_preference);
CREATE INDEX idx_users_location ON users(location);
CREATE INDEX idx_users_availability_status ON users(availability_status);
CREATE INDEX idx_users_trust_score ON users(trust_score DESC);
CREATE INDEX idx_users_skills ON users USING GIN(skills);
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
    stage_alignment_score INTEGER,
    commitment_alignment_score INTEGER,
    working_style_score INTEGER,
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
GET    /api/v1/users/me                    # Get current user profile
PUT    /api/v1/users/me                    # Update current user profile
GET    /api/v1/users/{user_id}             # Get public user profile
GET    /api/v1/users/search                # Search users with filters
POST   /api/v1/users/{user_id}/save        # Save user profile
GET    /api/v1/users/saved                 # Get saved profiles
```

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

---

## Frontend Architecture

### Key Pages

1. **Landing Page** (`/`)
   - Hero section
   - Value proposition
   - CTA to sign up

2. **Onboarding Flow** (`/onboarding`)
   - Multi-step questionnaire
   - Role intent selection
   - Skills and experience
   - Preferences and constraints
   - Proof of work (optional)

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
│   ├── OnboardingForm.tsx
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

#### Implementation Steps

1. Create `services/matching.py` with scoring functions
2. Implement each score component as separate function
3. Create composite scoring function
4. Generate match explanation from score breakdown
5. Store matches in database with scores
6. Add ranking/sorting by match score

### Phase 2: ML Enhancement (Future)
- Use embeddings for semantic skill matching
- Train model on successful matches
- Improve complementarity detection

---

## Development Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Project setup (backend + frontend)
- [ ] Database schema implementation
- [ ] Authentication integration (Clerk)
- [ ] Basic user CRUD
- [ ] Basic organization CRUD
- [ ] Database migrations setup

### Phase 2: Core Features (Week 3-4)
- [ ] User profile with onboarding flow
- [ ] Organization profiles and member associations
- [ ] Resource CRUD
- [ ] Event CRUD
- [ ] Basic search functionality

### Phase 3: Matching System (Week 5-6)
- [ ] Matching algorithm implementation
- [ ] Match scoring and explanation
- [ ] Match discovery and filtering
- [ ] Save/dismiss matches
- [ ] Match recommendations

### Phase 4: Communication (Week 7)
- [ ] Messaging system
- [ ] Intro request workflow
- [ ] Notification setup

### Phase 5: Polish and Admin (Week 8)
- [ ] Admin dashboard
- [ ] Reporting system
- [ ] Verification workflows
- [ ] Trust and safety features
- [ ] UI/UX improvements

### Phase 6: Testing and Launch Prep (Week 9-10)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation
- [ ] Deployment setup

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
ENVIRONMENT=development

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

## Next Steps

1. Review and approve this plan
2. Set up project structure
3. Initialize git repository
4. Set up development environment
5. Begin Phase 1 implementation

---

## Questions to Resolve

1. **AI Profile Builder**: Should this be in MVP or V1?
2. **Verification**: What's the exact process for organization verification?
3. **Rate Limiting**: What are the specific limits for messages/intros?
4. **Notifications**: Email only, or also in-app/push?
5. **Analytics**: What tracking/analytics do we need?

---

## Development Changelog

This section logs major changes shipped to the project. Only significant changes are recorded here (new features, major refactors, architecture changes).

### 2026-01-18 00:43 - [d254671] Initial Setup
- Created project documentation structure (CLAUDE.md, IMPLEMENTATION_PLAN.md, MCP_SETUP.md)
- Set up repository configuration (.gitignore, .gitattributes, .claudeignore)
- Configured Claude Code workspace (.claude/ directory with commands and agents)
- Renamed repository to cofounder-matching
- Updated README.md with TechStars for Cofounders context
- Installed Exa MCP server for enhanced search capabilities

