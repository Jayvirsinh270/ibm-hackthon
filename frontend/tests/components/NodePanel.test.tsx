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

    const hierarchyBtn = screen.getByText('Arrange Hierarchy Tree')
    expect(hierarchyBtn).toBeDefined()
    fireEvent.click(hierarchyBtn)
    expect(onLayoutHierarchy).toHaveBeenCalledWith('auth_service.login', 'lineage')
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

    expect(screen.getByText(/Hierarchy Active \(5 nodes\)/i)).toBeDefined()
    const resetBtn = screen.getByText('Reset to Default Layout')
    fireEvent.click(resetBtn)
    expect(onResetLayout).toHaveBeenCalled()

    const scopeBtn = screen.getByText('Direct (1-Hop)')
    fireEvent.click(scopeBtn)
    expect(onScopeChange).toHaveBeenCalledWith('lineage')
  })

  it('triggers 1-click Analyse & Explain with AI and Quick Impact Only', () => {
    const onAnalyze = vi.fn()
    render(
      <NodePanel
        node={mockNode}
        repoId="test-repo-123"
        impactResult={null}
        impactLoading={false}
        impactError={null}
        onAnalyze={onAnalyze}
      />
    )

    // Test preset pill
    const refactorPill = screen.getByText('+ Refactor Logic')
    fireEvent.click(refactorPill)
    const textarea = screen.getByPlaceholderText(/Refactoring implementation of/i) as HTMLTextAreaElement
    expect(textarea.value).toBe('Refactoring implementation of login')

    // Click 1-Click Analyse & Explain with AI
    const aiAnalyzeBtn = screen.getByText(/Analyse & Explain with AI/i)
    fireEvent.click(aiAnalyzeBtn)
    expect(onAnalyze).toHaveBeenCalledWith('auth_service.login', 'Refactoring implementation of login', true)

    // Click Quick Impact Only
    const quickImpactBtn = screen.getByText(/Quick Impact Only/i)
    fireEvent.click(quickImpactBtn)
    expect(onAnalyze).toHaveBeenCalledWith('auth_service.login', 'Refactoring implementation of login', false)
  })

  it('renders integrated impact result with AI migration plan slot', () => {
    const mockImpact = {
      selected_node_id: 'auth_service.login',
      selected_node_label: 'login',
      selected_node_type: 'function',
      direct_affected: [{ id: 'api.login_endpoint', label: 'login_endpoint', type: 'function' }],
      transitive_affected: [],
      related_tests: [{ id: 'tests.test_auth', label: 'test_login', type: 'test' }],
      risk_level: 'LOW' as const,
      risk_score: 25,
      contributing_factors: ['Only 1 downstream consumer affected'],
      max_depth: 2,
      analysis_type: 'deterministic',
      change_description: 'Refactoring login logic',
    }

    const mockAiExplanation = {
      available: true,
      explanation: 'Careful testing recommended for login authentication contract.',
      risk_areas: ['Session token invalidation'],
      migration_plan: ['Update login contract', 'Run auth test suite'],
      recommended_tests: ['tests.test_auth.test_login'],
      model_used: 'ibm/granite-13b-chat-v2',
      analysis_type: 'watsonx',
    }

    render(
      <NodePanel
        node={mockNode}
        repoId="test-repo-123"
        impactResult={mockImpact}
        impactLoading={false}
        impactError={null}
        onAnalyze={vi.fn()}
        aiExplanation={mockAiExplanation}
        aiLoading={false}
      />
    )

    expect(screen.getByText('Directly Affected')).toBeDefined()
    expect(screen.getByText('Careful testing recommended for login authentication contract.')).toBeDefined()
    expect(screen.getByText('Session token invalidation')).toBeDefined()
    expect(screen.getByText('Update login contract')).toBeDefined()
    expect(screen.getByText('Copy Plan')).toBeDefined()
  })
})


