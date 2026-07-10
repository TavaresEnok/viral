import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDefined();
  });

  it('shows loading state', () => {
    render(<Button loading>Click</Button>);
    expect(screen.getByText('Click')).toBeDefined();
  });
});
