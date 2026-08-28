import { render, screen } from "@testing-library/react";
import type { AssetDetail } from "@/types";
import { useAsset, useBalance } from "@/hooks/useAsset";
import { useComplianceOverview } from "@/hooks/useCompliance";
import { useHolders } from "@/hooks/useHolders";
import { useDividends } from "@/hooks/useDividends";
import { useWallet } from "@/hooks/useWallet";
import { useAsync } from "@/hooks/useAsync";
import { AssetDetailView } from "./AssetDetailView";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a {...props}>{children}</a>
  ),
}));

jest.mock("@/hooks/useAsset", () => ({
  useAsset: jest.fn(),
  useBalance: jest.fn(),
}));

jest.mock("@/hooks/useCompliance", () => ({
  useComplianceOverview: jest.fn(),
}));

jest.mock("@/hooks/useHolders", () => ({
  useHolders: jest.fn(),
}));

jest.mock("@/hooks/useDividends", () => ({
  useDividends: jest.fn(),
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

jest.mock("@/hooks/useAsync", () => ({
  useAsync: jest.fn(),
}));

jest.mock("@/lib/stellar", () => ({
  getLatestLedger: jest.fn(),
  explorerContractUrl: (_network: string, contractId: string) =>
    `https://stellar.expert/contract/${contractId}`,
}));

jest.mock("./AssetHeader", () => ({
  AssetHeader: () => <h1>Asset header</h1>,
}));

jest.mock("./AssetStats", () => ({
  AssetStats: () => <p>Asset stats</p>,
}));

jest.mock("./TransferPanel", () => ({
  TransferPanel: () => <p>Transfer panel</p>,
}));

jest.mock("@/components/dividend/DistributionCard", () => ({
  DistributionCard: () => <p>Distribution card</p>,
}));

const mockUseAsset = useAsset as jest.MockedFunction<typeof useAsset>;
const mockUseBalance = useBalance as jest.MockedFunction<typeof useBalance>;
const mockUseComplianceOverview = useComplianceOverview as jest.MockedFunction<
  typeof useComplianceOverview
>;
const mockUseHolders = useHolders as jest.MockedFunction<typeof useHolders>;
const mockUseDividends = useDividends as jest.MockedFunction<typeof useDividends>;
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;
const mockUseAsync = useAsync as jest.MockedFunction<typeof useAsync>;

const asset: AssetDetail = {
  id: 1n,
  tokenContract: "CTOKEN",
  issuer: "GISSUER",
  name: "Lagos Office Tower",
  assetType: "real_estate",
  valuation: 5_000_000_00n,
  createdAt: 100,
  active: true,
  metadata: {
    name: "Lagos Office Tower",
    symbol: "LOT",
    assetType: "real_estate",
    totalSupply: 1_000_000n,
    decimals: 2,
    admin: "GISSUER",
    complianceContract: "CCOMPLIANCE",
    assetDescription: "A commercial tower.",
    valuation: 5_000_000_00n,
    paused: false,
  },
};

function setup() {
  mockUseWallet.mockReturnValue({ network: "testnet", address: null } as ReturnType<typeof useWallet>);
  mockUseAsset.mockReturnValue({ data: asset, loading: false, error: null, refetch: jest.fn() });
  mockUseBalance.mockReturnValue({ data: 0n, loading: false, error: null, refetch: jest.fn() });
  mockUseDividends.mockReturnValue({ data: [], loading: false, error: null, refetch: jest.fn() });
  mockUseHolders.mockReturnValue({ data: [], loading: false, error: null, refetch: jest.fn() });
  mockUseComplianceOverview.mockReturnValue({
    data: { allowlistSize: 1, jurisdictions: [] },
    loading: false,
    error: null,
    refetch: jest.fn(),
  });
  mockUseAsync.mockReturnValue({ data: 123, loading: false, error: null, refetch: jest.fn() });
}

describe("AssetDetailView", () => {
  afterEach(() => jest.clearAllMocks());

  it("renders every asset detail sub-panel", () => {
    setup();

    render(<AssetDetailView id={1n} />);

    expect(screen.getByRole("heading", { name: "About this asset" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dividend history" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Holders" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Compliance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your position" })).toBeInTheDocument();
  });

  it("keeps the detail view available when dividends fail", () => {
    setup();
    mockUseDividends.mockReturnValue({
      data: null,
      loading: false,
      error: "Dividend service unavailable",
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Dividend service unavailable");
    expect(screen.getByRole("heading", { name: "Holders" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your position" })).toBeInTheDocument();
  });

  it("keeps the detail view available when holders fail", () => {
    setup();
    mockUseHolders.mockReturnValue({
      data: null,
      loading: false,
      error: "Holder service unavailable",
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);

    expect(screen.getByText("Couldn't load holders.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Compliance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your position" })).toBeInTheDocument();
  });

  it("keeps the detail view available when compliance fails", () => {
    setup();
    mockUseComplianceOverview.mockReturnValue({
      data: null,
      loading: false,
      error: "Compliance service unavailable",
      refetch: jest.fn(),
    });

    render(<AssetDetailView id={1n} />);

    expect(screen.getByText("Couldn't load compliance data.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dividend history" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your position" })).toBeInTheDocument();
  });
});