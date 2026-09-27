import dynamic from "next/dynamic";
import type { ComponentType } from "react";

// recharts' bundled type defs declare `defaultProps` with widened primitive
// types (e.g. `layout: string` instead of a literal union) that no longer
// satisfy React's ComponentClass shape under the current @types/react. That's
// a type-only mismatch in a third-party package, not a real runtime issue, so
// every recharts component is cast through `ComponentType<any>` to unblock
// `next/dynamic`'s inference.
const asComponent = (c: unknown) => c as ComponentType<any>;

const rechartsComponents = {
  LineChart: dynamic(() => import("recharts").then((mod) => ({ default: asComponent(mod.LineChart) })), {
    ssr: false,
  }),
  BarChart: dynamic(() => import("recharts").then((mod) => ({ default: asComponent(mod.BarChart) })), {
    ssr: false,
  }),
  AreaChart: dynamic(() => import("recharts").then((mod) => ({ default: asComponent(mod.AreaChart) })), {
    ssr: false,
  }),
  PieChart: dynamic(() => import("recharts").then((mod) => ({ default: asComponent(mod.PieChart) })), {
    ssr: false,
  }),
  CartesianGrid: dynamic(
    () => import("recharts").then((mod) => ({ default: asComponent(mod.CartesianGrid) })),
    { ssr: false },
  ),
  XAxis: dynamic(() => import("recharts").then((mod) => ({ default: asComponent(mod.XAxis) })), {
    ssr: false,
  }),
  YAxis: dynamic(() => import("recharts").then((mod) => ({ default: asComponent(mod.YAxis) })), {
    ssr: false,
  }),
  Tooltip: dynamic(() => import("recharts").then((mod) => ({ default: asComponent(mod.Tooltip) })), {
    ssr: false,
  }),
  Legend: dynamic(() => import("recharts").then((mod) => ({ default: asComponent(mod.Legend) })), {
    ssr: false,
  }),
  Line: dynamic(() => import("recharts").then((mod) => ({ default: asComponent(mod.Line) })), {
    ssr: false,
  }),
  Bar: dynamic(() => import("recharts").then((mod) => ({ default: asComponent(mod.Bar) })), {
    ssr: false,
  }),
  Area: dynamic(() => import("recharts").then((mod) => ({ default: asComponent(mod.Area) })), {
    ssr: false,
  }),
  Pie: dynamic(() => import("recharts").then((mod) => ({ default: asComponent(mod.Pie) })), {
    ssr: false,
  }),
  Cell: dynamic(() => import("recharts").then((mod) => ({ default: asComponent(mod.Cell) })), {
    ssr: false,
  }),
  ResponsiveContainer: dynamic(
    () => import("recharts").then((mod) => ({ default: asComponent(mod.ResponsiveContainer) })),
    { ssr: false },
  ),
};

export default rechartsComponents;
