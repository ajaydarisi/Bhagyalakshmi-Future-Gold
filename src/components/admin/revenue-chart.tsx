"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatPrice } from "@/lib/formatters";
import { useIsMobile } from "@/hooks/use-mobile";

interface RevenueChartProps {
  data: { date: string; revenue: number }[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  const isMobile = useIsMobile();

  return (
    <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="5%"
              stopColor="var(--gold-500)"
              stopOpacity={0.3}
            />
            <stop
              offset="95%"
              stopColor="var(--gold-500)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: isMobile ? 10 : 12 }}
          tickFormatter={(value: string) => {
            const d = new Date(value);
            return `${d.getDate()}/${d.getMonth() + 1}`;
          }}
          className="text-muted-foreground"
        />
        <YAxis
          tick={{ fontSize: isMobile ? 10 : 12 }}
          tickFormatter={(value: number) =>
            isMobile ? `${Math.round(value / 1000)}k` : formatPrice(value)
          }
          className="text-muted-foreground"
          width={isMobile ? 40 : 80}
        />
        <Tooltip
          formatter={(value: number | undefined) => [formatPrice(value ?? 0), "Revenue"]}
          labelFormatter={(label) =>
            new Date(label).toLocaleDateString("en-IN", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          }
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--card))",
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--gold-500)"
          fillOpacity={1}
          fill="url(#revenueGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
