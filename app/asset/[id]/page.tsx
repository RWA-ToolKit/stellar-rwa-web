import type { Metadata } from "next";
import Link from "next/link";
import { AssetDetailView } from "@/components/asset/AssetDetailView";

interface PageProps {
  params: { id: string };
}

export function generateMetadata({ params }: PageProps): Metadata {
  return {
    title: `Asset #${params.id}`,
    description: `Details, holders and dividend history for tokenized asset #${params.id} on Stellar.`,
  };
}

function parseId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    const v = BigInt(raw);
    return v >= 0n ? v : null;
  } catch {
    return null;
  }
}

export default function AssetPage({ params }: PageProps) {
  const id = parseId(params.id);

  if (id === null) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-base-100">Invalid asset id</h1>
        <p className="mt-2 text-base-100/50">“{params.id}” is not a valid asset id.</p>
        <Link href="/explore" className="btn-secondary mt-6">← Back to Explore</Link>
      </div>
    );
  }

  // Pass the id across the server/client boundary as a string — bigint
  // serialization across RSC props is fragile and version-dependent in
  // Next.js. AssetDetailView converts it back to bigint on the client.
  return <AssetDetailView id={id.toString()} />;
}
