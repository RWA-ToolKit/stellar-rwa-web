import dynamic from "next/dynamic";

const rechartsComponents = {
  LineChart: dynamic(() => import("recharts").then((mod) => ({ default: mod.LineChart })), {
    ssr: false,
  }),
  BarChart: dynamic(() => import("recharts").then((mod) => ({ default: mod.BarChart })), {
    ssr: false,
  }),
  AreaChart: dynamic(() => import("recharts").then((mod) => ({ default: mod.AreaChart })), {
    ssr: false,
  }),
  PieChart: dynamic(() => import("recharts").then((mod) => ({ default: mod.PieChart })), {
    ssr: false,
  }),
  CartesianGrid: dynamic(
    () => import("recharts").then((mod) => ({ default: mod.CartesianGrid })),
    { ssr: false },
  ),
  XAxis: dynamic(() => import("recharts").then((mod) => ({ default: mod.XAxis })), {
    ssr: false,
  }),
  YAxis: dynamic(() => import("recharts").then((mod) => ({ default: mod.YAxis })), {
    ssr: false,
  }),
  Tooltip: dynamic(() => import("recharts").then((mod) => ({ default: mod.Tooltip })), {
    ssr: false,
  }),
  Legend: dynamic(() => import("recharts").then((mod) => ({ default: mod.Legend })), {
    ssr: false,
  }),
  Line: dynamic(() => import("recharts").then((mod) => ({ default: mod.Line })), {
    ssr: false,
  }),
  Bar: dynamic(() => import("recharts").then((mod) => ({ default: mod.Bar })), {
    ssr: false,
  }),
  Area: dynamic(() => import("recharts").then((mod) => ({ default: mod.Area })), {
    ssr: false,
  }),
  Pie: dynamic(() => import("recharts").then((mod) => ({ default: mod.Pie })), {
    ssr: false,
  }),
  Cell: dynamic(() => import("recharts").then((mod) => ({ default: mod.Cell })), {
    ssr: false,
  }),
  ResponsiveContainer: dynamic(
    () => import("recharts").then((mod) => ({ default: mod.ResponsiveContainer })),
    { ssr: false },
  ),
};

export default rechartsComponents;
