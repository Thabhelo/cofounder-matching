# CoFounder Match — API Reference

**Version:** 1.0.0
**Base URL:** `https://api.cofoundermatch.com/api/v1`
**Interactive Portal:** `GET /developer`
**OpenAPI Schema:** `GET /openapi.json`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Rate Limits](#rate-limits)
4. [Error Handling](#error-handling)
5. [Users](#users)
6. [Profiles](#profiles)
7. [Matches](#matches)
8. [Messages](#messages)
9. [Events](#events)
10. [Organizations](#organizations)
11. [Resources](#resources)
12. [Reports](#reports)
13. [Admin](#admin)
14. [Webhooks](#webhooks)
15. [Changelog](#changelog)

---

## Overview

The CoFounder Match API is a RESTful JSON API that powers the co-founder matching platform. It
handles user authentication via [Clerk](https://clerk.com), profile discovery, mutual matching,
messaging, events, organizations, and platform moderation.

All requests and responses use `application/json`. All timestamps are ISO 8601 UTC strings.
All IDs are UUIDs.

---

## Authentication

The API uses **Clerk JWTs** for authentication. Pass the session token as a Bearer token in the
`Authorization` header.

```
Authorization: Bearer <clerk_session_token>
```

Tokens are obtained from Clerk's frontend SDK after the user signs in with OAuth or email/password.
The API verifies token signatures using Clerk's JWKS endpoint configured via `CLERK_FRONTEND_API`.

**Token verification:**
- Signature verified against Clerk's JWKS
- Expiration (`exp`) and not-before (`nbf`) claims validated
- Authorized party (`azp`) claim checked against allowed CORS origins (if present)

**Endpoint access levels:**

| Level | Description |
|-------|-------------|
| Public | No token required |
| Authenticated | Valid Clerk JWT required |
| Admin | Valid JWT + `is_admin` flag or `ADMIN_CLERK_IDS` list |

**Auto user creation:** On first authentication, the API automatically creates a minimal user record
from the Clerk token claims. No separate registration step is needed.

---

## Rate Limits

| Scope | Limit |
|-------|-------|
| Global (per IP) | 100 requests / minute |
| `POST /matches/invite/{profile_id}` | 20 / week |
| `POST /matches/{match_id}/intro` | 20 / week |
| `POST /messages` | 50 / day |

Rate limit violations return `429 Too Many Requests`.

---

## Error Handling

All errors return JSON with a `detail` field and a `request_id` for tracing:

```json
{
  "detail": "Human-readable error message",
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Common HTTP status codes:**

| Code | Meaning |
|------|---------|
| `400` | Bad request / validation error |
| `401` | Missing or invalid authentication token |
| `403` | Forbidden — authenticated but not authorized |
| `404` | Resource not found |
| `409` | Conflict (e.g., duplicate email) |
| `413` | Request body too large (max 10 MB) |
| `422` | Unprocessable entity — schema validation failed |
| `429` | Rate limit exceeded |
| `500` | Internal server error |
| `503` | Service unavailable (database down) |

---

## Users

Base path: `/api/v1/users`

### POST `/accept-behavior-agreement`

Accept the platform behavior agreement. **Required before completing onboarding.**

- **Auth:** Authenticated
- **Response 200:** `UserResponse`

```bash
curl -X POST /api/v1/users/accept-behavior-agreement \
  -H "Authorization: Bearer <token>"
```

---

### POST `/onboarding`

Create or update the user profile during onboarding.

- **Auth:** Authenticated
- **Response 201** (new user) / **200** (existing): `UserResponse`
- **Security:** Name, email, and avatar are sourced from the Clerk JWT — not the request body

**Request body** (`UserOnboarding`):

```json
{
  "introduction": "Passionate builder with 5 years in fintech",
  "location": "San Francisco, CA",
  "location_city": "San Francisco",
  "location_state": "CA",
  "location_country": "US",
  "is_technical": true,
  "commitment": "full_time",
  "idea_status": "building_specific_idea",
  "startup_name": "Acme Inc",
  "startup_description": "AI-powered expense tracking",
  "startup_progress": "mvp",
  "areas_of_ownership": ["product", "engineering"],
  "domain_expertise": ["fintech", "b2b_saas"],
  "ready_to_start": "immediately",
  "equity_expectation": "50/50 split",
  "work_location_preference": "remote"
}
```

---

### GET `/me`

Get the current authenticated user's full profile.

- **Auth:** Authenticated
- **Response 200:** `UserResponse`

---

### PUT `/me`

Update the current user's profile (partial update — only send fields you want to change).

- **Auth:** Authenticated
- **Request body:** `UserUpdate` (all fields optional)
- **Response 200:** `UserResponse`

---

### GET `/me/settings`

Get the current user's notification and privacy settings.

- **Auth:** Authenticated
- **Response 200:** `UserSettingsResponse`

```json
{
  "alert_on_new_matches": true,
  "work_location_preference": "remote",
  "pref_location_type": "anywhere"
}
```

---

### PUT `/me/settings`

Update notification or privacy settings.

- **Auth:** Authenticated
- **Request body:** `UserSettingsUpdate` (partial)
- **Response 200:** `UserSettingsResponse`

---

### POST `/me/export`

Export all user data (GDPR Article 20 — right to data portability).

- **Auth:** Authenticated
- **Response 200:** JSON object containing profile, settings, matches, and messages

---

### DELETE `/me`

Permanently anonymize and delete the account (GDPR Article 17 — right to erasure).

- **Auth:** Authenticated
- **Response 204:** No content

---

### GET `/{user_id}`

Get a public profile by UUID.

- **Auth:** Public
- **Response 200:** `UserPublicResponse` (limited fields for privacy)

---

### GET `/` (search)

Search users with filters and full-text search.

- **Auth:** Public
- **Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Full-text search (name, bio, startup) |
| `idea_status` | string | `not_set_on_idea` \| `have_ideas_flexible` \| `building_specific_idea` |
| `commitment` | string | `full_time` \| `part_time` |
| `location` | string | Filter by location string |
| `sort_by` | string | `recent` \| `experience` |
| `skip` | int | Pagination offset (default 0) |
| `limit` | int | Page size (default 20, max 100) |

- **Response 200:** `List[UserPublicResponse]`

---

## Profiles

Base path: `/api/v1/profiles`

### GET `/discover`

Discover potential co-founder profiles, ranked by compatibility score. Excludes active matches.
Dismissed/unmatched profiles may reappear.

- **Auth:** Authenticated
- **Query params:** `skip`, `limit` (1–50)
- **Response 200:** `List[ProfileDiscoverResponse]`

---

### GET `/count`

Get summary counts for the dashboard.

- **Auth:** Authenticated
- **Response 200:**

```json
{
  "discover_count": 42,
  "saved_count": 5,
  "matches_count": 3
}
```

---

### POST `/{profile_id}/save`

Save a profile to review later.

- **Auth:** Authenticated
- **Response 201:** `{"message": "Profile saved", "match_id": "uuid"}`

---

### POST `/{profile_id}/skip`

Dismiss a profile (can be un-dismissed later).

- **Auth:** Authenticated
- **Response 201:** `{"message": "Profile skipped", "match_id": "uuid"}`

---

### DELETE `/{profile_id}/save`

Remove a profile from saved list.

- **Auth:** Authenticated
- **Response 200:** `{"message": "Profile unsaved", "profile_id": "uuid"}`

---

### DELETE `/{profile_id}/skip`

Remove a profile from skipped list (makes it appear in discovery again).

- **Auth:** Authenticated
- **Response 200:** `{"message": "Profile unskipped", "profile_id": "uuid"}`

---

### GET `/saved`

Get all saved profiles.

- **Auth:** Authenticated
- **Query params:** `skip`, `limit` (1–100)
- **Response 200:** `List[UserPublicResponse]`

---

### GET `/skipped`

Get all skipped profiles.

- **Auth:** Authenticated
- **Query params:** `skip`, `limit` (1–100)
- **Response 200:** `List[UserPublicResponse]`

---

## Matches

Base path: `/api/v1/matches`

### POST `/invite/{profile_id}`

Send a direct invitation to a profile. Creates a match and delivers an intro message.

- **Auth:** Authenticated
- **Rate limit:** 20 per week
- **Request body:**

```json
{
  "message": "Hi Sarah! I noticed you're building in climate tech..."
}
```

- **Response 201:**

```json
{
  "message": "Invitation sent",
  "match_id": "uuid",
  "invites_remaining": 17,
  "auto_connected": false
}
```

---

### GET `/`

Get all matches (sent and received intro requests).

- **Auth:** Authenticated
- **Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `status_filter` | string | Filter by match status |
| `skip` | int | Pagination offset |
| `limit` | int | Page size (1–100) |

- **Response 200:** `List[MatchWithUserResponse]`

---

### GET `/recommendations`

Get AI-scored match recommendations.

- **Auth:** Authenticated
- **Query params:** `skip`, `limit` (1–50)
- **Response 200:** `List[ProfileDiscoverResponse]`

---

### GET `/{match_id}`

Get details for a specific match.

- **Auth:** Authenticated (must be a party in the match)
- **Response 200:** `MatchWithUserResponse`

---

### POST `/{match_id}/unmatch`

Unmatch from a connected co-founder.

- **Auth:** Authenticated
- **Response 200:** `{"message": "Unmatched", "match_id": "uuid"}`

---

### POST `/{match_id}/intro`

Request an introduction (max 20 per week).

- **Auth:** Authenticated
- **Rate limit:** 20 per week
- **Request body:** `IntroRequest` with `message`
- **Response 201:** `{"message": "...", "match_id": "uuid", "intro_requested_at": "ISO8601"}`

---

### POST `/{match_id}/intro/respond`

Accept or decline an introduction request.

- **Auth:** Authenticated (must be the recipient)
- **Request body:**

```json
{
  "accept": true,
  "message": "Happy to connect! Let's schedule a call."
}
```

- **Response 200:** `{"message": "...", "match_id": "uuid", "accepted": true, "status": "connected"}`

---

### PUT `/{match_id}/status`

Update match status (viewed, saved, dismissed).

- **Auth:** Authenticated
- **Request body:** `MatchStatusUpdate` with `status`
- **Response 200:** `MatchResponse`

---

## Messages

Base path: `/api/v1/messages`

### GET `/`

Get all conversations (matches that have messages).

- **Auth:** Authenticated
- **Query params:** `skip`, `limit` (1–100)
- **Response 200:** `List[ConversationResponse]`

---

### GET `/{match_id}`

Get all messages in a specific conversation thread.

- **Auth:** Authenticated (must be a party in the match)
- **Query params:** `skip`, `limit` (1–100)
- **Response 200:** `List[MessageResponse]`

---

### POST `/`

Send a message to a matched co-founder.

- **Auth:** Authenticated
- **Rate limit:** 50 per day
- **Request body:**

```json
{
  "match_id": "uuid",
  "content": "Hey! I reviewed your profile and would love to chat..."
}
```

- **Response 201:** `MessageResponse`

---

### PUT `/{message_id}/read`

Mark a single message as read.

- **Auth:** Authenticated
- **Response 200:** `{"message": "Marked as read", "message_id": "uuid"}`

---

### PUT `/match/{match_id}/read-all`

Mark all messages in a conversation as read.

- **Auth:** Authenticated
- **Response 200:** `{"message": "All messages marked as read", "match_id": "uuid"}`

---

### GET `/unread/count`

Get total unread count and per-conversation breakdown.

- **Auth:** Authenticated
- **Response 200:**

```json
{
  "total_unread": 3,
  "conversations": {
    "match-uuid-1": 2,
    "match-uuid-2": 1
  }
}
```

---

## Events

Base path: `/api/v1/events`

### GET `/`

List events with search and filters.

- **Auth:** Public (optional auth for personalization)
- **Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Full-text search |
| `event_type` | string | Filter by event type |
| `location_type` | string | `in_person` \| `virtual` \| `hybrid` |
| `organization_id` | uuid | Filter by organizing body |
| `upcoming_only` | bool | Only return future events |
| `featured_only` | bool | Only return featured events |
| `sort_by` | string | `date` \| `recent` |
| `skip` / `limit` | int | Pagination |

- **Response 200:** `List[EventResponse]`

---

### GET `/{event_id}`

Get a single event by ID.

- **Auth:** Public
- **Response 200:** `EventResponse`

---

### POST `/`

Create a new event.

- **Auth:** Authenticated
- **Query param:** `organization_id` (optional — associate with an org)
- **Request body:** `EventCreate`
- **Response 201:** `EventResponse`

---

### PUT `/{event_id}`

Update an event (creator or org admin/staff only).

- **Auth:** Authenticated
- **Request body:** `EventUpdate` (partial)
- **Response 200:** `EventResponse`

---

### POST `/{event_id}/rsvp`

RSVP to an event.

- **Auth:** Authenticated
- **Request body:**

```json
{ "rsvp_status": "going" }
```

Values: `going` | `maybe` | `not_going`

- **Response 201:**

```json
{
  "message": "RSVP recorded",
  "event_id": "uuid",
  "rsvp_status": "going",
  "current_attendees": 47
}
```

---

### DELETE `/{event_id}`

Soft-delete an event (creator or org admin/staff only).

- **Auth:** Authenticated
- **Response 204:** No content

---

## Organizations

Base path: `/api/v1/organizations`

### GET `/`

List organizations with search and filters.

- **Auth:** Public
- **Query params:** `q`, `org_type`, `verified_only`, `location`, `sort_by`, `skip`, `limit`
- **Response 200:** `List[OrganizationResponse]`

---

### GET `/{org_id_or_slug}`

Get an organization by UUID or URL slug.

- **Auth:** Public
- **Response 200:** `OrganizationResponse`

---

### POST `/`

Create a new organization. The creating user becomes the admin.

- **Auth:** Authenticated
- **Request body:** `OrganizationCreate`
- **Response 201:** `OrganizationResponse`

---

### PUT `/{org_id}`

Update an organization (admin or staff member only).

- **Auth:** Authenticated
- **Request body:** `OrganizationUpdate` (partial)
- **Response 200:** `OrganizationResponse`

---

## Resources

Base path: `/api/v1/resources`

### GET `/`

List curated startup resources.

- **Auth:** Public
- **Query params:** `q`, `category`, `resource_type`, `stage`, `organization_id`, `featured_only`, `sort_by`, `skip`, `limit`
- **Response 200:** `List[ResourceResponse]`

---

### GET `/{resource_id}`

Get a resource by ID.

- **Auth:** Public
- **Response 200:** `ResourceResponse`

---

### POST `/`

Submit a new resource.

- **Auth:** Authenticated
- **Query param:** `organization_id` (optional)
- **Request body:** `ResourceCreate`
- **Response 201:** `ResourceResponse`

---

### PUT `/{resource_id}`

Update a resource (creator or org admin/staff only).

- **Auth:** Authenticated
- **Request body:** `ResourceUpdate` (partial)
- **Response 200:** `ResourceResponse`

---

### DELETE `/{resource_id}`

Soft-delete a resource (creator or org admin/staff only).

- **Auth:** Authenticated
- **Response 204:** No content

---

## Reports

Base path: `/api/v1/reports`

### POST `/`

Submit a report against a user for abuse, spam, or inappropriate content.

- **Auth:** Authenticated
- **Validation:** Cannot report yourself; target user must exist and not be banned
- **Request body:**

```json
{
  "reported_user_id": "uuid",
  "report_type": "spam",
  "description": "Sends unsolicited promotional messages."
}
```

- **Response 201:** `ReportResponse`

---

## Admin

Base path: `/api/v1/admin`
**All endpoints require admin privileges** (`is_admin` flag or `ADMIN_CLERK_IDS`).

### GET `/check`

Check whether the current user is an admin.

- **Auth:** Authenticated (returns result for any user)
- **Response 200:** `{"is_admin": true}`

---

### GET `/stats`

Platform overview statistics.

- **Response 200:**

```json
{
  "users_total": 1204,
  "users_banned": 3,
  "users_pending_review": 12,
  "reports_pending": 5,
  "reports_total": 28,
  "organizations_total": 47,
  "matches_total": 892,
  "messages_total": 4310,
  "users_last_7_days": 34,
  "users_last_30_days": 198,
  "matches_last_7_days": 87
}
```

---

### GET `/analytics`

Time-series analytics for signups, matches, intros, and messages.

- **Query params:** `days` (7–90, default 30)
- **Response 200:**

```json
{
  "signups_by_day": [{"date": "2025-03-01", "count": 8}, ...],
  "matches_by_day": [...],
  "intro_requested_count": 145,
  "intro_accepted_count": 89,
  "intro_acceptance_rate": 0.614,
  "messages_count": 423,
  "resource_saves_count": 67,
  "event_rsvps_count": 234,
  "organizations_with_activity_count": 18
}
```

---

### GET `/audit-log`

Admin action audit log.

- **Query params:** `action`, `target_type`, `skip`, `limit` (1–500)
- **Response 200:** List of audit log entries

---

### Reports (Admin)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/reports` | List reports — params: `status_filter`, `report_type`, `sort_by`, `sort_order`, `skip`, `limit` |
| `PUT` | `/admin/reports/{report_id}` | Review a report — body: `{"status": "resolved", "resolution_notes": "..."}` |

---

### User Management (Admin)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/users` | List users — params: `q`, `profile_status`, `is_banned`, `skip`, `limit` |
| `GET` | `/admin/users/{user_id}` | Get any user |
| `PUT` | `/admin/users/{user_id}` | Update any user |
| `DELETE` | `/admin/users/{user_id}` | Deactivate user |
| `PUT` | `/admin/users/{user_id}/ban` | Ban user |
| `PUT` | `/admin/users/{user_id}/unban` | Unban user |
| `PUT` | `/admin/users/{user_id}/reactivate` | Reactivate user |
| `PUT` | `/admin/users/{user_id}/approve` | Approve profile |
| `PUT` | `/admin/users/{user_id}/reject` | Reject profile |
| `PUT` | `/admin/users/{user_id}/make-admin` | Grant admin |
| `PUT` | `/admin/users/{user_id}/remove-admin` | Revoke admin |

---

### Organization Management (Admin)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/organizations` | List orgs — params: `verified`, `skip`, `limit` |
| `POST` | `/admin/organizations` | Create org |
| `PUT` | `/admin/organizations/{org_id}` | Update org |
| `PUT` | `/admin/organizations/{org_id}/verify` | Mark verified |
| `DELETE` | `/admin/organizations/{org_id}` | Deactivate org |

---

### Resource & Event Management (Admin)

| Method | Path | Description |
|--------|------|-------------|
| `GET` / `POST` | `/admin/resources` | List / create resources |
| `PUT` / `DELETE` | `/admin/resources/{resource_id}` | Update / deactivate |
| `GET` / `POST` | `/admin/events` | List / create events (POST supports `notify_users` query param) |
| `PUT` / `DELETE` | `/admin/events/{event_id}` | Update / deactivate |

---

### Notifications & Feature Flags (Admin)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/admin/broadcast` | Send custom email to all active users — body: `{"subject": "...", "message": "..."}` |
| `GET` | `/admin/notifications/config` | Email service status and feature flags |
| `PATCH` | `/admin/notifications/config` | Toggle feature flags at runtime — body: `{"feature_flags": {"flag_name": true}}` |
| `POST` | `/admin/notifications/trigger/profile-reminders` | Manually run incomplete profile reminder job |
| `POST` | `/admin/notifications/trigger/event-reminders` | Manually run event reminder job |

---

## Webhooks

Base path: `/webhooks`

### POST `/clerk`

Receive lifecycle events from Clerk. Payloads are verified using Clerk's webhook signing secret
(`CLERK_WEBHOOK_SECRET`). Do not call this endpoint directly.

**Handled events:**

| Event | Action |
|-------|--------|
| `user.deleted` | Anonymise and deactivate the matching user record |

- **Response 200:** `{"ok": true}`

---

## Changelog

### v1.0.0 — 2025-03-08

- Initial public API release
- Full CRUD for users, profiles, matches, messages, events, organizations, resources
- Admin moderation suite with audit log, analytics, broadcast email
- GDPR data export and account deletion endpoints
- Clerk webhook integration for user lifecycle events
- Rate limiting: 100 req/min global, 20 invites/week, 50 messages/day
- Developer portal at `GET /developer`
