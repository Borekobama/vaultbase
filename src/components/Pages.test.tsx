import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { seedState } from '../data/seed'
import { SecretsPage } from './Pages'

describe('SecretsPage', () => {
  it('reveals source-specific instructions for every credential', () => {
    render(<SecretsPage projects={[seedState.projects[0]]} onUpdateDatabase={vi.fn()} onUpdateStorage={vi.fn()} onUpdateManagement={vi.fn()}/>)

    fireEvent.click(screen.getByRole('button', { name: /Customer Portal/ }))
    expect(screen.queryByText('Where to get it')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Instructions for Database connection' }))
    expect(screen.getByText(/executes/)).toHaveTextContent('SELECT current_user')

    fireEvent.click(screen.getByRole('button', { name: 'Instructions for Storage S3' }))
    expect(screen.getByText(/uses rclone to list/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Instructions for Management API token (optional)' }))
    expect(screen.getByText(/personal access token inherits/)).toBeInTheDocument()
    expect(screen.getByText(/calls all six read endpoints/)).toBeInTheDocument()
  })
})
