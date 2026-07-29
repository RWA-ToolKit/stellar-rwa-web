import { formatUsdCents, formatTokenAmount } from "@/lib/format";
import { PAYMENT_TOKEN_DECIMALS } from "@/components/dividend/ClaimButton";
import type { PortfolioData } from "@/hooks/usePortfolio";

interface PortfolioSummaryProps {
  data: PortfolioData;
}

/** Header stat cards: portfolio value, holding count, total claimable dividends. */
export function PortfolioSummary({ data }: PortfolioSummaryProps) {
  const stats = [
    {
      label: "Estimated Value",
      value: formatUsdCents(data.totalValueCents, { compact: true }),
      accent: "text-gold-300",
    },
    {
      label: "Assets Held",
      value: data.holdings.length.toLocaleString(),
      accent: "text-base-100",
    },
    {
      label: "Claimable Dividends",
      value:
        data.totalClaimable > 0n
          ? formatTokenAmount(data.totalClaimable, PAYMENT_TOKEN_DECIMALS)
          : "—",
      accent: data.totalClaimable > 0n ? "text-brand-300" : "text-base-100/40",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="card p-5">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-base-100/40">
            {s.label}
          </dt>
          <dd className={`mt-2 text-2xl font-bold ${s.accent}`}>{s.value}</dd>
        </div>
      ))}
    </div>
  );
}
