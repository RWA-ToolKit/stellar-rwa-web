import { render, screen } from '@testing-library/react';
import { AssetTypeBadge } from '@/components/asset/AssetTypeBadge';

describe('AssetTypeBadge', () => {
  describe('render', () => {
    it('should render the real_estate asset type with correct styling', () => {
      render(<AssetTypeBadge type="real_estate" />);
      
      const badge = screen.getByText('Real Estate');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('chip', 'border', 'text-sky-300');
      expect(badge).toHaveClass('bg-sky-500/10');
    });

    it('should render the invoice asset type with correct styling', () => {
      render(<AssetTypeBadge type="invoice" />);
      
      const badge = screen.getByText('Invoice');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('chip', 'border', 'text-violet-300');
      expect(badge).toHaveClass('bg-violet-500/10');
    });

    it('should render the commodity asset type with correct styling', () => {
      render(<AssetTypeBadge type="commodity" />);
      
      const badge = screen.getByText('Commodity');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('chip', 'border', 'text-amber-300');
      expect(badge).toHaveClass('bg-amber-500/10');
    });
  });

  describe('fallback styling', () => {
    it('should render with fallback styling for unknown asset types', () => {
      render(<AssetTypeBadge type="unknown_type" />);
      
      const badge = screen.getByText('Unknown Type');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('chip', 'border', 'text-base-100/60');
      expect(badge).toHaveClass('bg-white/5');
    });
  });

  describe('custom className', () => {
    it('should apply custom className to the badge', () => {
      render(<AssetTypeBadge type="real_estate" className="custom-class" />);
      
      const badge = screen.getByText('Real Estate');
      expect(badge).toHaveClass('custom-class');
    });

    it('should apply custom className while keeping default styles', () => {
      render(<AssetTypeBadge type="invoice" className="my-custom-style" />);
      
      const badge = screen.getByText('Invoice');
      expect(badge).toHaveClass('chip', 'border', 'text-violet-300', 'my-custom-style');
    });
  });

  describe('icon rendering', () => {
    it('should render an SVG icon inside the badge', () => {
      const { container } = render(<AssetTypeBadge type="real_estate" />);
      
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '13');
      expect(svg).toHaveAttribute('height', '13');
    });

    it('should render the correct icon for each asset type', () => {
      const { container: realEstateContainer } = render(<AssetTypeBadge type="real_estate" />);
      const realEstateSvg = realEstateContainer.querySelector('svg');
      expect(realEstateSvg).toBeInTheDocument();

      const { container: invoiceContainer } = render(<AssetTypeBadge type="invoice" />);
      const invoiceSvg = invoiceContainer.querySelector('svg');
      expect(invoiceSvg).toBeInTheDocument();

      const { container: commodityContainer } = render(<AssetTypeBadge type="commodity" />);
      const commoditySvg = commodityContainer.querySelector('svg');
      expect(commoditySvg).toBeInTheDocument();
    });
  });

  describe('prop variations', () => {
    it('should handle empty className prop gracefully', () => {
      render(<AssetTypeBadge type="real_estate" className="" />);
      
      const badge = screen.getByText('Real Estate');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('chip');
    });

    it('should handle all valid asset types', () => {
      const types = ['real_estate', 'invoice', 'commodity'];
      
      types.forEach(type => {
        const { unmount } = render(<AssetTypeBadge type={type} />);
        expect(screen.getByText(/Real Estate|Invoice|Commodity/)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('accessibility', () => {
    it('should render a semantic span element', () => {
      const { container } = render(<AssetTypeBadge type="real_estate" />);
      
      const span = container.querySelector('span.chip');
      expect(span).toBeInTheDocument();
      expect(span?.tagName).toBe('SPAN');
    });

    it('should have visible text content', () => {
      render(<AssetTypeBadge type="invoice" />);
      
      const badge = screen.getByText('Invoice');
      expect(badge).toBeVisible();
    });
  });
});
