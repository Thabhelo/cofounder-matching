import { api } from '@/lib/api'

describe('API Client', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear()
  })

  describe('users.onboarding', () => {
    it('sends POST request to onboarding endpoint without clerk_id in query', async () => {
      const mockResponse = { id: '123', email: 'test@example.com', name: 'Test User' }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const userData = {
        email: 'test@example.com',
        name: 'Test User',
        role_intent: 'cofounder',
      }
      const token = 'test_token'

      await api.users.onboarding(userData, token)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/users/onboarding'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_token',
          }),
          body: JSON.stringify(userData),
        })
      )

      // Verify URL does NOT contain clerk_id query parameter
      const callArgs = (global.fetch as jest.Mock).mock.calls[0]
      expect(callArgs[0]).not.toContain('clerk_id')
    })

    it('includes authentication token in headers', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      await api.users.onboarding({}, 'my_secret_token')

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][1]
      expect(callArgs.headers.Authorization).toBe('Bearer my_secret_token')
    })
  })

  describe('Error handling', () => {
    it('throws APIError on 4xx responses', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Bad request' }),
      })

      await expect(api.users.getMe('token')).rejects.toThrow('Bad request')
    })

    it('throws APIError on 5xx responses', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Server error' }),
      })

      await expect(api.users.getMe('token')).rejects.toThrow('Server error')
    })

    it('handles responses without json body', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => {
          throw new Error('Not JSON')
        },
      })

      await expect(api.users.getMe('token')).rejects.toThrow()
    })
  })

  describe('users.search', () => {
    it('builds query parameters correctly', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await api.users.search({
        role_intent: 'cofounder',
        location: 'San Francisco',
        skip: 10,
        limit: 20,
      })

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][0]
      expect(callArgs).toContain('role_intent=cofounder')
      expect(callArgs).toContain('location=San+Francisco')
      expect(callArgs).toContain('skip=10')
      expect(callArgs).toContain('limit=20')
    })

    it('omits undefined parameters', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await api.users.search({
        role_intent: 'cofounder',
        location: undefined,
      })

      const callArgs = (global.fetch as jest.Mock).mock.calls[0][0]
      expect(callArgs).toContain('role_intent=cofounder')
      expect(callArgs).not.toContain('location')
    })
  })

  describe('organizations', () => {
    it('fetches organization list', async () => {
      const mockOrgs = [{ id: '1', name: 'Test Org' }]
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrgs,
      })

      const result = await api.organizations.list()
      expect(result).toEqual(mockOrgs)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/organizations'),
        expect.any(Object)
      )
    })

    it('fetches organization by ID or slug', async () => {
      const mockOrg = { id: '1', name: 'Test Org', slug: 'test-org' }
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrg,
      })

      const result = await api.organizations.getByIdOrSlug('test-org')
      expect(result).toEqual(mockOrg)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/organizations/test-org'),
        expect.any(Object)
      )
    })
  })
})
