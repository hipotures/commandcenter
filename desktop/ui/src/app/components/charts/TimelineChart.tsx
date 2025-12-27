/**
 * Timeline AreaChart - shows token usage over time
 */
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TimelineData {
  period: string;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
  messages: number;
  cost: number;
}

interface Props {
  data: TimelineData[];
  granularity: 'month' | 'week' | 'day';
}

export function TimelineChart({ data, granularity }: Props) {
  const formatXAxis = (value: string) => {
    if (granularity === 'month') return value; // YYYY-MM
    if (granularity === 'week') return value.split('-W')[1]; // Week number
    return value.split('-').slice(1).join('/'); // MM/DD
  };

  const formatTokens = (value: number) => {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
          </linearGradient>
          <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="period"
          tickFormatter={formatXAxis}
          stroke="var(--color-text-muted)"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          tickFormatter={formatTokens}
          stroke="var(--color-text-muted)"
          style={{ fontSize: '12px' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '12px',
          }}
          formatter={(value) => [value ? formatTokens(Number(value)) : '0', '']}
        />
        <Area
          type="monotone"
          dataKey="input_tokens"
          stackId="1"
          stroke="#3b82f6"
          fillOpacity={1}
          fill="url(#colorInput)"
          name="Input"
        />
        <Area
          type="monotone"
          dataKey="output_tokens"
          stackId="1"
          stroke="#8b5cf6"
          fillOpacity={1}
          fill="url(#colorOutput)"
          name="Output"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
