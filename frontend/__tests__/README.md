# Frontend Test Suite

## Overview
Comprehensive test suite for the co-founder matching platform frontend.

## Test Files

### API Client Tests (`api.test.ts`)
- **Critical**: Onboarding endpoint no longer sends clerk_id as query parameter
- Authentication token inclusion
- Error handling (4xx, 5xx responses)
- Query parameter building
- Organization and resource API calls

### OnboardingForm Tests (`OnboardingForm.test.tsx`)
- Multi-step form navigation
- Field validation (email, role_intent, etc.)
- Form submission without clerk_id parameter
- Error display on failure
- Redirect to dashboard on success

## Running Tests

### Install Dependencies
```bash
cd frontend
npm install
```

### Run All Tests
```bash
npm test
```

### Run in Watch Mode
```bash
npm run test:watch
```

### Run with Coverage
```bash
npm run test:coverage
```

### Run Specific Test File
```bash
npm test api.test.ts
```

## Test Configuration
- **Framework**: Jest with React Testing Library
- **Environment**: jsdom (browser simulation)
- **Mocks**: Next.js router, Clerk authentication, fetch API

## Key Tests

### Security Fix Validation
The most critical test validates that the authentication security fix is properly implemented:
```typescript
// Verifies clerk_id is NOT sent as query parameter
test('submits form data without clerk_id parameter', ...)
```

### API Integration
Tests verify that API calls use correct endpoints and headers:
- Authorization tokens in headers
- No sensitive data in URLs
- Proper error handling

## Test Coverage Goals
- Minimum 80% coverage for critical components
- 100% coverage for:
  - API client authentication logic
  - Form validation
  - Error handling

## Notes
- Clerk and Next.js router are mocked globally in `jest.setup.js`
- fetch API is mocked for all network calls
- Tests run in isolation with clean state
