"use client";

import { useState } from "react";
import { StrKey } from "@stellar/stellar-sdk";
import type { AssetDetail } from "@/types";
import { compliance } from "@/lib/contracts";
import { useTx } from "@/hooks/useTx";
import { useAllowlist } from "@/hooks/useCompliance";
import { ActionCard } from "@/components/issuer/ActionCard";
import { ComplianceBadge } from "@/components/compliance/ComplianceBadge";
import { TxProgress } from "@/components/ui/TxProgress";
import { Spinner } from "@/components/ui/Spinner";
import { truncateAddress } from "@/lib/format";
import { CopyButton } from "@/components/ui/CopyButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface CompliancePanelProps {
  asset: AssetDetail;
  onChanged?: () => void;
}

/** KYC allowlist management: add/suspend/remove addresses, block/unblock jurisdictions. */
export function CompliancePanel({ asset, onChanged }: CompliancePanelProps) {
  const complianceId = asset.metadata.complianceContract;

  return (
    <div className="space-y-4">
      <AddToAllowlistCard complianceId={complianceId} onChanged={onChanged} />
      <AllowlistManageCard complianceId={complianceId} onChanged={onChanged} />
      <JurisdictionCard complianceId={complianceId} onChanged={onChanged} />
    </div>
  );
}

// ---- Add to allowlist ----

function AddToAllowlistCard({
  complianceId,
  onChanged,
}: {
  complianceId: string;
  onChanged?: () => void;
}) {
  const tx = useTx();
  const [address, setAddress] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const addr = address.trim();
    if (!StrKey.isValidEd25519PublicKey(addr) && !StrKey.isValidContract(addr)) {
      setFormError("Enter a valid Stellar address (G… or C…).");
      return;
    }
    const jur = jurisdiction.trim().toUpperCase();
    if (!jur || jur.length < 2 || jur.length > 3) {
      setFormError("Enter a 2–3 character ISO jurisdiction code (e.g. US, DE, KE).");
      return;
    }
    let expiry = 0;
    if (expiresAt.trim()) {
      expiry = parseInt(expiresAt.trim(), 10);
      if (isNaN(expiry) || expiry < 0) {
        setFormError("Expiry ledger must be a non-negative integer (0 = never expires).");
        return;
      }
    }

    const res = await tx.run((ctx) =>
      compliance.addToAllowlist(ctx, complianceId, addr, jur, expiry),
    );
    if (res) {
      setAddress("");
      setJurisdiction("");
      setExpiresAt("");
      onChanged?.();
    }
  }

  return (
    <ActionCard
      title="Approve address"
      description="Add an address to the KYC allowlist, granting it the right to hold and transfer this asset."
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" strokeLinecap="round" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6M22 11h-6" strokeLinecap="round" />
        </svg>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label htmlFor="kyc-address" className="label">Address</label>
          <input
            id="kyc-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="G… or C…"
            disabled={tx.pending}
            className="input font-mono text-xs"
            spellCheck={false}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="kyc-jurisdiction" className="label">Jurisdiction</label>
            <input
              id="kyc-jurisdiction"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value.toUpperCase())}
              placeholder="US"
              maxLength={3}
              disabled={tx.pending}
              className="input uppercase"
            />
          </div>
          <div>
            <label htmlFor="kyc-expires" className="label">Expires at ledger</label>
            <input
              id="kyc-expires"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              placeholder="0 = never"
              inputMode="numeric"
              disabled={tx.pending}
              className="input"
            />
          </div>
        </div>

        {formError && <p className="text-xs text-red-400">{formError}</p>}

        {tx.phase === "idle" ? (
          <button type="submit" disabled={tx.pending} className="btn-primary">
            Approve address
          </button>
        ) : (
          <TxProgress
            phase={tx.phase}
            hash={tx.hash}
            error={tx.error}
            onDismiss={tx.reset}
            successMessage="Address approved on the KYC allowlist."
          />
        )}
      </form>
    </ActionCard>
  );
}

// ---- Manage existing allowlist entries ----

