import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RouteError from './RouteError';

describe('RouteError', () => {
  it('renders default label when none provided', () => {
    render(
      <RouteError
        error={new Error('test')}
        reset={vi.fn()}
      />,
    );
    expect(screen.getByText('出了点问题')).toBeInTheDocument();
  });

  it('renders custom label in heading', () => {
    render(
      <RouteError
        error={new Error('test')}
        reset={vi.fn()}
        label="笔记"
      />,
    );
    expect(screen.getByText('笔记出了点问题')).toBeInTheDocument();
  });

  it('calls reset when retry button clicked', async () => {
    const reset = vi.fn();
    render(
      <RouteError
        error={new Error('test')}
        reset={reset}
        label="文件"
      />,
    );
    await userEvent.click(screen.getByText('重试'));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('renders home link pointing to /', () => {
    render(
      <RouteError
        error={new Error('test')}
        reset={vi.fn()}
      />,
    );
    const homeLink = screen.getByText('返回首页').closest('a');
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('logs error to console on mount', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const testError = new Error('mount test error');
    render(
      <RouteError
        error={testError}
        reset={vi.fn()}
        label="设置"
      />,
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      '[设置 error]:',
      'mount test error',
    );
    consoleSpy.mockRestore();
  });
});
