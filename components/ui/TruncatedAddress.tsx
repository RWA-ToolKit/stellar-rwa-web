"use client";

import { truncateAddress } from "@/lib/format";
import { CopyButton } from "./CopyButton";

interface TruncatedAddressProps {
  address: string;
  lead?: number;
  tail?: number;
  className?: string;
}

export function TruncatedAddress({
  address,
  lead = 4,
  tail = 4,
  className = "",
}: TruncatedAddressProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs ${className}`}>
      <span>{truncateAddress(address, lead, tail)}</span>
      <CopyButton value={address} />
    </span>
  );
}