function AllowlistManageCard({
  complianceId,
  onChanged,
}: {
  complianceId: string;
  onChanged?: () => void;
}) {
  const { data, loading, refetch } = useAllowlist(complianceId);
  const records = data ?? [];

  const handleChanged = () => {
    refetch();
    onChanged?.();
  };

  return (
    <ActionCard
      title="Manage allowlist"
      description="Suspend or remove existing KYC-approved addresses. Suspended holders retain their record but lose transfer rights."
      accent="bg-gold-500/10 text-gold-400"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinecap="round" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 11H17M20 8v6" strokeLinecap="round" />
        </svg>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-base-100/40">
          <Spinner size={14} /> Loading allowlist…
        </div>
      ) : records.length === 0 ? (
        <p className="py-2 text-sm text-base-100/40">No addresses on the allowlist yet.</p>
      ) : (
        <ul className="divide-y divide-white/5 max-h-80 overflow-y-auto pr-1">
          {records.map((r) => (
            <AllowlistRow
              key={r.address}
              record={r}
              complianceId={complianceId}
              onChanged={handleChanged}
            />
          ))}
        </ul>
      )}
    </ActionCard>
  );
}

function AllowlistRow({
  record,
  complianceId,
  onChanged,
}: {
  record: { address: string; status: string; jurisdiction: string };
  complianceId: string;
  onChanged?: () => void;
}) {
  const suspendTx = useTx();
  const removeTx = useTx();
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  const isSuspended = record.status === "Suspended";
  const isPending = suspendTx.pending || removeTx.pending;

  async function doRemove() {
    setRemoveConfirmOpen(false);
    removeTx
      .run((ctx) => compliance.remove(ctx, complianceId, record.address))
      .then((r) => r && onChanged?.());
  }

  return (
    <>
      <ConfirmDialog
        open={removeConfirmOpen}
        title="Remove address from allowlist?"
        description={`This will permanently revoke KYC access for ${truncateAddress(record.address, 6, 6)}. The holder will lose the ability to hold or transfer this asset. You can re-approve them later if needed.`}
        confirmLabel="Remove address"
        onConfirm={doRemove}
        onCancel={() => setRemoveConfirmOpen(false)}
      />

      <li className="py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-base-100/80">
              {truncateAddress(record.address, 6, 6)}
            </span>
            <CopyButton value={record.address} />
            <ComplianceBadge status={record.status as never} />
            <span className="text-[10px] text-base-100/40">{record.jurisdiction}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isSuspended && (
              <button
                onClick={() =>
                  suspendTx
                    .run((ctx) => compliance.suspend(ctx, complianceId, record.address))
                    .then((r) => r && onChanged?.())
                }
                disabled={isPending}
                className="btn-ghost py-1 text-xs text-amber-300 hover:bg-amber-500/10"
              >
                Suspend
              </button>
            )}
            {isSuspended && (
              <button
                onClick={() =>
                  suspendTx
                    .run((ctx) =>
                      compliance.addToAllowlist(ctx, complianceId, record.address, record.jurisdiction, 0),
                    )
                    .then((r) => r && onChanged?.())
                }
                disabled={isPending}
                className="btn-ghost py-1 text-xs text-brand-300 hover:bg-brand-500/10"
              >
                Re-approve
              </button>
            )}
            <button
              onClick={() => setRemoveConfirmOpen(true)}
              disabled={isPending}
              className="btn-ghost py-1 text-xs text-red-400 hover:bg-red-500/10"
            >
              Remove
            </button>
          </div>
        </div>
        {/* Show inline TX progress if either action is in flight */}
        {suspendTx.phase !== "idle" && (
          <div className="mt-2">
            <TxProgress
              phase={suspendTx.phase}
              hash={suspendTx.hash}
              error={suspendTx.error}
              onDismiss={suspendTx.reset}
              successMessage="Status updated."
            />
          </div>
        )}
        {removeTx.phase !== "idle" && (
          <div className="mt-2">
            <TxProgress
              phase={removeTx.phase}
              hash={removeTx.hash}
              error={removeTx.error}
              onDismiss={removeTx.reset}
              successMessage="Address removed from allowlist."
            />
          </div>
        )}
      </li>
    </>
  );
}

