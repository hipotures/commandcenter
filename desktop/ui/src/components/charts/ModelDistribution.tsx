import { useState } from 'react';
import { Cpu } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { ModelDistributionProps } from '../../types/dashboard';
import { formatCurrency, formatNumber } from '../../lib/format';
import { tokens } from '../../styles/tokens';
import { EmptyState } from '../feedback/EmptyState';

export function ModelDistribution({ data, isExporting = false }: ModelDistributionProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const safeData = Array.isArray(data) ? data : [];
  const hasData = safeData.length > 0;

  const chartColors = [
    tokens.colors.accentPrimary,
    tokens.colors.accentSecondary,
    tokens.colors.heatmap[4],
  ];

  const totalTokens = safeData.reduce((sum, model) => sum + model.tokens, 0);
  const chartData: Array<Record<string, number | string>> = safeData.map((item) => ({ ...item }));

  return (
    <div
      style={{
        background: tokens.colors.surface,
        border: `1px solid ${tokens.colors.surfaceBorder}`,
        borderRadius: '16px',
        padding: '24px',
        boxShadow: tokens.shadows.md,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px',
          color: tokens.colors.textPrimary,
          fontSize: '16px',
          fontWeight: '600',
        }}
      >
        <Cpu size={20} style={{ color: tokens.colors.accentPrimary }} />
        Model Distribution
      </div>

      <div style={{ height: '160px' }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="tokens"
                nameKey="displayName"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={3}
                onMouseEnter={(_, idx) => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                {safeData.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={chartColors[idx]}
                    style={{
                      filter: activeIndex === idx ? 'brightness(1.1)' : 'none',
                      transform: activeIndex === idx ? 'scale(1.05)' : 'scale(1)',
                      transformOrigin: 'center',
                      transition: 'all 0.2s ease',
                    }}
                  />
                ))}
              </Pie>
              {!isExporting && (
                <Tooltip
                  content={({ payload }) => {
                    if (!payload || !payload[0]) return null;
                    const item = payload[0].payload as (typeof safeData)[number];
                    return (
                      <div
                        style={{
                          background: tokens.colors.textPrimary,
                          color: tokens.colors.surface,
                          padding: '12px 16px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          boxShadow: tokens.shadows.lg,
                        }}
                      >
                        <div style={{ fontWeight: '600', marginBottom: '4px' }}>{item.displayName}</div>
                        <div>{formatNumber(item.tokens)} tokens</div>
                        <div style={{ color: tokens.colors.heatmap[2] }}>{formatCurrency(item.cost)}</div>
                      </div>
                    );
                  }}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="No model data for this range" />
        )}
      </div>

      <div
        style={{
          marginTop: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
        }}
      >
        {safeData.map((model, idx) => (
          <div
            key={model.model}
            onMouseEnter={() => setActiveIndex(idx)}
            onMouseLeave={() => setActiveIndex(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: '8px',
              background: activeIndex === idx ? tokens.colors.surface : tokens.colors.background,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: `1px solid ${activeIndex === idx ? tokens.colors.accentPrimary : 'transparent'}`,
              flexWrap: 'nowrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap' }}>
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '4px',
                  backgroundColor: chartColors[idx % chartColors.length],
                }}
              />
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: '500',
                  color: tokens.colors.textSecondary,
                  whiteSpace: 'nowrap',
                }}
              >
                {model.displayName}
              </span>
            </div>
            <div
              style={{
                textAlign: 'right',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: tokens.colors.accentPrimary,
                  whiteSpace: 'nowrap',
                }}
              >
                {(totalTokens > 0 ? (model.tokens / totalTokens) * 100 : 0).toFixed(1)}%
              </div>
              <div style={{ fontSize: '10px', color: tokens.colors.textMuted, whiteSpace: 'nowrap' }}>
                {formatNumber(model.tokens)} tok
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
