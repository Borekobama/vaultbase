import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { AddProjectDialog } from './AddProjectDialog'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open')
  }
})

describe('AddProjectDialog', () => {
  it('collects an optional owner and progressively reveals Storage S3 credentials', () => {
    render(<AddProjectDialog open existingIds={[]} onClose={vi.fn()} onSubmit={vi.fn()}/>)

    expect(screen.getByLabelText('Owner email (optional)')).toBeInTheDocument()
    expect(screen.queryByLabelText('Access key ID')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Add Storage S3 credentials/i }))

    expect(screen.getByLabelText('S3 endpoint')).toBeInTheDocument()
    expect(screen.getByLabelText('Region')).toBeInTheDocument()
    expect(screen.getByLabelText('Access key ID')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Secret access key')).toHaveAttribute('type', 'password')
  })
})
