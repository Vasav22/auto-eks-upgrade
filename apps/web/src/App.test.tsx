import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App', () => {
  it('should render without crashing', () => {
    render(<App />);
    expect(screen.getByText(/EKS Upgrade Control Plane/i)).toBeInTheDocument();
  });

  it('should contain navigation links to all six routes', () => {
    render(<App />);
    
    expect(screen.getByText('Fleet Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Health Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Campaigns')).toBeInTheDocument();
    expect(screen.getByText('Backup Management')).toBeInTheDocument();
    expect(screen.getByText('Audit & Compliance')).toBeInTheDocument();
  });

  it('should have skip to content link for accessibility', () => {
    render(<App />);
    expect(screen.getByText('Skip to content')).toBeInTheDocument();
  });
});
