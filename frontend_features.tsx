// Issues #572, #573, #574, #575 - Frontend features

// ============================================================================
// Issue #572: Visual Regression Test for SEP-41 Allowance UI
// ============================================================================

// e2e/distribution-allowance.spec.ts
import { test, expect } from '@playwright/test';

test.describe('SEP-41 Allowance UI', () => {
  test('should show approval-needed state', async ({ page }) => {
    await page.goto('/issuer/distribution');

    // Trigger approval-needed state
    await page.fill('[data-testid="spender"]', 'GXXX...');

    const approvalNeeded = page.locator('[data-testid="approval-needed"]');
    await expect(approvalNeeded).toBeVisible();

    // Visual regression: capture screenshot
    await expect(page).toHaveScreenshot('distribution-approval-needed.png');
  });

  test('should show balance-insufficient state', async ({ page }) => {
    await page.goto('/issuer/distribution');

    // Trigger insufficient balance state
    await page.fill('[data-testid="amount"]', '999999');

    const insufficient = page.locator('[data-testid="balance-insufficient"]');
    await expect(insufficient).toBeVisible();

    // Visual regression: capture screenshot
    await expect(page).toHaveScreenshot('distribution-insufficient.png');
  });
});

// ============================================================================
// Issue #573: First-Class Approve/Allowance UI
// ============================================================================

// components/investor/ApprovalPanel.tsx
import React, { useState } from 'react';
import { Address } from '@stellar/js-stellar-sdk';

interface ApprovePanelProps {
  assetContract: string;
}

export const ApprovalPanel: React.FC<ApprovePanelProps> = ({ assetContract }) => {
  const [spender, setSpender] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [allowance, setAllowance] = useState<string | null>(null);

  const handleApprove = async () => {
    setIsLoading(true);
    try {
      // Call contract approve function
      const tx = await window.freighter.signTransaction(
        buildApproveTx(assetContract, spender, amount)
      );
      await submitTransaction(tx);
      setAllowance(amount);
    } catch (err) {
      console.error('Approval failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQueryAllowance = async () => {
    try {
      const result = await readContract(assetContract, 'allowance', {
        from: getCurrentAddress(),
        spender,
      });
      setAllowance(result);
    } catch (err) {
      console.error('Query failed:', err);
    }
  };

  return (
    <div className="p-6 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Approve Spender</h3>

      <input
        type="text"
        placeholder="Spender address"
        value={spender}
        onChange={(e) => setSpender(e.target.value)}
        className="w-full px-3 py-2 mb-3 border rounded"
      />

      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full px-3 py-2 mb-3 border rounded"
      />

      <button
        onClick={handleApprove}
        disabled={isLoading || !spender || !amount}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {isLoading ? 'Approving...' : 'Approve'}
      </button>

      <button
        onClick={handleQueryAllowance}
        className="w-full px-4 py-2 mt-2 border rounded"
      >
        Check Allowance
      </button>

      {allowance && (
        <p className="mt-3 text-sm text-gray-600">
          Current allowance: {allowance}
        </p>
      )}
    </div>
  );
};

// ============================================================================
// Issue #574: Guardian Role in Issuer Dashboard
// ============================================================================

// components/issuer/IssuerDashboard.tsx
import React, { useEffect, useState } from 'react';

interface IssuerDashboardProps {
  adminAddress: string;
  assetContract: string;
}

export const IssuerDashboard: React.FC<IssuerDashboardProps> = ({
  adminAddress,
  assetContract,
}) => {
  const [userRole, setUserRole] = useState<'admin' | 'guardian' | 'none'>('none');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      const currentAddr = await getCurrentAddress();

      // Check if current user is admin
      const admin = await readContract(assetContract, 'admin', {});
      if (admin === currentAddr) {
        setUserRole('admin');
        return;
      }

      // Check if current user is guardian
      const guardian = await readContract(assetContract, 'guardian', {});
      if (guardian === currentAddr) {
        setUserRole('guardian');
        return;
      }

      setUserRole('none');
      setIsLoading(false);
    };

    checkRole();
  }, [assetContract]);

  if (isLoading) return <div>Loading...</div>;
  if (userRole === 'none') return <div>Access denied</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Issuer Dashboard</h2>
      <p className="mb-4">Role: <span className="font-semibold capitalize">{userRole}</span></p>

      {/* Full admin panel - only for admins */}
      {userRole === 'admin' && (
        <>
          <section className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Mint Control</h3>
            <TokenPanel assetContract={assetContract} />
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Compliance</h3>
            <CompliancePanel assetContract={assetContract} />
          </section>
        </>
      )}

      {/* Guardian panel - available to both admin and guardian */}
      {(userRole === 'admin' || userRole === 'guardian') && (
        <section className="mb-6">
          <h3 className="text-lg font-semibold mb-2">Pause Control</h3>
          <PausePanel assetContract={assetContract} />
        </section>
      )}
    </div>
  );
};

