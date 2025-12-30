import { Calendar, Zap } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DailyPatternsProps } from '../../types/dashboard';
import { tokens } from '../../styles/tokens';
import { EmptyState } from '../feedback/EmptyState';

export function DailyPatterns({ data, isExporting = false }: DailyPatternsProps) {
  const safeData = Array.isArray(data) ? data : [];
  const hasData = safeData.length > 0;
  const peakDay = hasData
    ? safeData.reduce((max, curr) => (curr.activity > max.activity ? curr : max), safeData[0])
    : { day: '--', activity: 0 };

  return (
    <div
      style={{
        background: tokens.colors.surface,
        border: `1px solid ${tokens.colors.surfaceBorder}`,
        borderRadius: '16px',
        padding: '24px',
        filter: tokens.shadows.dropMd,
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
        <Calendar size={20} style={{ color: tokens.colors.accentPrimary }} />
        Daily Patterns
      </div>

      <div style={{ height: '200px' }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={safeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.colors.surfaceBorder} vertical={false} />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: tokens.colors.textMuted, fontSize: 10 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: tokens.colors.textMuted, fontSize: 10 }} />
              {!isExporting && (
                <Tooltip
                  contentStyle={{
                    background: tokens.colors.textPrimary,
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: tokens.shadows.lg,
                  }}
                  labelStyle={{ color: tokens.colors.surface, fontWeight: '600' }}
                  itemStyle={{ color: tokens.colors.heatmap[2] }}
                  formatter={(value) => {
                    const numeric = typeof value === 'number' ? value : Number(value ?? 0);
                    return [`${numeric} messages`, 'Activity'];
                  }}
                />
              )}
              <Bar dataKey="activity" fill={tokens.colors.accentPrimary} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="No daily activity in this range" />
        )}
      </div>

      {hasData && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '16px',
            padding: '12px',
            background: 'var(--color-accent-primary-10)',
            borderRadius: '8px',
            flexWrap: 'nowrap',
          }}
        >
          <Zap size={16} style={{ color: tokens.colors.accentPrimary }} />
          <span style={{ fontSize: '13px', color: tokens.colors.textSecondary, whiteSpace: 'nowrap' }}>
            Most active day: <strong>{peakDay.day}</strong> ({peakDay.activity} avg messages)
          </span>
        </div>
      )}
    </div>
  );
}
