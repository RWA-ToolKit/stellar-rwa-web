import { render, screen } from "@testing-library/react";
import type { AssetDetail } from "@/types";
import { useHolders, type Holder } from "@/hooks/useHolders";
import { useWallet } from "@/hooks/useWallet";
import { HolderList } from "./HolderList";

jest.mock("@/hooks/useHolders", () => ({
  useHolders: jest.fn(),
}));

jest.mock("@/hooks/useWallet", () => ({
  useWallet: jest.fn(),
}));

const mockUseHolders = useHolders as jest.MockedFunction<typeof useHolders>;
const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>;

const asset = {
  tokenContract: "CTOKEN",
  metadata: {
    complianceContract: "CCOMPLIANCE",
    decimals: 0,
    symbol: "TOKEN",
    totalSupply: 1_000n,
  },
} as AssetDetail;

function setup(holders: Holder[]) {
  mockUseWallet.mockReturnValue({ address: null } as ReturnType<typeof useWallet>);
  mockUseHolders.mockReturnValue({
    data: holders,
    loading: false,
    error: null,
    refetch: jest.fn(),
  });
}

describe("HolderList", () => {
  afterEach(() => jest.clearAllMocks());

  it("renders holders in descending balance order", () => {
    setup([
      { address: "GHIGHHOLDER123456789ABCDEFGHIJKL", balance: 900n },
      { address: "GLOWWHOLDER123456789ABCDEFGHIJMN", balance: 100n },
    ]);

    render(<HolderList asset={asset} />);

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(screen.getByRole("listitem", { name: /900 TOKEN/ })).toBe(rows[0]);
    expect(screen.getByRole("listitem", { name: /100 TOKEN/ })).toBe(rows[1]);
  });

  it("shows an empty state when there are no holders", () => {
    setup([]);

    render(<HolderList asset={asset} />);

    expect(screen.getByRole("heading", { name: "No holders yet" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Once the issuer distributes this asset to approved addresses, holders appear here.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
