import { signTx, WalletError, LockedWalletError } from "@/lib/freighter";
import * as FreighterApi from "@stellar/freighter-api";

jest.mock("@stellar/freighter-api");

describe("freighter", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("signTx", () => {
    const testXdr = "base64xdr";
    const testPassphrase = "Test SDF Network ; September 2015";
    const testAddress = "GAAAA";

    it("returns signed XDR on success", async () => {
      (FreighterApi.signTransaction as jest.Mock).mockResolvedValue({
        error: null,
        signedTxXdr: "signedXdr123",
      });

      const result = await signTx(testXdr, testPassphrase, testAddress);
      expect(result).toBe("signedXdr123");
    });

    it("throws LockedWalletError when wallet is locked", async () => {
      (FreighterApi.signTransaction as jest.Mock).mockResolvedValue({
        error: "User is not connected. Please connect to Freighter",
      });

      await expect(signTx(testXdr, testPassphrase, testAddress)).rejects.toBeInstanceOf(
        LockedWalletError,
      );
    });

    it("throws LockedWalletError when Freighter reports 'locked'", async () => {
      (FreighterApi.signTransaction as jest.Mock).mockResolvedValue({
        error: "Freighter is locked. Please unlock it.",
      });

      await expect(signTx(testXdr, testPassphrase, testAddress)).rejects.toBeInstanceOf(
        LockedWalletError,
      );
    });

    it("throws LockedWalletError when Freighter reports 'unlock'", async () => {
      (FreighterApi.signTransaction as jest.Mock).mockResolvedValue({
        error: "Please unlock your Freighter wallet",
      });

      await expect(signTx(testXdr, testPassphrase, testAddress)).rejects.toBeInstanceOf(
        LockedWalletError,
      );
    });

    it("throws LockedWalletError for 'not allowed' error", async () => {
      (FreighterApi.signTransaction as jest.Mock).mockResolvedValue({
        error: "This app is not allowed to access your wallet",
      });

      await expect(signTx(testXdr, testPassphrase, testAddress)).rejects.toBeInstanceOf(
        LockedWalletError,
      );
    });

    it("throws LockedWalletError for 'not connected' error", async () => {
      (FreighterApi.signTransaction as jest.Mock).mockResolvedValue({
        error: "Wallet is not connected",
      });

      await expect(signTx(testXdr, testPassphrase, testAddress)).rejects.toBeInstanceOf(
        LockedWalletError,
      );
    });

    it("throws generic WalletError for non-locked errors", async () => {
      (FreighterApi.signTransaction as jest.Mock).mockResolvedValue({
        error: "Some other error",
      });

      await expect(signTx(testXdr, testPassphrase, testAddress)).rejects.toBeInstanceOf(WalletError);
      await expect(signTx(testXdr, testPassphrase, testAddress)).rejects.not.toBeInstanceOf(
        LockedWalletError,
      );
    });

    it("throws WalletError when no signed XDR is returned", async () => {
      (FreighterApi.signTransaction as jest.Mock).mockResolvedValue({
        error: null,
        signedTxXdr: null,
      });

      await expect(signTx(testXdr, testPassphrase, testAddress)).rejects.toBeInstanceOf(WalletError);
    });

    it("detects case-insensitive 'locked' keyword", async () => {
      (FreighterApi.signTransaction as jest.Mock).mockResolvedValue({
        error: "LOCKED: Please try again",
      });

      await expect(signTx(testXdr, testPassphrase, testAddress)).rejects.toBeInstanceOf(
        LockedWalletError,
      );
    });
  });

  describe("LockedWalletError", () => {
    it("has correct name and message", () => {
      const error = new LockedWalletError();
      expect(error.name).toBe("LockedWalletError");
      expect(error.message).toContain("locked");
      expect(error.message).toContain("unlock");
    });

    it("is an instance of WalletError", () => {
      const error = new LockedWalletError();
      expect(error).toBeInstanceOf(WalletError);
    });
  });
});
