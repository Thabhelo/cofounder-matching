import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OnboardingForm } from '@/components/forms/OnboardingForm'

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
  })

  it('renders all form steps', () => {
    render(<OnboardingForm />)
    
    // Should show step 1 initially
    expect(screen.getByText(/Tell us about yourself/i)).toBeInTheDocument()
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument()
  })

  it('validates required fields in step 1', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm />)
    
    // Try to proceed without filling required fields
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)
    
    // Should stay on step 1
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument()
  })

  it('validates email format', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm />)
    
    const emailInput = screen.getByLabelText(/email/i)
    await user.type(emailInput, 'invalid-email')
    
    // Trigger validation
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Invalid email/i)).toBeInTheDocument()
    })
  })

  it('validates role_intent is one of allowed values', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm />)
    
    // Fill in required fields
    await user.type(screen.getByLabelText(/name/i), 'Test User')
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    
    // Select role intent
    const roleSelect = screen.getByLabelText(/What are you looking for/i)
    await user.selectOptions(roleSelect, 'cofounder')
    
    expect(roleSelect).toHaveValue('cofounder')
  })

  it('progresses through steps when validation passes', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm />)
    
    // Fill step 1
    await user.type(screen.getByLabelText(/name/i), 'Test User')
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    
    const roleSelect = screen.getByLabelText(/What are you looking for/i)
    await user.selectOptions(roleSelect, 'cofounder')
    
    // Go to step 2
    await user.click(screen.getByRole('button', { name: /next/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument()
    })
  })

  it('allows going back to previous step', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm />)
    
    // Progress to step 2
    await user.type(screen.getByLabelText(/name/i), 'Test User')
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    const roleSelect = screen.getByLabelText(/What are you looking for/i)
    await user.selectOptions(roleSelect, 'cofounder')
    await user.click(screen.getByRole('button', { name: /next/i }))
    
    await waitFor(() => {
      expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument()
    })
    
    // Go back to step 1
    await user.click(screen.getByRole('button', { name: /back/i }))
    
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
    // Step 1
    await user.type(screen.getByLabelText(/name/i), 'Test User')
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    const roleSelect = screen.getByLabelText(/What are you looking for/i)
    await user.selectOptions(roleSelect, 'cofounder')
    await user.click(screen.getByRole('button', { name: /next/i }))
    
    // Step 2
    await waitFor(() => expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /next/i }))
    
    // Step 3
    await waitFor(() => expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /next/i }))
    
    // Step 4
    await waitFor(() => expect(screen.getByText(/Step 4 of 4/i)).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /submit|complete/i }))
    
    // Verify API was called correctly
    await waitFor(() => {
      expect(mockOnboarding).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test User',
          email: 'test@example.com',
          role_intent: 'cofounder',
        }),
        'test_token' // Only token, not clerk_id
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
    
    // Quick navigation through steps
    await user.type(screen.getByLabelText(/name/i), 'Test User')
    await user.type(screen.getByLabelText(/email/i), 'test@example.com')
    const roleSelect = screen.getByLabelText(/What are you looking for/i)
    await user.selectOptions(roleSelect, 'cofounder')
    
    // Navigate through all steps quickly
    for (let i = 0; i < 3; i++) {
      await user.click(screen.getByRole('button', { name: /next/i }))
      await waitFor(() => {}) // Wait for next render
    }
    
    // Submit
    await user.click(screen.getByRole('button', { name: /submit|complete/i }))
    
    // Should display error
    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeInTheDocument()
    })
  })
})
