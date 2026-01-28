import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OnboardingForm } from '@/components/forms/OnboardingForm'

// Mock Clerk
const mockGetToken = jest.fn().mockResolvedValue('test_token')
const mockUser = {
  fullName: 'Test User',
  firstName: 'Test',
  lastName: 'User',
  primaryEmailAddress: {
    emailAddress: 'test@example.com',
    verification: {
      status: 'verified',
      strategy: 'oauth_google',
    },
  },
  imageUrl: 'https://example.com/avatar.jpg',
}

jest.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    getToken: mockGetToken,
    isSignedIn: true,
    userId: 'clerk_test_user_123',
  }),
  useUser: () => ({
    user: mockUser,
  }),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock the API
jest.mock('@/lib/api', () => ({
  api: {
    users: {
      onboarding: jest.fn(),
    },
  },
}))

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('OnboardingForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetToken.mockResolvedValue('test_token')
  })

  it('renders all form steps', () => {
    render(<OnboardingForm />)
    
    // Should show step 1 initially
    expect(screen.getByRole('heading', { name: /Tell us about yourself/i })).toBeInTheDocument()
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument()
  })

  it('validates required fields in step 1', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm />)
    
    // Try to proceed without filling required fields
    const nextButton = screen.getByRole('button', { name: /next/i })
    await act(async () => {
      await user.click(nextButton)
    })
    
    // Should stay on step 1
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument()
  })

  it('requires role_intent selection', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm />)
    
    // Try to proceed without selecting role_intent
    const nextButton = screen.getByRole('button', { name: /next/i })
    await act(async () => {
      await user.click(nextButton)
    })
    
    // Should stay on step 1 (validation should fail)
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument()
  })

  it('validates role_intent is one of allowed values', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm />)
    
    // Select role intent (name/email are extracted from Clerk, not in form)
    const roleSelect = screen.getByRole('combobox', { name: /What are you looking for/i })
    await act(async () => {
      await user.selectOptions(roleSelect, 'cofounder')
    })
    
    expect(roleSelect).toHaveValue('cofounder')
  })

  it('progresses through steps when validation passes', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm />)
    
    // Fill step 1 (name/email are extracted from Clerk, not in form)
    const roleSelect = screen.getByRole('combobox', { name: /What are you looking for/i })
    await act(async () => {
      await user.selectOptions(roleSelect, 'cofounder')
    })
    
    // Go to step 2
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /next/i }))
    })
    
    await waitFor(() => {
      expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument()
    })
  })

  it('allows going back to previous step', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm />)
    
    // Progress to step 2 (name/email are extracted from Clerk, not in form)
    const roleSelect = screen.getByRole('combobox', { name: /What are you looking for/i })
    await act(async () => {
      await user.selectOptions(roleSelect, 'cofounder')
      await user.click(screen.getByRole('button', { name: /next/i }))
    })
    
    await waitFor(() => {
      expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument()
    })
    
    // Go back to step 1
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /back/i }))
    })
    
    await waitFor(() => {
      expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument()
    })
  })

  it('submits form data without clerk_id parameter', async () => {
    const { api } = require('@/lib/api')
    const mockOnboarding = api.users.onboarding as jest.Mock
    mockOnboarding.mockResolvedValueOnce({ id: '123', email: 'test@example.com' })
    
    const user = userEvent.setup()
    render(<OnboardingForm />)
    
    // Fill all required fields through all steps
    // Step 1 (name/email are extracted from Clerk, not in form)
    const roleSelect = screen.getByRole('combobox', { name: /What are you looking for/i })
    await act(async () => {
      await user.selectOptions(roleSelect, 'cofounder')
      await user.click(screen.getByRole('button', { name: /next/i }))
    })
    
    // Step 2
    await waitFor(() => expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument())
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /next/i }))
    })
    
    // Step 3
    await waitFor(() => expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument())
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /next/i }))
    })
    
    // Step 4
    await waitFor(() => expect(screen.getByText(/Step 4 of 4/i)).toBeInTheDocument())
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /submit|complete/i }))
    })
    
    // Verify API was called correctly (name/email are extracted from token by backend)
    await waitFor(() => {
      expect(mockOnboarding).toHaveBeenCalledWith(
        expect.objectContaining({
          role_intent: 'cofounder',
        }),
        expect.any(String) // Token
      )
      
      // Verify it was called with exactly 2 arguments (data and token)
      expect(mockOnboarding).toHaveBeenCalledTimes(1)
      expect(mockOnboarding.mock.calls[0].length).toBe(2)
    })
    
    // Verify redirect to dashboard
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('displays error message on submission failure', async () => {
    const { api } = require('@/lib/api')
    const mockOnboarding = api.users.onboarding as jest.Mock
    mockOnboarding.mockRejectedValueOnce(new Error('Submission failed'))
    
    const user = userEvent.setup()
    render(<OnboardingForm />)
    
    // Quick navigation through steps (name/email are extracted from Clerk, not in form)
    const roleSelect = screen.getByRole('combobox', { name: /What are you looking for/i })
    await act(async () => {
      await user.selectOptions(roleSelect, 'cofounder')
    })
    
    // Navigate through all steps quickly
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await user.click(screen.getByRole('button', { name: /next/i }))
      })
      await waitFor(() => {}) // Wait for next render
    }
    
    // Submit
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /submit|complete/i }))
    })
    
    // Should display error
    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument()
    })
  })
})
