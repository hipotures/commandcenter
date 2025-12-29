/**
 * Model Distribution Pie Chart
 */
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ModelData {
  model: string;
  display_name: string;
  tokens: number;
  percent: number;
  messages: number;
  cost: number;
}

interface Props {
  data: ModelData[];
  onModelClick?: (model: string) => void;
}

const COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#ec4899', // pink
];

export function ModelPieChart({ data, onModelClick }: Props) {
  const formatTokens = (value: number) => {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toString();
  };

  const topModels = data.slice(0, 7);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={topModels as any}
          dataKey="tokens"
          nameKey="display_name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label={(entry) => `${entry.percent}%`}
          onClick={(data) => onModelClick?.(data.model)}
          style={{ cursor: onModelClick ? 'pointer' : 'default' }}
        >
          {topModels.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '12px',
          }}
          formatter={(value) => value ? formatTokens(Number(value)) : '0'}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          formatter={(value) => (
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
