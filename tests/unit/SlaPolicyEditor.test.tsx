import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SlaPolicyEditor } from '../../src/features/settings/SlaPolicyEditor'

describe('SlaPolicyEditor', () => {
  it('edits a Property target and advances the policy version on save', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <SlaPolicyEditor property={{ id: 'property-1', code: 'P1', slaPolicy: null }} saving={false} onSave={onSave} />,
    )

    const responseInput = screen.getByLabelText('การตอบรับครั้งแรก Critical')
    fireEvent.change(responseInput, { target: { value: '15' } })
    await user.click(screen.getByRole('button', { name: 'บันทึก SLA' }))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        targets: expect.objectContaining({
          Critical: expect.objectContaining({ responseMinutes: 15 }),
        }),
      }),
    )
  })
})
