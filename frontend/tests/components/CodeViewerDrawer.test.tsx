import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CodeViewerDrawer from '../../src/components/CodeViewerDrawer'

// Mock getSourceCode API
vi.mock('../../src/api/client', () => ({
  getSourceCode: vi.fn().mockResolvedValue({
    repo_id: 'test-repo',
    file_path: 'auth/service.py',
    relative_path: 'auth/service.py',
    total_lines: 3,
    content: 'def login(user):\n    token = create_jwt(user)\n    return token\n',
    target_line: 2,
    language: 'python',
  }),
}))

describe('CodeViewerDrawer', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <CodeViewerDrawer
        repoId="test-repo"
        filePath="auth/service.py"
        isOpen={false}
        onClose={vi.fn()}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders drawer header and target line focus when open', async () => {
    render(
      <CodeViewerDrawer
        repoId="test-repo"
        filePath="auth/service.py"
        targetLine={2}
        symbolName="login"
        isOpen={true}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Target Focus:')).toBeDefined()
    expect(screen.getAllByText('login').length).toBeGreaterThan(0)
    expect(screen.getByText('Jump to line 2')).toBeDefined()
    await waitFor(() => {
      expect(screen.getByText(/create_jwt/)).toBeDefined()
    })
  })
})
