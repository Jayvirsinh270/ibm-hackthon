import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import UploadPage from '../../src/pages/UploadPage'

vi.mock('../../src/api/client', () => ({
  uploadRepository: vi.fn(),
  getStructure: vi.fn(),
  deleteRepository: vi.fn(),
  scanRepository: vi.fn().mockResolvedValue({}),
  cloneRepository: vi.fn(),
  loadDemoRepository: vi.fn(),
}))

describe('UploadPage multi-modal importer', () => {
  it('renders GitHub URL tab by default with repository input and preset buttons', () => {
    render(<UploadPage onRepoReady={vi.fn()} />)
    expect(screen.getByText('GitHub URL')).toBeDefined()
    expect(screen.getByPlaceholderText('https://github.com/owner/repository')).toBeDefined()
    expect(screen.getByText('pallets/flask')).toBeDefined()
  })

  it('switches to 1-Click Demos tab and displays interactive demo cards', () => {
    render(<UploadPage onRepoReady={vi.fn()} />)
    const demoTab = screen.getByText('1-Click Demos')
    fireEvent.click(demoTab)

    expect(screen.getByText('Instant Demo Showcase')).toBeDefined()
    expect(screen.getByText('Auth & RBAC Microservice')).toBeDefined()
    expect(screen.getByText('E-Commerce Checkout Core')).toBeDefined()
  })

  it('switches to Upload ZIP tab and displays drag and drop dropzone', () => {
    render(<UploadPage onRepoReady={vi.fn()} />)
    const zipTab = screen.getByText('Upload ZIP')
    fireEvent.click(zipTab)

    expect(screen.getByText('Drop your repository here')).toBeDefined()
  })
})
