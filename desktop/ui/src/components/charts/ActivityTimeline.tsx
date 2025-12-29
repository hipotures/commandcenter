import { useEffect, useMemo, useRef, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ActivityTimelineProps } from '../../types/dashboard';
import { formatCurrency, formatNumber } from '../../lib/format';
import { buildTicks, chooseTickStep, parsePeriodToTimestamp, toGranularityTimestamp } from '../../lib/charts';
import { startOfDay } from '../../lib/date';
import { tokens } from '../../styles/tokens';
import { EmptyState } from '../feedback/EmptyState';

const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' });
const dayFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

type TimeTickProps = {
  x?: number;
  y?: number;
  payload?: { value: number };
  showDateFor?: Set<number>;
  granularity: ActivityTimelineProps['granularity'];
  tickCount?: number;
  index?: number;
};

function TimeTick({
  x = 0,
  y = 0,
  payload,
  showDateFor,
  granularity,
  tickCount,
  index,
}: TimeTickProps) {
  const value = payload?.value;
  if (typeof value !== 'number') {
    return null;
  }

  const date = new Date(value);
  let textAnchor: 'start' | 'middle' | 'end' = 'middle';
  if (typeof index === 'number' && typeof tickCount === 'number' && tickCount > 1) {
    if (index === 0) {
      textAnchor = 'start';
    } else if (index === tickCount - 1) {
      textAnchor = 'end';
    }
  }

  if (granularity === 'hour') {
    const dayKey = startOfDay(value);
    const showDate = showDateFor?.has(dayKey);
    return (
      <g transform={`translate(${x},${y})`}>
        <text textAnchor={textAnchor} dy={12} fontSize={11} fill={tokens.colors.textMuted}>
          <tspan x={0}>{timeFormatter.format(date)}</tspan>
          {showDate && <tspan x={0} dy={14}>{dayFormatter.format(date)}</tspan>}
        </text>
      </g>
    );
  }

  const label = granularity === 'month' ? monthFormatter.format(date) : dayFormatter.format(date);

  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor={textAnchor} dy={12} fontSize={11} fill={tokens.colors.textMuted}>
        {label}
      </text>
    </g>
  );
}

type ChartDatum = ActivityTimelineProps['data'][number] & { ts: number };

