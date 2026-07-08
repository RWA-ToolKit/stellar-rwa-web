import Link from "next/link";

const CONTRACTS_REPO = "https://github.com/your-org/stellar-rwa-contracts";
const DOCS_REPO = "https://github.com/your-org/stellar-rwa-api-docs";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-white/5">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <p className="text-sm font-bold text-base-100">
              Stellar<span className="text-brand-400">RWA</span>
            </p>
            <p className="mt-2 text-sm text-base-100/50">
              Tokenize real-world assets on Stellar with on-chain compliance and
              proportional dividend distribution.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 text-sm sm:gap-16">
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-base-100/40">
                Platform
              </p>
              <ul className="space-y-2 text-base-100/60">
                <li><Link href="/explore" className="hover:text-brand-300">Explore assets</Link></li>
                <li><Link href="/asset/new" className="hover:text-brand-300">Tokenize an asset</Link></li>
                <li><Link href="/issuer" className="hover:text-brand-300">Issuer dashboard</Link></li>
                <li><Link href="/portfolio" className="hover:text-brand-300">Portfolio</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-base-100/40">
                Developers
              </p>
              <ul className="space-y-2 text-base-100/60">
                <li><a href={CONTRACTS_REPO} target="_blank" rel="noopener noreferrer" className="hover:text-brand-300">Contracts ↗</a></li>
                <li><a href={DOCS_REPO} target="_blank" rel="noopener noreferrer" className="hover:text-brand-300">API &amp; Docs ↗</a></li>
                <li><a href="https://developers.stellar.org/docs/build/smart-contracts" target="_blank" rel="noopener noreferrer" className="hover:text-brand-300">Soroban ↗</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/5 pt-6 text-xs text-base-100/40">
          Built on Stellar / Soroban. Asset tokens are compliance-gated — only
          KYC-approved addresses can hold or transfer them.
        </div>
      </div>
    </footer>
  );
}
