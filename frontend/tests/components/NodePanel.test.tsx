import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import NodePanel from '../../src/components/NodePanel'
import * as client from '../../src/api/client'
import type { GraphNode } from '../../src/types'

const mockNode: GraphNode = {
  id: 'auth_service.login',
  label: 'login',
  type: 'function',
  file_path: 'auth_service.py',
  module_name: 'auth_service',
  line_number: 15,
  git_churn: 6,
}

describe('NodePanel with Watsonx Purpose Summary', () => {
  it('renders node details and Watsonx purpose summary trigger', () => {
    render(
      <NodePanel
        node={mockNode}
        repoId="test-repo-123"
        impactResult={null}
        impactLoading={false}
        impactError={null}
        onAnalyze={vi.fn()}
      />
    )

    expect(screen.getByText('login')).toBeDefined()
    expect(screen.getByText('auth_service')).toBeDefined()
    expect(screen.getByText(/watsonx\.ai/i)).toBeDefined()
    expect(screen.getByText('Explain Code Purpose (Watsonx)')).toBeDefined()
  })

  it('fetches and displays watsonx summary on button click', async () => {
    const mockSummary = {
      node_id: 'auth_service.login',
      label: 'login',
      node_type: 'function',
      purpose: 'Authenticates user credentials and returns session tokens.',
      responsibilities: [
        'Validates username and password hash',
        'Generates secure JWT token',
      ],
      inputs_and_outputs: 'Accepts username and password; returns auth token',
      architectural_role: 'Domain Controller',
      complexity_rating: 'LOW' as const,
      model_used: 'ibm/granite-13b-chat-v2',
      analysis_type: 'watsonx',
      callers: ['api.login_endpoint'],
      callees: ['db.get_user'],
      file_path: 'auth_service.py',
      line_number: 15,
    }

    vi.spyOn(client, 'explainNode').mockResolvedValueOnce(mockSummary)

    render(
      <NodePanel
        node={mockNode}
        repoId="test-repo-123"
        impactResult={null}
        impactLoading={false}
        impactError={null}
        onAnalyze={vi.fn()}
      />
    )

    const btn = screen.getByText('Explain Code Purpose (Watsonx)')
    fireEvent.click(btn)

    await waitFor(() => {
      expect(screen.getByText('Authenticates user credentials and returns session tokens.')).toBeDefined()
      expect(screen.getByText('Validates username and password hash')).toBeDefined()
      expect(screen.getByText('Role: Domain Controller')).toBeDefined()
      expect(screen.getByText('Complexity: LOW')).toBeDefined()
    })
  })

  it('renders Hierarchy Tree button and triggers layout on click', () => {
    const onLayoutHierarchy = vi.fn()
    render(
      <NodePanel
        node={mockNode}
        repoId="test-repo-123"
        impactResult={null}
        impactLoading={false}
        impactError={null}
        onAnalyze={vi.fn()}
        onLayoutHierarchy={onLayoutHierarchy}
      />
    )

    const hierarchyBtn = screen.getByText('Hierarchy Tree')
    expect(hierarchyBtn).toBeDefined()
    fireEvent.click(hierarchyBtn)
    expect(onLayoutHierarchy).toHaveBeenCalledWith('auth_service.login', 'component')
  })

  it('renders active hierarchy state and triggers reset on click', () => {
    const onResetLayout = vi.fn()
    const onScopeChange = vi.fn()
    render(
      <NodePanel
        node={mockNode}
        repoId="test-repo-123"
        impactResult={null}
        impactLoading={false}
        impactError={null}
        onAnalyze={vi.fn()}
        onResetLayout={onResetLayout}
        onScopeChange={onScopeChange}
        isHierarchyActive={true}
        hierarchyNodeCount={5}
        hierarchyScope="component"
      />
    )

    expect(screen.getByText(/Hierarchy: 5 nodes/i)).toBeDefined()
    const resetBtn = screen.getByText('Reset Layout')
    fireEvent.click(resetBtn)
    expect(onResetLayout).toHaveBeenCalled()

    const scopeBtn = screen.getByText(/Full Cluster ⇄/i)
    fireEvent.click(scopeBtn)
    expect(onScopeChange).toHaveBeenCalledWith('lineage')
  })
})

