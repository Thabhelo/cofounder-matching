# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository. Update this file whenever Claude makes a mistake so it learns not to repeat it.

## Core Coding Principles

### Code Quality Over Quantity
- Write concise, readable code. If something can be achieved in fewer lines without sacrificing readability or quality, do it.
- No code bloat. Do not add unnecessary files, imports, or configurations that serve no purpose.
- Every line of code should have a clear reason to exist.

### Formatting and Style
- **NEVER write emojis in code** (comments, strings, variable names, etc.)
- **NEVER use em dashes (—) in text**. Use hyphens (-) or double hyphens (--) instead when strictly necessary.
- Use clear, descriptive variable names.
- Keep functions small and focused on a single responsibility.

### TypeScript Conventions
- Prefer `type` over `interface`
- Never use `enum` (use string literal unions or const objects instead)
- Never use `any` type without explicit discussion and approval
- Enable strict mode

### Python Conventions
- Follow PEP 8 style guide
- Use type hints for function parameters and return values
- Prefer explicit over implicit
- Use Pydantic models for validation, not manual checks

## Development Workflow

### Verification Loop (Always Follow This)
1. Make changes
2. Run type checking (`npm run typecheck` or `mypy`)
3. Run tests (`npm test` or `pytest`)
4. Run linting (`npm run lint` or `ruff check`)
5. Only then commit after confirming with me. 

### Git Workflow
- **NEVER commit without explicit user instruction**
- Wait for user approval before pushing changes
- Always run full verification loop before creating commits
- Write clear, concise commit messages (no emojis, no em dashes)
- Use conventional commits format: `feat:`, `fix:`, `refactor:`, `docs:`, etc.

### Changelog Maintenance
- **After every major change is committed**, update the changelog in IMPLEMENTATION_PLAN.md
- Add entry with: date/time, commit hash, description of what was shipped
- Format: `YYYY-MM-DD HH:MM - [commit-hash] Description of major change`
- Only log significant changes (new features, major refactors, architecture changes)
- Skip minor changes (typo fixes, small tweaks, documentation updates)

### GitHub Contributor Attribution
- Only the repository owner should appear as contributor
- Claude Code should not be listed as a contributor on GitHub
- This is handled via .gitattributes configuration

## Commands Reference

### Backend
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000   # Dev server
pytest                                       # Run all tests
pytest tests/test_file.py -v                # Run specific test
mypy app/                                    # Type checking
ruff check .                                 # Linting
alembic upgrade head                         # Apply migrations
alembic revision --autogenerate -m "msg"    # Create migration
```

### Frontend
```bash
cd frontend
npm run dev          # Dev server
npm run build        # Production build
npm test             # Run tests
npm run typecheck    # Type checking
npm run lint         # ESLint
```

### Database
```bash
docker-compose up -d     # Start PostgreSQL
docker-compose down      # Stop database
```

## Security Requirements

### Never Compromise On
- Input validation (use Pydantic schemas)
- SQL injection prevention (SQLAlchemy handles this, but verify raw queries)
- XSS prevention (sanitize user inputs in frontend)
- Authentication checks on all protected endpoints
- Rate limiting on matching and messaging endpoints
- Proper error handling (never expose internal errors to users)

### Sensitive Data
- Never log passwords, tokens, or API keys
- Never expose full email addresses for non-matched users
- Store Clerk user IDs, not passwords
- Use environment variables for secrets (never hardcode)

## Things Claude Should NEVER Do

### Code Practices
- Don't skip error handling
- Don't use try-except blocks without proper error logging
- Don't ignore type errors or linting warnings
- Don't create files that aren't immediately needed
- Don't add dependencies without justification
- Don't write unnecessary .gitignore entries for things not in the codebase
- Don't create boilerplate comments that state the obvious
- Don't add TODO comments without context
- **Don't create unnecessary documentation files** - use existing files:
  - Use DOCUMENTATION.md for tracking changes and changelog entries
  - Use README.md for setup instructions and project overview
  - Don't create duplicate documentation that already exists elsewhere

### Development Workflow
- Don't commit without running the verification loop
- Don't push to main without user approval
- Don't create PRs without running full test suite
- Don't skip database migrations for schema changes
- Don't modify production configuration without explicit permission

### Architecture
- Don't use ML/embeddings for matching algorithm (it's rules-based)
- Don't expose all user data in match results (privacy-first)
- Don't allow direct messaging before introduction acceptance
- Don't skip the onboarding flow (critical for match quality)
- Don't store passwords (Clerk handles all auth)

## Project-Specific Patterns

### Matching Algorithm
- Location: `backend/app/services/matching.py`
- Rules-based scoring (not ML) with 6 components totaling 100 points
- Store both total score AND breakdown scores for transparency
- Generate human-readable explanations from score components
- See IMPLEMENTATION_PLAN.md section "Matching Algorithm" for details

### API Patterns
- All endpoints under `/api/v1/`
- Authentication required except public reads (GET organizations, resources, events)
- Use dependency injection: `current_user: User = Depends(get_current_user)`
- Return proper HTTP status codes (200, 201, 400, 401, 404, 500)
- Implement pagination for all list endpoints

### Database
- All IDs use UUID (gen_random_uuid())
- Use JSONB for flexible fields (skills, tags, preferences)
- Always create indexes for foreign keys and search fields
- Use Alembic migrations for all schema changes
- Never modify database directly, always through migrations

### Frontend
- Use Next.js App Router (not Pages Router)
- Server Components by default, Client Components only when needed
- shadcn/ui for components (install as needed, don't install everything)
- API calls via centralized client in `lib/api.ts`
- Form validation with React Hook Form + Zod

## Common Pitfalls to Avoid

1. **Don't repeat IMPLEMENTATION_PLAN.md** - That file has the full schema and API design. CLAUDE.md is for coding practices.
2. **Don't over-engineer** - Start simple, add complexity only when needed.
3. **Don't skip timezone handling** - Events must handle timezones correctly.
4. **Don't expose internal errors** - Return user-friendly messages, log details internally.
5. **Don't forget rate limiting** - Prevent spam on matching and messaging.
6. **Don't skip database transactions** - Use SQLAlchemy sessions properly.

## Files That Should Never Be Ignored

See .claudeignore for files Claude should always pay attention to:
- IMPLEMENTATION_PLAN.md (full architecture)
- CLAUDE.md (this file)
- Database migration files
- Test files

---

**Remember**: This file is a living document. Update it whenever Claude makes a mistake so it learns and never repeats it.
