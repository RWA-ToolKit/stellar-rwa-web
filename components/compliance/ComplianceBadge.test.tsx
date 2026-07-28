import { render, screen } from '@testing-library/react';
import { ComplianceBadge } from '@/components/compliance/ComplianceBadge';
import type { ComplianceStatus } from '@/types';

describe('ComplianceBadge', () => {
  describe('render', () => {
    it('should render the Approved status with correct styling', () => {
      render(<ComplianceBadge status="Approved" />);

      const badge = screen.getByText('Approved');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('chip', 'border', 'text-brand-300');
      expect(badge).toHaveClass('bg-brand-500/10');
    });

    it('should render the Pending status with correct styling', () => {
      render(<ComplianceBadge status="Pending" />);

      const badge = screen.getByText('Pending');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('chip', 'border', 'text-gold-300');
      expect(badge).toHaveClass('bg-gold-500/10');
    });

    it('should render the Suspended status with correct styling', () => {
      render(<ComplianceBadge status="Suspended" />);

      const badge = screen.getByText('Suspended');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('chip', 'border', 'text-orange-300');
      expect(badge).toHaveClass('bg-orange-500/10');
    });

    it('should render the Rejected status with correct styling', () => {
      render(<ComplianceBadge status="Rejected" />);

      const badge = screen.getByText('Rejected');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('chip', 'border', 'text-red-300');
      expect(badge).toHaveClass('bg-red-500/10');
    });

    it('should render the None status with correct styling', () => {
      render(<ComplianceBadge status="None" />);

      const badge = screen.getByText('Not Registered');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('chip', 'border', 'text-base-100/50');
      expect(badge).toHaveClass('bg-white/5');
    });
  });

  describe('dot indicator', () => {
    it('should render a dot indicator for each status', () => {
      const statuses: Array<ComplianceStatus | 'None'> = [
        'Approved',
        'Pending',
        'Suspended',
        'Rejected',
        'None',
      ];

      statuses.forEach(status => {
        const { container, unmount } = render(<ComplianceBadge status={status} />);

        const dot = container.querySelector('span.rounded-full');
        expect(dot).toBeInTheDocument();
        expect(dot).toHaveClass('h-1.5', 'w-1.5', 'rounded-full');
        unmount();
      });
    });

    it('should render the correct colored dot for Approved status', () => {
      const { container } = render(<ComplianceBadge status="Approved" />);

      const dot = container.querySelector('span.rounded-full');
      expect(dot).toHaveClass('bg-brand-400');
    });

    it('should render the correct colored dot for Pending status', () => {
      const { container } = render(<ComplianceBadge status="Pending" />);

      const dot = container.querySelector('span.rounded-full');
      expect(dot).toHaveClass('bg-gold-400');
    });

    it('should render the correct colored dot for Suspended status', () => {
      const { container } = render(<ComplianceBadge status="Suspended" />);

      const dot = container.querySelector('span.rounded-full');
      expect(dot).toHaveClass('bg-orange-400');
    });

    it('should render the correct colored dot for Rejected status', () => {
      const { container } = render(<ComplianceBadge status="Rejected" />);

      const dot = container.querySelector('span.rounded-full');
      expect(dot).toHaveClass('bg-red-400');
    });

    it('should render the correct colored dot for None status', () => {
      const { container } = render(<ComplianceBadge status="None" />);

      const dot = container.querySelector('span.rounded-full');
      expect(dot).toHaveClass('bg-base-100/40');
    });
  });

  describe('labelOverride', () => {
    it('should use labelOverride when provided', () => {
      render(<ComplianceBadge status="Approved" labelOverride="Expired" />);

      const badge = screen.getByText('Expired');
      expect(badge).toBeInTheDocument();
      expect(screen.queryByText('Approved')).not.toBeInTheDocument();
    });

    it('should use default label when labelOverride is not provided', () => {
      render(<ComplianceBadge status="Pending" />);

      const badge = screen.getByText('Pending');
      expect(badge).toBeInTheDocument();
    });

    it('should apply labelOverride while keeping the color scheme of the status', () => {
      render(<ComplianceBadge status="Approved" labelOverride="Active" />);

      const badge = screen.getByText('Active');
      expect(badge).toHaveClass('text-brand-300'); // Still uses Approved color
      expect(badge).toHaveClass('bg-brand-500/10'); // Still uses Approved background
    });

    it('should override label for multiple statuses', () => {
      const overrides = [
        { status: 'Approved' as const, label: 'Valid' },
        { status: 'Pending' as const, label: 'In Progress' },
        { status: 'Rejected' as const, label: 'Denied' },
      ];

      overrides.forEach(({ status, label }) => {
        const { unmount } = render(
          <ComplianceBadge status={status} labelOverride={label} />
        );

        expect(screen.getByText(label)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('custom className', () => {
    it('should apply custom className to the badge', () => {
      render(<ComplianceBadge status="Approved" className="custom-class" />);

      const badge = screen.getByText('Approved');
      expect(badge).toHaveClass('custom-class');
    });

    it('should apply custom className while keeping default styles', () => {
      render(<ComplianceBadge status="Pending" className="my-custom-style" />);

      const badge = screen.getByText('Pending');
      expect(badge).toHaveClass('chip', 'border', 'text-gold-300', 'my-custom-style');
    });

    it('should handle empty className', () => {
      render(<ComplianceBadge status="Approved" className="" />);

      const badge = screen.getByText('Approved');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('chip');
    });
  });

  describe('prop combinations', () => {
    it('should handle status, labelOverride, and className together', () => {
      render(
        <ComplianceBadge
          status="Suspended"
          labelOverride="Under Review"
          className="text-lg"
        />
      );

      const badge = screen.getByText('Under Review');
      expect(badge).toHaveClass('chip', 'border', 'text-orange-300', 'text-lg');
    });

    it('should render correctly with all props provided', () => {
      const { container } = render(
        <ComplianceBadge
          status="Approved"
          labelOverride="KYC Complete"
          className="font-bold"
        />
      );

      const badge = screen.getByText('KYC Complete');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('font-bold');

      const dot = container.querySelector('span.rounded-full');
      expect(dot).toHaveClass('bg-brand-400');
    });
  });

  describe('accessibility', () => {
    it('should render a semantic span element', () => {
      const { container } = render(<ComplianceBadge status="Approved" />);

      const span = container.querySelector('span.chip');
      expect(span).toBeInTheDocument();
      expect(span?.tagName).toBe('SPAN');
    });

    it('should have visible text content for each status', () => {
      const statuses: Array<ComplianceStatus | 'None'> = [
        'Approved',
        'Pending',
        'Suspended',
        'Rejected',
        'None',
      ];

      statuses.forEach(status => {
        const { unmount } = render(<ComplianceBadge status={status} />);

        const badge =
          status === 'None'
            ? screen.getByText('Not Registered')
            : screen.getByText(status);

        expect(badge).toBeVisible();
        unmount();
      });
    });

    it('should have accessible dot indicator', () => {
      const { container } = render(<ComplianceBadge status="Approved" />);

      const dot = container.querySelector('span.rounded-full');
      expect(dot).toBeInTheDocument();
      // Dot is decorative but still accessible as an element
    });
  });

  describe('all compliance statuses', () => {
    it('should handle all ComplianceStatus types correctly', () => {
      const statuses: ComplianceStatus[] = [
        'Approved',
        'Pending',
        'Suspended',
        'Rejected',
      ];

      statuses.forEach(status => {
        const { unmount } = render(<ComplianceBadge status={status} />);

        expect(screen.getByText(status)).toBeInTheDocument();
        unmount();
      });
    });
  });
});
