/**
 * Hourly BarChart - shows 24-hour activity profile
 */
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface HourlyData {
  hour: number;
  messages: number;
  tokens: number;
  input_tokens: number;
  output_tokens: number;
}

interface Props {
  data: HourlyData[];
}

export function HourlyChart({ data }: Props) {
  const formatTokens = (value: number) => {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="hour"
          tickFormatter={(hour) => `${hour}:00`}
          stroke="var(--color-text-muted)"
          style={{ fontSize: '11px' }}
        />
        <YAxis
          tickFormatter={formatTokens}
          stroke="var(--color-text-muted)"
          style={{ fontSize: '11px' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '12px',
          }}
          formatter={(value, name) => [
            value ? (name === 'messages' ? value : formatTokens(Number(value))) : '0',
            name === 'messages' ? 'Messages' : 'Tokens',
          ]}
        />
        <Bar dataKey="messages" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
