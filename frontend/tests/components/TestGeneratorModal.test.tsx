import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TestGeneratorModal from '../../src/components/TestGeneratorModal'
import type { GeneratedTestSuite } from '../../src/types'

const mockTestSuite: GeneratedTestSuite = {
  test_code: `import pytest
from unittest.mock import patch, MagicMock

def test_login_happy_path():
    assert True
`,
  test_filename: 'test_login.py',
  framework: 'pytest',
  model_used: 'ibm/granite-13b-chat-v2',
  analysis_type: 'watsonx',
  target_file: 'auth_service.py',
  target_label: 'login',
  test_scenarios: [
    'test_login_happy_path: Verify valid credentials return session token',
    'test_login_invalid_password: Verify wrong password raises AuthenticationError',
  ],
  dependencies_mocked: ['database_pool', 'jwt_encoder'],
}

describe('TestGeneratorModal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <TestGeneratorModal
        isOpen={false}
        onClose={vi.fn()}
        testSuite={null}
        loading={false}
        error={null}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders loading state when loading is true', () => {
    render(
      <TestGeneratorModal
        isOpen={true}
        onClose={vi.fn()}
        testSuite={null}
        loading={true}
        error={null}
        targetNodeLabel="login"
      />
    )

    expect(screen.getByText(/Generating Pytest Regression Suite/i)).toBeDefined()
    expect(screen.getByText(/IBM Bob 2\.0 & watsonx\.ai/i)).toBeDefined()
  })

  it('renders test suite code, scenarios, and action buttons when loaded', () => {
    render(
      <TestGeneratorModal
        isOpen={true}
        onClose={vi.fn()}
        testSuite={mockTestSuite}
        loading={false}
        error={null}
        targetNodeLabel="login"
      />
    )

    expect(screen.getAllByText('test_login.py').length).toBeGreaterThan(0)
    expect(screen.getByText(/import pytest/i)).toBeDefined()
    expect(screen.getByText(/Copy Code/i)).toBeDefined()
    expect(screen.getByText(/Download File/i)).toBeDefined()
    expect(screen.getByText(/pytest tests\/test_login\.py -v/i)).toBeDefined()
  })

  it('calls onClose when close button or Escape is clicked', () => {
    const handleClose = vi.fn()
    render(
      <TestGeneratorModal
        isOpen={true}
        onClose={handleClose}
        testSuite={mockTestSuite}
        loading={false}
        error={null}
        targetNodeLabel="login"
      />
    )

    const closeBtn = screen.getByTitle('Close modal')
    fireEvent.click(closeBtn)
    expect(handleClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleClose).toHaveBeenCalledTimes(2)
  })
})
