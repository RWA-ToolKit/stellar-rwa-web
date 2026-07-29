"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AssetDetail } from "@/types";
import { formatTokenAmount } from "@/lib/format";

interface AssetStatsChartProps {
  asset: AssetDetail;
  holders?: number;
}

const COLORS = ["#6366f1", "#22d3ee"];

/**
 * Small donut chart visualizing circulating supply vs. an illustrative
 * "unclaimed" remainder derived from holder count. Rendered client-side only
 * (see AssetStats.tsx) since recharts pulls in a sizeable dependency tree
 * that shouldn't block first paint on asset pages.
 */
export function AssetStatsChart({ asset, holders }: AssetStatsChartProps) {
  const { metadata } = asset;
  const supply = Number(formatTokenAmount(metadata.totalSupply, metadata.decimals).replace(/,/g, ""));

  if (!Number.isFinite(supply) || supply <= 0) {
    return null;
  }

  const data = [
    { name: "Circulating supply", value: supply },
    { name: "Holders", value: holders ?? 0 },
  ];

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={40}
            outerRadius={60}
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#0f1115",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