// ---- Jurisdiction block / unblock ----

function JurisdictionCard({
  complianceId,
  onChanged,
}: {
  complianceId: string;
  onChanged?: () => void;
}) {
  const blockTx = useTx();
  const unblockTx = useTx();
  const [blockJur, setBlockJur] = useState("");
  const [unblockJur, setUnblockJur] = useState("");
  const [blockError, setBlockError] = useState<string | null>(null);
  const [unblockError, setUnblockError] = useState<string | null>(null);

  function validateJur(val: string): string | null {
    const jur = val.trim().toUpperCase();
    if (!jur || jur.length < 2 || jur.length > 3) return "Enter a 2–3 character ISO code.";
    return null;
  }

  // Either form being in-flight locks out the other to prevent racing a
  // block and an unblock against the same jurisdiction before either confirms.
  const eitherPending = blockTx.pending || unblockTx.pending;

  async function onBlock(e: React.FormEvent) {
    e.preventDefault();
    if (eitherPending) return;
    const err = validateJur(blockJur);
    if (err) { setBlockError(err); return; }
    setBlockError(null);
    const res = await blockTx.run((ctx) =>
      compliance.blockJurisdiction(ctx, complianceId, blockJur.trim().toUpperCase()),
    );
    if (res) { setBlockJur(""); onChanged?.(); }
  }

  async function onUnblock(e: React.FormEvent) {
    e.preventDefault();
    if (eitherPending) return;
    const err = validateJur(unblockJur);
    if (err) { setUnblockError(err); return; }
    setUnblockError(null);
    const res = await unblockTx.run((ctx) =>
      compliance.unblockJurisdiction(ctx, complianceId, unblockJur.trim().toUpperCase()),
    );
    if (res) { setUnblockJur(""); onChanged?.(); }
  }

  return (
    <ActionCard
      title="Jurisdiction controls"
      description="Block or unblock entire jurisdictions. Addresses from blocked jurisdictions fail the compliance gate even if individually approved."
      accent="bg-red-500/10 text-red-400"
      icon={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 2a14.5 14.5 0 0 1 0 20M12 2a14.5 14.5 0 0 0 0 20M2 12h20" strokeLinecap="round" />
        </svg>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Block */}
        <form onSubmit={onBlock} className="space-y-2">
          <label htmlFor="block-jur" className="label">Block jurisdiction</label>
          <div className="flex gap-2">
            <input
              id="block-jur"
              value={blockJur}
              onChange={(e) => setBlockJur(e.target.value.toUpperCase())}
              placeholder="e.g. KP"
              maxLength={3}
              disabled={eitherPending}
              className="input flex-1 uppercase"
            />
            <button type="submit" disabled={eitherPending} className="btn-secondary shrink-0">
              Block
            </button>
          </div>
          {blockError && <p className="text-xs text-red-400">{blockError}</p>}
          {blockTx.phase !== "idle" && (
            <TxProgress
              phase={blockTx.phase}
              hash={blockTx.hash}
              error={blockTx.error}
              onDismiss={blockTx.reset}
              successMessage="Jurisdiction blocked."
            />
          )}
        </form>

        {/* Unblock */}
        <form onSubmit={onUnblock} className="space-y-2">
          <label htmlFor="unblock-jur" className="label">Unblock jurisdiction</label>
          <div className="flex gap-2">
            <input
              id="unblock-jur"
              value={unblockJur}
              onChange={(e) => setUnblockJur(e.target.value.toUpperCase())}
              placeholder="e.g. US"
              maxLength={3}
              disabled={eitherPending}
              className="input flex-1 uppercase"
            />
            <button type="submit" disabled={eitherPending} className="btn-secondary shrink-0">
              Unblock
            </button>
          </div>
          {unblockError && <p className="text-xs text-red-400">{unblockError}</p>}
          {unblockTx.phase !== "idle" && (
            <TxProgress
              phase={unblockTx.phase}
              hash={unblockTx.hash}
              error={unblockTx.error}
              onDismiss={unblockTx.reset}
              successMessage="Jurisdiction unblocked."
            />
          )}
        </form>
      </div>
    </ActionCard>
  );
}
