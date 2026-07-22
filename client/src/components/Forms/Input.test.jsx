import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Input from './Input';

describe('Input', () => {
  it('associates its visible label and validation message with the field', () => {
    render(
      <Input
        label='Email address'
        inputProps={{ name: 'email', type: 'email' }}
        alert={{ state: 'error', msg: 'Enter a valid email address' }}
      />
    );

    const input = screen.getByRole('textbox', { name: 'Email address' });
    const alert = screen.getByRole('alert');

    expect(input).toHaveAttribute('id', 'email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid email address');
    expect(alert).toHaveAttribute('id', 'email-message');
  });

  it('preserves caller descriptions alongside validation feedback', () => {
    render(
      <>
        <p id='password-help'>Use at least twelve characters.</p>
        <Input
          label='Password'
          type='password'
          inputProps={{
            name: 'password',
            'aria-describedby': 'password-help',
          }}
          alert={{ state: 'error', msg: 'Password is required' }}
        />
      </>
    );

    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'aria-describedby',
      'password-help password-message'
    );
  });

  it('exposes the password visibility control as a real named button', async () => {
    const user = userEvent.setup();
    const onShowClick = vi.fn();
    render(
      <Input
        label='Password'
        type='password'
        show={false}
        onShowClick={onShowClick}
        inputProps={{ name: 'password' }}
      />
    );

    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(toggle).toHaveAttribute('type', 'button');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);
    expect(onShowClick).toHaveBeenCalledOnce();
  });

  it('uses a generated label relationship when no id or name is supplied', () => {
    render(<Input label='Unidentified field' inputProps={{}} />);

    const input = screen.getByLabelText('Unidentified field');
    expect(input.id).not.toBe('');
  });
});