export function ActivityTimeline({
  data,
  granularity,
  limitResets,
  isExporting = false,
}: ActivityTimelineProps) {
  const [metric, setMetric] = useState<'messages' | 'tokens' | 'cost'>('messages');
  const [selectedLimitTypes, setSelectedLimitTypes] = useState<Set<string>>(new Set());
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const safeData = Array.isArray(data) ? data : [];
  const chartData = useMemo(() => {
    return safeData
      .map((item) => {
        const ts = parsePeriodToTimestamp(item.period, granularity);
        if (ts === null) {
          return null;
        }
        return { ...item, ts };
      })
      .filter((item): item is ChartDatum => item !== null)
      .sort((a, b) => a.ts - b.ts);
  }, [safeData, granularity]);
  const hasData = chartData.length > 0;
  const chartMargin = { top: 10, right: 30, left: 0, bottom: granularity === 'hour' ? 28 : 8 };

  useEffect(() => {
    if (!chartContainerRef.current) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setChartWidth(entry.contentRect.width);
      }
    });

    observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const { ticks, showDateFor, minTs, maxTs } = useMemo(() => {
    if (!chartData.length) {
      return { ticks: [], showDateFor: new Set<number>(), minTs: 0, maxTs: 0 };
    }

    const min = chartData[0].ts;
    const max = chartData[chartData.length - 1].ts;
    const step = chooseTickStep(max - min);
    const baseTicks = buildTicks(min, max, step);
    const targetLabelWidth = granularity === 'hour' ? 96 : 72;
    const maxTicks = chartWidth > 0 ? Math.max(2, Math.floor(chartWidth / targetLabelWidth)) : baseTicks.length;
    const stride = baseTicks.length > maxTicks ? Math.ceil(baseTicks.length / maxTicks) : 1;
    const ticks = baseTicks.filter((_, idx) => idx % stride === 0);
    if (ticks[0] !== baseTicks[0]) {
      ticks.unshift(baseTicks[0]);
    }
    if (ticks[ticks.length - 1] !== baseTicks[baseTicks.length - 1]) {
      ticks.push(baseTicks[baseTicks.length - 1]);
    }

    const showDateFor = new Set<number>();
    let lastDay: number | null = null;
    for (const tick of ticks) {
      const dayKey = startOfDay(tick);
      if (dayKey !== lastDay) {
        showDateFor.add(dayKey);
        lastDay = dayKey;
      }
    }

    return { ticks, showDateFor, minTs: min, maxTs: max };
  }, [chartData, chartWidth, granularity]);

  const metrics = [
    { key: 'messages', label: 'Messages', color: tokens.colors.accentPrimary },
    { key: 'tokens', label: 'Tokens', color: tokens.colors.heatmap[5] },
    { key: 'cost', label: 'Cost', color: tokens.colors.semanticSuccess },
  ] as const;

  const limitTypes = [
    { type: '5-hour', color: '#F59E0B', label: '5-Hour Limit' },
    { type: 'session', color: '#EF4444', label: 'Session Limit' },
    { type: 'spending_cap', color: '#DC2626', label: 'Spending Cap' },
    { type: 'context', color: '#7C3AED', label: 'Context Limit' },
  ];

  const toggleLimitType = (type: string) => {
    setSelectedLimitTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (!hasData && selectedLimitTypes.size > 0) {
      setSelectedLimitTypes(new Set());
    }
  }, [hasData, selectedLimitTypes.size]);

  const formatTooltipLabel = (value: number) => {
    if (!Number.isFinite(value)) {
      return '';
    }
    const date = new Date(value);
    if (granularity === 'month') {
      return monthFormatter.format(date);
    }
    if (granularity === 'week' || granularity === 'day') {
      return dayFormatter.format(date);
    }
    return dateTimeFormatter.format(date);
  };

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
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: tokens.colors.textPrimary,
            fontSize: '16px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            minWidth: 'max-content',
          }}
        >
          <TrendingUp size={20} style={{ color: tokens.colors.accentPrimary }} />
          Activity Timeline
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {metrics.map((metricOption) => (
            <button
              key={metricOption.key}
              onClick={() => setMetric(metricOption.key)}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                border: 'none',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: metric === metricOption.key ? tokens.colors.accentPrimary : 'transparent',
                color: metric === metricOption.key ? tokens.colors.surface : tokens.colors.textMuted,
              }}
            >
              {metricOption.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        <div ref={chartContainerRef} style={{ flex: 1, height: '280px', minWidth: 0 }}>
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={chartMargin}>
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={tokens.colors.accentPrimary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={tokens.colors.accentPrimary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.colors.surfaceBorder} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={[minTs, maxTs]}
                  ticks={ticks}
                  axisLine={false}
                  tickLine={false}
                  tick={(props) => (
                    <TimeTick
                      {...props}
                      granularity={granularity}
                      showDateFor={showDateFor}
                      tickCount={ticks.length}
                    />
                  )}
                  interval={0}
                  minTickGap={24}
                  height={granularity === 'hour' ? 52 : 36}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: tokens.colors.textMuted, fontSize: 12 }}
                  tickFormatter={(val) => formatNumber(val)}
                />
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
                    labelFormatter={(value) => formatTooltipLabel(Number(value))}
                    formatter={(value) => {
                      const numeric = typeof value === 'number' ? value : Number(value ?? 0);
                      const label = metrics.find((m) => m.key === metric)?.label ?? '';
                      return [metric === 'cost' ? formatCurrency(numeric) : formatNumber(numeric), label];
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke={tokens.colors.accentPrimary}
                  strokeWidth={3}
                  fill="url(#colorGradient)"
                  dot={{ fill: tokens.colors.accentPrimary, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: tokens.colors.accentPrimary, stroke: tokens.colors.surface, strokeWidth: 2 }}
                />

                {limitResets
                  .filter((reset) => selectedLimitTypes.has(reset.limit_type))
                  .map((reset, idx) => {
                    const resetDate = new Date(reset.reset_at);
                    const xValue = toGranularityTimestamp(resetDate, granularity);
                    if (Number.isNaN(xValue)) {
                      return null;
                    }

                    const colors = {
                      '5-hour': '#F59E0B',
                      session: '#EF4444',
                      spending_cap: '#DC2626',
                      context: '#7C3AED',
                    };

                    return (
                      <ReferenceLine
                        key={`limit-${idx}`}
                        x={xValue}
                        stroke={colors[reset.limit_type] || '#94A3B8'}
                        strokeWidth={2}
                        strokeDasharray="5 5"
                      />
                    );
                  })}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState message="No activity in this range" />
          )}
        </div>

        <div
          style={{
            width: 'max-content',
            minWidth: 'max-content',
            maxWidth: '220px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: '600',
              color: tokens.colors.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '4px',
            }}
          >
            Limit Types
          </div>
          {limitTypes.map((limit) => {
            const hasLimitData = hasData && limitResets.some((reset) => reset.limit_type === limit.type);
            const isSelected = selectedLimitTypes.has(limit.type);
            return (
              <label
                key={limit.type}
                title={!hasData ? 'No data in this range' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  background: tokens.colors.background,
                  opacity: hasLimitData ? 1 : 0.4,
                  cursor: hasLimitData ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s ease',
                  width: '100%',
                }}
              >
                <input
                  type="checkbox"
                  className="limit-checkbox"
                  checked={isSelected}
                  onChange={() => hasLimitData && toggleLimitType(limit.type)}
                  disabled={!hasLimitData}
                  title={!hasData ? 'No data in this range' : undefined}
                  style={{
                    cursor: hasLimitData ? 'pointer' : 'not-allowed',
                    width: '14px',
                    height: '14px',
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    width: '20px',
                    height: '2px',
                    background: limit.color,
                    borderRadius: '1px',
                    position: 'relative',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '-1px',
                      left: 0,
                      right: 0,
                      height: '4px',
                      background: `repeating-linear-gradient(90deg, ${limit.color} 0px, ${limit.color} 5px, transparent 5px, transparent 10px)`,
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    color: tokens.colors.textSecondary,
                    fontWeight: '500',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {limit.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
