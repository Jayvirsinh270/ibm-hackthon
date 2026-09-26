import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RiskBadge from '../../src/components/RiskBadge'

describe('RiskBadge', () => {
  it('renders HIGH risk correctly', () => {
    render(<RiskBadge level="HIGH" score={0.75} />)
    expect(screen.getByText('HIGH')).toBeDefined()
    expect(screen.getByText('75% risk')).toBeDefined()
  })

  it('renders MEDIUM risk correctly', () => {
    render(<RiskBadge level="MEDIUM" score={0.42} />)
    expect(screen.getByText('MEDIUM')).toBeDefined()
    expect(screen.getByText('42% risk')).toBeDefined()
  })

  it('renders LOW risk without score correctly', () => {
    render(<RiskBadge level="LOW" />)
    expect(screen.getByText('LOW')).toBeDefined()
  })
})