// ============================================================================
// Issue #575: Two-Step Admin Handover Flow
// ============================================================================

// components/issuer/panels/AdminHandoverPanel.tsx
import React, { useState, useEffect } from 'react';

interface AdminHandoverPanelProps {
  assetContract: string;
  currentAdmin: string;
}

export const AdminHandoverPanel: React.FC<AdminHandoverPanelProps> = ({
  assetContract,
  currentAdmin,
}) => {
  const [pendingAdmin, setPendingAdmin] = useState<string | null>(null);
  const [proposedAddr, setProposedAddr] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userAddr, setUserAddr] = useState('');

  useEffect(() => {
    const init = async () => {
      setUserAddr(await getCurrentAddress());

      try {
        const pending = await readContract(assetContract, 'pending_admin', {});
        setPendingAdmin(pending || null);
      } catch {
        setPendingAdmin(null);
      }
    };

    init();
  }, [assetContract]);

  const handlePropose = async () => {
    if (userAddr !== currentAdmin) {
      alert('Only current admin can propose');
      return;
    }

    setIsLoading(true);
    try {
      const tx = buildProposalTx(assetContract, proposedAddr);
      const signed = await window.freighter.signTransaction(tx);
      await submitTransaction(signed);
      setPendingAdmin(proposedAddr);
      setProposedAddr('');
    } catch (err) {
      console.error('Proposal failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      const tx = buildAcceptAdminTx(assetContract);
      const signed = await window.freighter.signTransaction(tx);
      await submitTransaction(signed);
      setPendingAdmin(null);
    } catch (err) {
      console.error('Accept failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (userAddr !== currentAdmin) {
      alert('Only current admin can cancel');
      return;
    }

    setIsLoading(true);
    try {
      const tx = buildCancelProposalTx(assetContract);
      const signed = await window.freighter.signTransaction(tx);
      await submitTransaction(signed);
      setPendingAdmin(null);
    } catch (err) {
      console.error('Cancel failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isCurrentAdmin = userAddr === currentAdmin;
  const isPendingAdmin = userAddr === pendingAdmin;

  return (
    <div className="p-6 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Admin Handover</h3>

      <div className="mb-4 p-3 bg-blue-50 rounded">
        <p className="text-sm">Current Admin: <span className="font-mono">{currentAdmin.slice(0, 8)}...</span></p>
      </div>

      {pendingAdmin && (
        <div className="mb-4 p-3 bg-yellow-50 rounded border border-yellow-200">
          <p className="text-sm">Pending Admin: <span className="font-mono">{pendingAdmin.slice(0, 8)}...</span></p>
        </div>
      )}

      {/* Propose new admin - only current admin */}
      {isCurrentAdmin && !pendingAdmin && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="New admin address"
            value={proposedAddr}
            onChange={(e) => setProposedAddr(e.target.value)}
            className="w-full px-3 py-2 mb-2 border rounded"
          />
          <button
            onClick={handlePropose}
            disabled={isLoading || !proposedAddr}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {isLoading ? 'Proposing...' : 'Propose New Admin'}
          </button>
        </div>
      )}

      {/* Cancel proposal - only current admin */}
      {isCurrentAdmin && pendingAdmin && (
        <button
          onClick={handleCancel}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
        >
          {isLoading ? 'Cancelling...' : 'Cancel Proposal'}
        </button>
      )}

      {/* Accept proposal - only pending admin */}
      {isPendingAdmin && (
        <button
          onClick={handleAccept}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
        >
          {isLoading ? 'Accepting...' : 'Accept Admin Role'}
        </button>
      )}
    </div>
  );
};
