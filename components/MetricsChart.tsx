"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

export default function MetricsChart({
  data,
}: {
  data: { date: string; clicks: number; impressions: number }[];
}) {
  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(d: string) => d.slice(5)}
          />
          <YAxis yAxisId="l" tick={{ fontSize: 11 }} width={44} />
          <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} width={52} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="l"
            type="monotone"
            dataKey="clicks"
            name="クリック"
            stroke="#d97706"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="r"
            type="monotone"
            dataKey="impressions"
            name="表示回数"
            stroke="#9ca3af"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
