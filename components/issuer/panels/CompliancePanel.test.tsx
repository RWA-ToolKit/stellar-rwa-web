import { fireEvent, render, screen } from "@testing-library/react";
import { Keypair } from "@stellar/stellar-sdk";
import type { AssetDetail } from "@/types";
import { useTx } from "@/hooks/useTx";
import { useAllowlist } from "@/hooks/useCompliance";
import { CompliancePanel } from "./CompliancePanel";

jest.mock("@/hooks/useTx", () => ({
  useTx: jest.fn(),
}));

jest.mock("@/hooks/useCompliance", () => ({
  useAllowlist: jest.fn(),
}));

jest.mock("@/lib/contracts", () => ({
  compliance: {
    addToAllowlist: jest.fn(),
    suspend: jest.fn(),
    remove: jest.fn(),
    blockJurisdiction: jest.fn(),
    unblockJurisdiction: jest.fn(),
  },
}));

jest.mock("@/components/compliance/ComplianceBadge", () => ({
  ComplianceBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

jest.mock("@/components/ui/CopyButton", () => ({
  CopyButton: ({ value }: { value: string }) => (
    <button title="Copy">Copy</button>
  ),
}));

jest.mock("@/components/ui/TxProgress", () => ({
  TxProgress: ({
    phase,
    hash,
    error,
    onDismiss,
    successMessage,
  }: {
    phase: string;
    hash: string | null;
    error: string | null;
    onDismiss: () => void;
    successMessage: string;
  }) => (
    <div data-testid="tx-progress">
      <p>Phase: {phase}</p>
      {hash && <p>Hash: {hash}</p>}
      {error && <p>Error: {error}</p>}
      <p>{successMessage}</p>
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  ),
}));

jest.mock("@/components/ui/Spinner", () => ({
  Spinner: ({ size }: { size?: number }) => <span data-testid="spinner" />,
}));

const mockUseTx = useTx as jest.MockedFunction<typeof useTx>;
const mockUseAllowlist = useAllowlist as jest.MockedFunction<typeof useAllowlist>;

const RECIPIENT = Keypair.random().publicKey();
const CONTRACT_ADDRESS = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

const createMockAsset = (overrides: Partial<AssetDetail> = {}): AssetDetail => ({
  id: 1n,
  tokenContract: "CTOKEN1",
  issuer: "GISSUER",
  name: "Test Asset",
  assetType: "real_estate",
  valuation: 1_000_000_00n,
  createdAt: 50000,
  active: true,
  metadata: {
    name: "Test Asset",
    symbol: "TEST",
    assetType: "real_estate",
    totalSupply: 1_000_000n,
    decimals: 7,
    admin: "GISSUER",
    complianceContract: "CCOMPLIANCE",
    assetDescription: "Test asset",
    valuation: 1_000_000_00n,
    paused: false,
  },
  ...overrides,
});

function setupIdleTx() {
  mockUseTx.mockReturnValue({
    phase: "idle",
    hash: null,
    error: null,
    pending: false,
    run: jest.fn(async (fn) => {
      await fn({} as any);
      return true;
    }),
    reset: jest.fn(),
  });
}

function setupEmptyAllowlist() {
  mockUseAllowlist.mockReturnValue({
    data: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
  });
}

describe("CompliancePanel", () => {
  afterEach(() => jest.clearAllMocks());

  describe("AddToAllowlistCard", () => {
    it("renders the address approval form", () => {
      setupIdleTx();
      setupEmptyAllowlist();
      render(<CompliancePanel asset={createMockAsset()} />);

      expect(screen.getByLabelText("Address")).toBeInTheDocument();
      expect(screen.getByLabelText("Jurisdiction")).toBeInTheDocument();
      expect(screen.getByLabelText("Expires at ledger")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Approve address" })
      ).toBeInTheDocument();
    });

    it("rejects an invalid address", async () => {
      setupIdleTx();
      setupEmptyAllowlist();
      render(<CompliancePanel asset={createMockAsset()} />);

      fireEvent.change(screen.getByLabelText("Address"), {
        target: { value: "not-an-address" },
      });
      fireEvent.change(screen.getByLabelText("Jurisdiction"), {
        target: { value: "US" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Approve address" }));

      expect(
        screen.getByText("Enter a valid Stellar address (G… or C…).")
      ).toBeInTheDocument();
    });

    it("accepts a valid G… address", async () => {
      const mockRun = jest.fn(async (fn) => {
        await fn({} as any);
        return true;
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: mockRun,
        reset: jest.fn(),
      });
      setupEmptyAllowlist();

      render(<CompliancePanel asset={createMockAsset()} />);

      fireEvent.change(screen.getByLabelText("Address"), {
        target: { value: RECIPIENT },
      });
      fireEvent.change(screen.getByLabelText("Jurisdiction"), {
        target: { value: "US" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Approve address" }));

      expect(mockRun).toHaveBeenCalled();
    });

    it("accepts a valid C… contract address", async () => {
      const mockRun = jest.fn(async (fn) => {
        await fn({} as any);
        return true;
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: mockRun,
        reset: jest.fn(),
      });
      setupEmptyAllowlist();

      render(<CompliancePanel asset={createMockAsset()} />);

      fireEvent.change(screen.getByLabelText("Address"), {
        target: { value: CONTRACT_ADDRESS },
      });
      fireEvent.change(screen.getByLabelText("Jurisdiction"), {
        target: { value: "US" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Approve address" }));

      expect(mockRun).toHaveBeenCalled();
    });

    it("rejects a jurisdiction code that is too short", async () => {
      setupIdleTx();
      setupEmptyAllowlist();
      render(<CompliancePanel asset={createMockAsset()} />);

      fireEvent.change(screen.getByLabelText("Address"), {
        target: { value: RECIPIENT },
      });
      fireEvent.change(screen.getByLabelText("Jurisdiction"), {
        target: { value: "U" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Approve address" }));

      expect(
        screen.getByText("Enter a 2–3 character ISO jurisdiction code (e.g. US, DE, KE).")
      ).toBeInTheDocument();
    });

    it("rejects a jurisdiction code that is too long", async () => {
      setupIdleTx();
      setupEmptyAllowlist();
      render(<CompliancePanel asset={createMockAsset()} />);

      fireEvent.change(screen.getByLabelText("Address"), {
        target: { value: RECIPIENT },
      });
      fireEvent.change(screen.getByLabelText("Jurisdiction"), {
        target: { value: "USAA" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Approve address" }));

      expect(
        screen.getByText("Enter a 2–3 character ISO jurisdiction code (e.g. US, DE, KE).")
      ).toBeInTheDocument();
    });

    it("rejects a non-numeric expiry ledger", async () => {
      setupIdleTx();
      setupEmptyAllowlist();
      render(<CompliancePanel asset={createMockAsset()} />);

      fireEvent.change(screen.getByLabelText("Address"), {
        target: { value: RECIPIENT },
      });
      fireEvent.change(screen.getByLabelText("Jurisdiction"), {
        target: { value: "US" },
      });
      fireEvent.change(screen.getByLabelText("Expires at ledger"), {
        target: { value: "not-a-number" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Approve address" }));

      expect(
        screen.getByText("Expiry ledger must be a non-negative integer (0 = never expires).")
      ).toBeInTheDocument();
    });

    it("rejects a negative expiry ledger", async () => {
      setupIdleTx();
      setupEmptyAllowlist();
      render(<CompliancePanel asset={createMockAsset()} />);

      fireEvent.change(screen.getByLabelText("Address"), {
        target: { value: RECIPIENT },
      });
      fireEvent.change(screen.getByLabelText("Jurisdiction"), {
        target: { value: "US" },
      });
      fireEvent.change(screen.getByLabelText("Expires at ledger"), {
        target: { value: "-1" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Approve address" }));

      expect(
        screen.getByText("Expiry ledger must be a non-negative integer (0 = never expires).")
      ).toBeInTheDocument();
    });

    it("accepts 0 as expiry ledger (never expires)", async () => {
      const mockRun = jest.fn(async (fn) => {
        await fn({} as any);
        return true;
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: mockRun,
        reset: jest.fn(),
      });
      setupEmptyAllowlist();

      render(<CompliancePanel asset={createMockAsset()} />);

      fireEvent.change(screen.getByLabelText("Address"), {
        target: { value: RECIPIENT },
      });
      fireEvent.change(screen.getByLabelText("Jurisdiction"), {
        target: { value: "US" },
      });
      fireEvent.change(screen.getByLabelText("Expires at ledger"), {
        target: { value: "0" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Approve address" }));

      expect(mockRun).toHaveBeenCalled();
    });

    it("disables form while transaction is pending", () => {
      mockUseTx.mockReturnValue({
        phase: "signing",
        hash: null,
        error: null,
        pending: true,
        run: jest.fn(),
        reset: jest.fn(),
      });
      setupEmptyAllowlist();

      render(<CompliancePanel asset={createMockAsset()} />);

      expect(screen.getByLabelText("Address")).toBeDisabled();
      expect(screen.getByLabelText("Jurisdiction")).toBeDisabled();
      expect(screen.getByLabelText("Expires at ledger")).toBeDisabled();
    });

    it("calls onChanged callback when approval succeeds", async () => {
      const mockRun = jest.fn(async (fn) => {
        await fn({} as any);
        return true;
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: mockRun,
        reset: jest.fn(),
      });
      setupEmptyAllowlist();

      const onChanged = jest.fn();
      render(<CompliancePanel asset={createMockAsset()} onChanged={onChanged} />);

      fireEvent.change(screen.getByLabelText("Address"), {
        target: { value: RECIPIENT },
      });
      fireEvent.change(screen.getByLabelText("Jurisdiction"), {
        target: { value: "US" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Approve address" }));

      expect(onChanged).toHaveBeenCalled();
    });

    it("converts jurisdiction to uppercase", async () => {
      const mockRun = jest.fn(async (fn) => {
        await fn({} as any);
        return true;
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: mockRun,
        reset: jest.fn(),
      });
      setupEmptyAllowlist();

      render(<CompliancePanel asset={createMockAsset()} />);

      const jurisdictionInput = screen.getByLabelText("Jurisdiction") as HTMLInputElement;
      fireEvent.change(jurisdictionInput, {
        target: { value: "us" },
      });

      expect(jurisdictionInput.value).toBe("US");
    });
  });

  describe("AllowlistManageCard", () => {
    it("shows loading spinner when allowlist is loading", () => {
      setupIdleTx();
      mockUseAllowlist.mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: jest.fn(),
      });

      render(<CompliancePanel asset={createMockAsset()} />);

      expect(screen.getByTestId("spinner")).toBeInTheDocument();
    });

    it("shows empty state when allowlist is empty", () => {
      setupIdleTx();
      setupEmptyAllowlist();

      render(<CompliancePanel asset={createMockAsset()} />);

      expect(screen.getByText("No addresses on the allowlist yet.")).toBeInTheDocument();
    });

    it("renders allowlist entries", () => {
      setupIdleTx();
      mockUseAllowlist.mockReturnValue({
        data: [
          {
            address: RECIPIENT,
            status: "Approved",
            jurisdiction: "US",
          },
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<CompliancePanel asset={createMockAsset()} />);

      expect(screen.getByText("Approved")).toBeInTheDocument();
      expect(screen.getByText("US")).toBeInTheDocument();
    });

    it("shows Suspend button for approved addresses", () => {
      setupIdleTx();
      mockUseAllowlist.mockReturnValue({
        data: [
          {
            address: RECIPIENT,
            status: "Approved",
            jurisdiction: "US",
          },
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<CompliancePanel asset={createMockAsset()} />);

      expect(screen.getByRole("button", { name: "Suspend" })).toBeInTheDocument();
    });

    it("shows Re-approve button for suspended addresses", () => {
      setupIdleTx();
      mockUseAllowlist.mockReturnValue({
        data: [
          {
            address: RECIPIENT,
            status: "Suspended",
            jurisdiction: "US",
          },
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<CompliancePanel asset={createMockAsset()} />);

      expect(screen.getByRole("button", { name: "Re-approve" })).toBeInTheDocument();
    });

    it("always shows Remove button", () => {
      setupIdleTx();
      mockUseAllowlist.mockReturnValue({
        data: [
          {
            address: RECIPIENT,
            status: "Approved",
            jurisdiction: "US",
          },
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<CompliancePanel asset={createMockAsset()} />);

      const removeButtons = screen.getAllByRole("button", { name: "Remove" });
      expect(removeButtons.length).toBeGreaterThan(0);
    });

    it("disables action buttons while transaction is pending", () => {
      mockUseTx.mockReturnValue({
        phase: "signing",
        hash: null,
        error: null,
        pending: true,
        run: jest.fn(),
        reset: jest.fn(),
      });
      mockUseAllowlist.mockReturnValue({
        data: [
          {
            address: RECIPIENT,
            status: "Approved",
            jurisdiction: "US",
          },
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<CompliancePanel asset={createMockAsset()} />);

      expect(screen.getByRole("button", { name: "Suspend" })).toBeDisabled();
    });

    it("calls onChanged callback when action succeeds", async () => {
      const mockRun = jest.fn(async (fn) => {
        await fn({} as any);
        return true;
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: mockRun,
        reset: jest.fn(),
      });
      mockUseAllowlist.mockReturnValue({
        data: [
          {
            address: RECIPIENT,
            status: "Approved",
            jurisdiction: "US",
          },
        ],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const onChanged = jest.fn();
      render(<CompliancePanel asset={createMockAsset()} onChanged={onChanged} />);

      fireEvent.click(screen.getByRole("button", { name: "Suspend" }));

      expect(onChanged).toHaveBeenCalled();
    });
  });

  describe("JurisdictionCard", () => {
    it("renders block and unblock jurisdiction forms", () => {
      setupIdleTx();
      setupEmptyAllowlist();

      render(<CompliancePanel asset={createMockAsset()} />);

      expect(screen.getByLabelText("Block jurisdiction")).toBeInTheDocument();
      expect(screen.getByLabelText("Unblock jurisdiction")).toBeInTheDocument();
    });

    it("rejects a jurisdiction code that is too short in block form", async () => {
      setupIdleTx();
      setupEmptyAllowlist();
      render(<CompliancePanel asset={createMockAsset()} />);

      const blockInput = screen.getByLabelText("Block jurisdiction");
      fireEvent.change(blockInput, { target: { value: "U" } });

      const blockButtons = screen.getAllByRole("button", { name: "Block" });
      fireEvent.click(blockButtons[0]);

      expect(screen.getByText("Enter a 2–3 character ISO code.")).toBeInTheDocument();
    });

    it("accepts a valid jurisdiction code in block form", async () => {
      const mockRun = jest.fn(async (fn) => {
        await fn({} as any);
        return true;
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: mockRun,
        reset: jest.fn(),
      });
      setupEmptyAllowlist();

      render(<CompliancePanel asset={createMockAsset()} />);

      const blockInput = screen.getByLabelText("Block jurisdiction");
      fireEvent.change(blockInput, { target: { value: "KP" } });

      const blockButtons = screen.getAllByRole("button", { name: "Block" });
      fireEvent.click(blockButtons[0]);

      expect(mockRun).toHaveBeenCalled();
    });

    it("accepts a valid jurisdiction code in unblock form", async () => {
      const mockRun = jest.fn(async (fn) => {
        await fn({} as any);
        return true;
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: mockRun,
        reset: jest.fn(),
      });
      setupEmptyAllowlist();

      render(<CompliancePanel asset={createMockAsset()} />);

      const unblockInput = screen.getByLabelText("Unblock jurisdiction");
      fireEvent.change(unblockInput, { target: { value: "US" } });

      const unblockButtons = screen.getAllByRole("button", { name: "Unblock" });
      fireEvent.click(unblockButtons[0]);

      expect(mockRun).toHaveBeenCalled();
    });

    it("converts jurisdiction codes to uppercase", () => {
      setupIdleTx();
      setupEmptyAllowlist();
      render(<CompliancePanel asset={createMockAsset()} />);

      const blockInput = screen.getByLabelText("Block jurisdiction") as HTMLInputElement;
      fireEvent.change(blockInput, { target: { value: "kp" } });

      expect(blockInput.value).toBe("KP");
    });

    it("disables block button while transaction is pending", () => {
      mockUseTx.mockReturnValue({
        phase: "signing",
        hash: null,
        error: null,
        pending: true,
        run: jest.fn(),
        reset: jest.fn(),
      });
      setupEmptyAllowlist();

      render(<CompliancePanel asset={createMockAsset()} />);

      const blockButtons = screen.getAllByRole("button", { name: "Block" });
      expect(blockButtons[0]).toBeDisabled();
    });

    it("disables unblock button while transaction is pending", () => {
      mockUseTx.mockReturnValue({
        phase: "signing",
        hash: null,
        error: null,
        pending: true,
        run: jest.fn(),
        reset: jest.fn(),
      });
      setupEmptyAllowlist();

      render(<CompliancePanel asset={createMockAsset()} />);

      const unblockButtons = screen.getAllByRole("button", { name: "Unblock" });
      expect(unblockButtons[0]).toBeDisabled();
    });

    it("calls onChanged callback when block succeeds", async () => {
      const mockRun = jest.fn(async (fn) => {
        await fn({} as any);
        return true;
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: mockRun,
        reset: jest.fn(),
      });
      setupEmptyAllowlist();

      const onChanged = jest.fn();
      render(<CompliancePanel asset={createMockAsset()} onChanged={onChanged} />);

      const blockInput = screen.getByLabelText("Block jurisdiction");
      fireEvent.change(blockInput, { target: { value: "KP" } });

      const blockButtons = screen.getAllByRole("button", { name: "Block" });
      fireEvent.click(blockButtons[0]);

      expect(onChanged).toHaveBeenCalled();
    });

    it("calls onChanged callback when unblock succeeds", async () => {
      const mockRun = jest.fn(async (fn) => {
        await fn({} as any);
        return true;
      });
      mockUseTx.mockReturnValue({
        phase: "idle",
        hash: null,
        error: null,
        pending: false,
        run: mockRun,
        reset: jest.fn(),
      });
      setupEmptyAllowlist();

      const onChanged = jest.fn();
      render(<CompliancePanel asset={createMockAsset()} onChanged={onChanged} />);

      const unblockInput = screen.getByLabelText("Unblock jurisdiction");
      fireEvent.change(unblockInput, { target: { value: "US" } });

      const unblockButtons = screen.getAllByRole("button", { name: "Unblock" });
      fireEvent.click(unblockButtons[0]);

      expect(onChanged).toHaveBeenCalled();
    });
  });
});
