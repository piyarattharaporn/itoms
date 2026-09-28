import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignInForm } from '../../src/features/auth/SignInForm'
import { useAuth } from '../../src/features/auth/AuthProvider'

vi.mock('../../src/features/auth/AuthProvider', () => ({
  useAuth: vi.fn(),
}))

const mockedUseAuth = vi.mocked(useAuth)

describe('SignInForm', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      signIn: vi.fn(),
      signInWithGoogle: vi.fn(),
      error: null,
      firebaseReady: false,
    } as ReturnType<typeof useAuth>)
  })

  it('exposes labelled credentials and blocks submission when Firebase is not configured', () => {
    render(<SignInForm />)

    expect(screen.getByLabelText('อีเมล')).toBeInTheDocument()
    expect(screen.getByLabelText('รหัสผ่าน')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'เข้าสู่ระบบ' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('ยังไม่ได้ตั้งค่า Firebase')
  })

  it('submits credentials and surfaces a safe authentication error', async () => {
    const user = userEvent.setup()
    const signIn = vi.fn().mockRejectedValue(new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง'))
    mockedUseAuth.mockReturnValue({ signIn, signInWithGoogle: vi.fn(), error: null, firebaseReady: true } as ReturnType<
      typeof useAuth
    >)
    render(<SignInForm />)

    await user.type(screen.getByLabelText('อีเมล'), 'user@example.test')
    await user.type(screen.getByLabelText('รหัสผ่าน'), 'not-a-real-password')
    await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }))

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('user@example.test', 'not-a-real-password'))
    expect(await screen.findByRole('alert')).toHaveTextContent('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  })
})
