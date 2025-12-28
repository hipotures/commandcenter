import { useEffect, useState, useMemo, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './datepicker-custom.css';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  MessageSquare, Users, Coins, Zap, Flame, Database,
  Calendar, TrendingUp, Clock, Cpu, ChevronDown, Download,
  RefreshCw, Settings, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useDashboard, useLimitResets, useProjects } from './state/queries';
import { SettingsDrawer } from './components/drawers/SettingsDrawer';
import { ProjectSelector } from './components/ProjectSelector';
import { useAppStore } from './state/store';

// ═══════════════════════════════════════════════════════════════════════════════
// CLAUDE CODE DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════════
const tokens = {
  colors: {
    background: 'var(--color-background)',
    surface: 'var(--color-surface)',
    surfaceBorder: 'var(--color-border)',
    textPrimary: 'var(--color-text-primary)',
    textSecondary: 'var(--color-text-secondary)',
    textTertiary: 'var(--color-text-tertiary)',
    textMuted: 'var(--color-text-muted)',
    accentPrimary: 'var(--color-accent-primary)',
    accentSecondary: 'var(--color-accent-hover)',
    semanticSuccess: 'var(--color-success)',
    semanticWarning: 'var(--color-warning)',
    semanticError: 'var(--color-error)',
    heatmap: [
      'var(--color-heatmap-0)',
      'var(--color-heatmap-1)',
      'var(--color-heatmap-2)',
      'var(--color-heatmap-3)',
      'var(--color-heatmap-4)',
      'var(--color-heatmap-5)',
      'var(--color-heatmap-6)',
    ],
  },
  shadows: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
  }
};

// Query Client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      staleTime: 30_000,
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
const formatNumber = (num: number): string => {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toLocaleString();
};

const formatCurrency = (num: number): string => {
  return '$' + num.toFixed(2);
};

const getProjectDisplayName = (project: { name?: string | null; project_id: string }): string => {
  if (project.name) return project.name;
  const parts = project.project_id.split('-').filter(Boolean);
  return parts[parts.length - 1] || project.project_id;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const chooseTickStep = (rangeMs: number): number => {
  if (rangeMs <= 0) {
    return DAY_MS;
  }
  if (rangeMs <= 2 * DAY_MS) {
    return 4 * HOUR_MS;
  }
  if (rangeMs <= 14 * DAY_MS) {
    return DAY_MS;
  }
  if (rangeMs <= 90 * DAY_MS) {
    return 7 * DAY_MS;
  }
  return 30 * DAY_MS;
};

const buildTicks = (min: number, max: number, step: number): number[] => {
  if (step <= 0 || min === max) {
    return [min];
  }

  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let t = first; t <= max; t += step) {
    ticks.push(t);
  }

  if (ticks.length === 0) {
    return [min, max].filter((value, index, arr) => arr.indexOf(value) === index);
  }

  return ticks;
};

const startOfDay = (ts: number): number => {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const parseWeekStart = (year: number, week: number): number => {
  const jan1 = new Date(year, 0, 1);
  const jan1Day = jan1.getDay();
  const firstMondayOffset = (8 - jan1Day) % 7;
  const firstMonday = new Date(year, 0, 1 + firstMondayOffset);

  if (week <= 0) {
    return jan1.getTime();
  }

  const target = new Date(firstMonday);
  target.setDate(firstMonday.getDate() + (week - 1) * 7);
  return target.getTime();
};

const parsePeriodToTimestamp = (
  period: string,
  granularity: 'hour' | 'day' | 'week' | 'month'
): number | null => {
  if (!period) {
    return null;
  }

  if (granularity === 'hour') {
    const [datePart, hourPart] = period.split(' ');
    if (!datePart || hourPart === undefined) {
      return null;
    }
    return new Date(`${datePart}T${hourPart.padStart(2, '0')}:00:00`).getTime();
  }

  if (granularity === 'day') {
    return new Date(`${period}T00:00:00`).getTime();
  }

  if (granularity === 'week') {
    const [yearStr, weekStr] = period.split('-W');
    const year = Number(yearStr);
    const week = Number(weekStr);
    if (Number.isNaN(year) || Number.isNaN(week)) {
      return null;
    }
    return parseWeekStart(year, week);
  }

  const [yearStr, monthStr] = period.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (Number.isNaN(year) || Number.isNaN(month)) {
    return null;
  }
  return new Date(year, month - 1, 1).getTime();
};

const startOfWeek = (date: Date): Date => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = (day + 6) % 7;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

const toGranularityTimestamp = (
  date: Date,
  granularity: 'hour' | 'day' | 'week' | 'month'
): number => {
  const result = new Date(date);

  if (granularity === 'hour') {
    result.setMinutes(0, 0, 0);
    return result.getTime();
  }
  if (granularity === 'day') {
    result.setHours(0, 0, 0, 0);
    return result.getTime();
  }
  if (granularity === 'week') {
    return startOfWeek(result).getTime();
  }

  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result.getTime();
};

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
  granularity: 'hour' | 'day' | 'week' | 'month';
  tickCount?: number;
  index?: number;
};

const TimeTick = ({
  x = 0,
  y = 0,
  payload,
  showDateFor,
  granularity,
  tickCount,
  index,
}: TimeTickProps) => {
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

  const label = granularity === 'month'
    ? monthFormatter.format(date)
    : dayFormatter.format(date);

  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor={textAnchor} dy={12} fontSize={11} fill={tokens.colors.textMuted}>
        {label}
      </text>
    </g>
  );
};

const EmptyChartState = ({ message }: { message: string }) => (
  <div style={{
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    fontSize: '12px',
    color: tokens.colors.textMuted,
    background: tokens.colors.background,
    borderRadius: '12px',
    border: `1px dashed ${tokens.colors.surfaceBorder}`,
    padding: '12px',
  }}>
    {message}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// KPI CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const KPICard = ({ title, value, subtitle, trend, icon: Icon, accentColor = tokens.colors.accentPrimary }: any) => (
  <div style={{
    background: tokens.colors.surface,
    border: `1px solid ${tokens.colors.surfaceBorder}`,
    borderRadius: '16px',
    padding: '24px',
    boxShadow: tokens.shadows.md,
    transition: 'all 0.3s ease',
    cursor: 'pointer',
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = tokens.shadows.lg;
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = tokens.shadows.md;
  }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        color: tokens.colors.textMuted,
        fontSize: '13px',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        <Icon size={16} />
        {title}
      </div>
      {trend !== undefined && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '12px',
          fontWeight: '600',
          color: trend >= 0 ? tokens.colors.semanticSuccess : tokens.colors.semanticError,
          background: trend >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          padding: '4px 8px',
          borderRadius: '20px',
        }}>
          {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <div style={{ 
      fontSize: '32px', 
      fontWeight: '700', 
      color: accentColor,
      fontFamily: "'DM Mono', 'SF Mono', monospace",
      letterSpacing: '-1px',
    }}>
      {value}
    </div>
    {subtitle && (
      <div style={{ 
        fontSize: '13px', 
        color: tokens.colors.textMuted,
        marginTop: '8px',
      }}>
        {subtitle}
      </div>
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY HEATMAP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const ActivityHeatmap = ({ data, dateFrom, dateTo }: any) => {
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const { weeks, maxCount } = useMemo(() => {
    // Always show full year - determine the year range from available data
    const allDates = Object.keys(data);
    if (allDates.length === 0) {
      return { weeks: [], maxCount: 1 };
    }

    // Get min/max dates from data
    const sortedDates = allDates.sort();
    const firstDate = new Date(sortedDates[0]);
    const lastDate = new Date(sortedDates[sortedDates.length - 1]);

    // Expand to show full year(s)
    const start = new Date(firstDate.getFullYear(), 0, 1);
    const end = new Date(lastDate.getFullYear(), 11, 31);

    // Fill in all dates in the year range
    const filledData: { [key: string]: number } = {};
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      filledData[dateStr] = data[dateStr] || 0;
    }

    const entries = Object.entries(filledData).sort(([a], [b]) => a.localeCompare(b));
    const max = Math.max(...Object.values(filledData).map((v: any) => v as number), 1); // At least 1 to avoid division by 0

    // Group into weeks - only create weeks that have actual data
    const weeksMap = new Map<string, any[]>();

    entries.forEach(([date, count]) => {
      const d = new Date(date);
      // Convert Sunday=0 to Monday=0 system (0=Mon, 1=Tue, ..., 6=Sun)
      const dayOfWeek = (d.getDay() + 6) % 7;

      // Calculate week key (Monday of that week)
      const monday = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek);
      const weekKey = monday.toISOString().split('T')[0];

      if (!weeksMap.has(weekKey)) {
        weeksMap.set(weekKey, []);
      }

      weeksMap.get(weekKey)!.push({ date, count, dayOfWeek });
    });

    // Convert map to array and sort by week start date
    const weeksArr = Array.from(weeksMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, week]) => week);

    return { weeks: weeksArr, maxCount: max };
  }, [data]);

  const getHeatLevel = (count: number) => {
    if (count === 0) return 0;
    const ratio = count / maxCount;
    if (ratio <= 0.1) return 1;
    if (ratio <= 0.25) return 2;
    if (ratio <= 0.4) return 3;
    if (ratio <= 0.6) return 4;
    if (ratio <= 0.8) return 5;
    return 6;
  };

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabelSlots = useMemo(() => {
    const labels: string[] = [];
    let lastMonth: number | null = null;
    let lastLabelIndex = -1000;
    const cellWidth = 14 + 3.3;
    const minPixelGap = 28;
    const minWeekGap = Math.ceil(minPixelGap / cellWidth);

    weeks.forEach((week, idx) => {
      if (week.length === 0) {
        labels[idx] = '';
        return;
      }
      const month = new Date(week[0].date).getMonth();
      const isMonthChange = lastMonth === null || month !== lastMonth;
      if (isMonthChange && idx - lastLabelIndex >= minWeekGap) {
        labels[idx] = monthLabels[month];
        lastLabelIndex = idx;
      } else {
        labels[idx] = '';
      }
      lastMonth = month;
    });

    return labels;
  }, [weeks]);

  return (
    <div style={{
      background: tokens.colors.surface,
      border: `1px solid ${tokens.colors.surfaceBorder}`,
      borderRadius: '16px',
      padding: '24px',
      boxShadow: tokens.shadows.md,
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        marginBottom: '20px',
        color: tokens.colors.textPrimary,
        fontSize: '16px',
        fontWeight: '600',
      }}>
        <Calendar size={20} style={{ color: tokens.colors.accentPrimary }} />
        Activity Heatmap
      </div>
      
      {/* Month labels */}
      <div style={{ display: 'flex', marginLeft: '36px', marginBottom: '8px', gap: '3.3px' }}>
        {weeks.map((week, idx) => (
          <div key={idx} style={{
            width: '14px',
            fontSize: '11px',
            color: tokens.colors.textMuted,
            fontWeight: '500',
            textAlign: 'left',
          }}>
            {week.length === 0 ? '' : monthLabelSlots[idx] || ''}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3.6px', marginRight: '8px' }}>
          {dayLabels.map((day) => (
            <div key={day} style={{
              height: '14px',
              fontSize: '10px',
              color: tokens.colors.textMuted,
              display: 'flex',
              alignItems: 'center',
              fontWeight: '500',
            }}>
              {day}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div style={{ display: 'flex', gap: '3.3px', position: 'relative' }}>
          {weeks.map((week, weekIdx) => {
            const isFirstWeek = weekIdx === 0;

            if (week.length === 0) return null;

            const minDayOfWeek = Math.min(...week.map((d: any) => d.dayOfWeek));

            return (
              <div key={weekIdx} style={{ display: 'flex', flexDirection: 'column', gap: '3.6px' }}>
                {/* For first week, add empty divs before first day for alignment */}
                {isFirstWeek && Array.from({ length: minDayOfWeek }, (_, idx) => (
                  <div key={`empty-${idx}`} style={{ width: '14px', height: '14px' }} />
                ))}

                {/* Render actual days */}
                {week.sort((a: any, b: any) => a.dayOfWeek - b.dayOfWeek).map((day: any) => {
                  const level = getHeatLevel(day.count);
                  const isInSelectedRange = day.date >= dateFrom && day.date <= dateTo;

                  return (
                    <div
                      key={day.date}
                      style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '3px',
                        backgroundColor: tokens.colors.heatmap[level],
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        transform: hoveredDay === day.date ? 'scale(1.3)' : 'scale(1)',
                        outline: isInSelectedRange ? '1px solid var(--color-accent-primary-80)' : 'none',
                        outlineOffset: '-1px',
                      }}
                      onMouseEnter={() => setHoveredDay(day.date)}
                      onMouseLeave={() => setHoveredDay(null)}
                    />
                  );
                })}
              </div>
            );
          })}
          
          {/* Tooltip */}
          {hoveredDay && (
            <div style={{
              position: 'absolute',
              top: '-45px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: tokens.colors.textPrimary,
              color: tokens.colors.surface,
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              zIndex: 10,
              boxShadow: tokens.shadows.lg,
            }}>
              {hoveredDay}: {data[hoveredDay] || 0} messages
            </div>
          )}
        </div>
      </div>
      
      {/* Legend */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '16px',
        marginLeft: '36px',
      }}>
        <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>Less</span>
        {tokens.colors.heatmap.map((color: string, idx: number) => (
          <div
            key={idx}
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '3px',
              backgroundColor: color,
            }}
          />
        ))}
        <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>More</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL DISTRIBUTION CHART
// ═══════════════════════════════════════════════════════════════════════════════
const ModelDistribution = ({ data }: any) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const safeData = Array.isArray(data) ? data : [];
  const hasData = safeData.length > 0;

  const chartColors = [
    tokens.colors.accentPrimary,
    tokens.colors.accentSecondary,
    tokens.colors.heatmap[4],
  ];

  const totalTokens = safeData.reduce((sum: number, m: any) => sum + m.tokens, 0);

  return (
    <div style={{
      background: tokens.colors.surface,
      border: `1px solid ${tokens.colors.surfaceBorder}`,
      borderRadius: '16px',
      padding: '24px',
      boxShadow: tokens.shadows.md,
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        marginBottom: '20px',
        color: tokens.colors.textPrimary,
        fontSize: '16px',
        fontWeight: '600',
      }}>
        <Cpu size={20} style={{ color: tokens.colors.accentPrimary }} />
        Model Distribution
      </div>
      
      <div style={{ height: '160px' }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={safeData}
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
                {safeData.map((_: any, idx: number) => (
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
              <Tooltip 
                content={({ payload }) => {
                  if (!payload || !payload[0]) return null;
                  const item = payload[0].payload;
                  return (
                    <div style={{
                      background: tokens.colors.textPrimary,
                      color: tokens.colors.surface,
                      padding: '12px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      boxShadow: tokens.shadows.lg,
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>{item.displayName}</div>
                      <div>{formatNumber(item.tokens)} tokens</div>
                      <div style={{ color: tokens.colors.heatmap[2] }}>{formatCurrency(item.cost)}</div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState message="No model data for this range" />
        )}
      </div>
      
      {/* Legend */}
      <div style={{
        marginTop: '16px',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
      }}>
        {safeData.map((model: any, idx: number) => (
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
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '4px',
                backgroundColor: chartColors[idx % chartColors.length],
              }} />
              <span style={{ fontSize: '13px', fontWeight: '500', color: tokens.colors.textSecondary }}>
                {model.displayName}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: tokens.colors.accentPrimary }}>
                {(totalTokens > 0 ? (model.tokens / totalTokens) * 100 : 0).toFixed(1)}%
              </div>
              <div style={{ fontSize: '10px', color: tokens.colors.textMuted }}>
                {formatNumber(model.tokens)} tok
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY TIMELINE CHART
// ═══════════════════════════════════════════════════════════════════════════════
const ActivityTimeline = ({ data, granularity, limitResets = [] }: any) => {
  const [metric, setMetric] = useState('messages');
  const [selectedLimitTypes, setSelectedLimitTypes] = useState<Set<string>>(new Set());
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const safeData = Array.isArray(data) ? data : [];
  const chartData = useMemo(() => {
    return safeData
      .map((item: any) => {
        const ts = parsePeriodToTimestamp(item.period, granularity);
        if (ts === null) {
          return null;
        }
        return { ...item, ts };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.ts - b.ts);
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
  ];

  const limitTypes = [
    { type: '5-hour', color: '#F59E0B', label: '5-Hour Limit' },
    { type: 'session', color: '#EF4444', label: 'Session Limit' },
    { type: 'spending_cap', color: '#DC2626', label: 'Spending Cap' },
    { type: 'context', color: '#7C3AED', label: 'Context Limit' },
  ];

  const toggleLimitType = (type: string) => {
    setSelectedLimitTypes(prev => {
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
    <div style={{
      background: tokens.colors.surface,
      border: `1px solid ${tokens.colors.surfaceBorder}`,
      borderRadius: '16px',
      padding: '24px',
      boxShadow: tokens.shadows.md,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: tokens.colors.textPrimary,
          fontSize: '16px',
          fontWeight: '600',
        }}>
          <TrendingUp size={20} style={{ color: tokens.colors.accentPrimary }} />
          Activity Timeline
        </div>

        {/* Metric selector */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {metrics.map(m => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              style={{
                padding: '6px 12px',
                borderRadius: '20px',
                border: 'none',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: metric === m.key ? tokens.colors.accentPrimary : 'transparent',
                color: metric === m.key ? tokens.colors.surface : tokens.colors.textMuted,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Chart */}
        <div ref={chartContainerRef} style={{ flex: 1, height: '280px', minWidth: 0 }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={chartMargin}>
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={tokens.colors.accentPrimary} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={tokens.colors.accentPrimary} stopOpacity={0}/>
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
              <Tooltip
                contentStyle={{
                  background: tokens.colors.textPrimary,
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: tokens.shadows.lg,
                }}
                labelStyle={{ color: tokens.colors.surface, fontWeight: '600' }}
                itemStyle={{ color: tokens.colors.heatmap[2] }}
                labelFormatter={(value: any) => formatTooltipLabel(Number(value))}
                formatter={(val: any) => [metric === 'cost' ? formatCurrency(val) : formatNumber(val), metrics.find(m => m.key === metric)?.label]}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke={tokens.colors.accentPrimary}
                strokeWidth={3}
                fill="url(#colorGradient)"
                dot={{ fill: tokens.colors.accentPrimary, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: tokens.colors.accentPrimary, stroke: tokens.colors.surface, strokeWidth: 2 }}
              />

              {/* Limit reset lines */}
              {limitResets.filter((reset: any) => selectedLimitTypes.has(reset.limit_type)).map((reset: any, idx: number) => {
                // Parse reset timestamp to match granularity format
                const resetDate = new Date(reset.reset_at);
                const xValue = toGranularityTimestamp(resetDate, granularity);
                if (Number.isNaN(xValue)) {
                  return null;
                }

                const colors = {
                  '5-hour': '#F59E0B',
                  'session': '#EF4444',
                  'spending_cap': '#DC2626',
                  'context': '#7C3AED'
                };

                return (
                  <ReferenceLine
                    key={`limit-${idx}`}
                    x={xValue}
                    stroke={colors[reset.limit_type as keyof typeof colors] || '#94A3B8'}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState message="No activity in this range" />
        )}
        </div>

        {/* Legend */}
        <div style={{
          width: '160px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: '600',
            color: tokens.colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '4px',
          }}>
            Limit Types
          </div>
          {limitTypes.map(limit => {
            // Check if this limit type exists in current data
            const hasLimitData = hasData && limitResets.some((r: any) => r.limit_type === limit.type);
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
                <div style={{
                  width: '20px',
                  height: '2px',
                  background: limit.color,
                  borderRadius: '1px',
                  position: 'relative',
                  flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '-1px',
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: `repeating-linear-gradient(90deg, ${limit.color} 0px, ${limit.color} 5px, transparent 5px, transparent 10px)`,
                  }} />
                </div>
                <span style={{
                  fontSize: '11px',
                  color: tokens.colors.textSecondary,
                  fontWeight: '500',
                  userSelect: 'none',
                }}>
                  {limit.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOURLY PATTERNS CHART
// ═══════════════════════════════════════════════════════════════════════════════
const HourlyPatterns = ({ data }: any) => {
  const safeData = Array.isArray(data) ? data : [];
  const hasData = safeData.length > 0;
  const peakHour = hasData
    ? safeData.reduce((max: any, curr: any) => curr.activity > max.activity ? curr : max, safeData[0])
    : { hour: '--:--', activity: 0 };

  return (
    <div style={{
      background: tokens.colors.surface,
      border: `1px solid ${tokens.colors.surfaceBorder}`,
      borderRadius: '16px',
      padding: '24px',
      boxShadow: tokens.shadows.md,
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        marginBottom: '20px',
        color: tokens.colors.textPrimary,
        fontSize: '16px',
        fontWeight: '600',
      }}>
        <Clock size={20} style={{ color: tokens.colors.accentPrimary }} />
        Hourly Patterns
      </div>
      
      <div style={{ height: '200px' }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={safeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.colors.surfaceBorder} vertical={false} />
              <XAxis 
                dataKey="hour"
                axisLine={false}
                tickLine={false}
                tick={{ fill: tokens.colors.textMuted, fontSize: 10 }}
                interval={2}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: tokens.colors.textMuted, fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  background: tokens.colors.textPrimary,
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: tokens.shadows.lg,
                }}
                labelStyle={{ color: tokens.colors.surface, fontWeight: '600' }}
                itemStyle={{ color: tokens.colors.heatmap[2] }}
                formatter={(val) => [val + ' messages', 'Activity']}
              />
              <Bar 
                dataKey="activity" 
                fill={tokens.colors.accentPrimary}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState message="No hourly activity in this range" />
        )}
      </div>
      
      {hasData && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '16px',
          padding: '12px',
          background: 'var(--color-accent-primary-10)',
          borderRadius: '8px',
        }}>
          <Zap size={16} style={{ color: tokens.colors.accentPrimary }} />
          <span style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>
            Peak activity: <strong>{peakHour.hour}</strong> ({peakHour.activity} avg messages)
          </span>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY PATTERNS CHART
// ═══════════════════════════════════════════════════════════════════════════════
const DailyPatterns = ({ data }: any) => {
  const safeData = Array.isArray(data) ? data : [];
  const hasData = safeData.length > 0;
  const peakDay = hasData
    ? safeData.reduce((max: any, curr: any) => curr.activity > max.activity ? curr : max, safeData[0])
    : { day: '--', activity: 0 };

  return (
    <div style={{
      background: tokens.colors.surface,
      border: `1px solid ${tokens.colors.surfaceBorder}`,
      borderRadius: '16px',
      padding: '24px',
      boxShadow: tokens.shadows.md,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '20px',
        color: tokens.colors.textPrimary,
        fontSize: '16px',
        fontWeight: '600',
      }}>
        <Calendar size={20} style={{ color: tokens.colors.accentPrimary }} />
        Daily Patterns
      </div>

      <div style={{ height: '200px' }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={safeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tokens.colors.surfaceBorder} vertical={false} />
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: tokens.colors.textMuted, fontSize: 10 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: tokens.colors.textMuted, fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  background: tokens.colors.textPrimary,
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: tokens.shadows.lg,
                }}
                labelStyle={{ color: tokens.colors.surface, fontWeight: '600' }}
                itemStyle={{ color: tokens.colors.heatmap[2] }}
                formatter={(val) => [val + ' messages', 'Activity']}
              />
              <Bar
                dataKey="activity"
                fill={tokens.colors.accentPrimary}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChartState message="No daily activity in this range" />
        )}
      </div>

      {hasData && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '16px',
          padding: '12px',
          background: 'var(--color-accent-primary-10)',
          borderRadius: '8px',
        }}>
          <Zap size={16} style={{ color: tokens.colors.accentPrimary }} />
          <span style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>
            Most active day: <strong>{peakDay.day}</strong> ({peakDay.activity} avg messages)
          </span>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE EFFICIENCY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const CacheEfficiency = ({ cacheRead, cacheWrite }: any) => {
  const [hoveredStat, setHoveredStat] = useState<'read' | 'write' | null>(null);
  const safeCacheRead = Number(cacheRead) || 0;
  const safeCacheWrite = Number(cacheWrite) || 0;
  const cacheTotal = safeCacheRead + safeCacheWrite;
  const hitRateValue = cacheTotal > 0 ? (safeCacheRead / cacheTotal) * 100 : 0;
  const hitRate = hitRateValue.toFixed(1);

  return (
    <div style={{
      background: tokens.colors.surface,
      border: `1px solid ${tokens.colors.surfaceBorder}`,
      borderRadius: '16px',
      padding: '24px',
      boxShadow: tokens.shadows.md,
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        marginBottom: '20px',
        color: tokens.colors.textPrimary,
        fontSize: '16px',
        fontWeight: '600',
      }}>
        <Database size={20} style={{ color: tokens.colors.accentPrimary }} />
        Cache Efficiency
      </div>
      
      {/* Circular progress */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 0',
      }}>
        <div style={{ position: 'relative', width: '140px', height: '140px' }}>
          <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
            {/* Background circle */}
            <circle
              cx="70"
              cy="70"
              r="60"
              fill="none"
              stroke={tokens.colors.surfaceBorder}
              strokeWidth="12"
            />
            {/* Progress circle */}
            <circle
              cx="70"
              cy="70"
              r="60"
              fill="none"
              stroke={hoveredStat === 'read' ? tokens.colors.semanticSuccess : hoveredStat === 'write' ? tokens.colors.accentPrimary : tokens.colors.semanticSuccess}
              strokeWidth={hoveredStat ? 14 : 12}
              strokeLinecap="round"
              strokeDasharray={`${(hitRateValue / 100) * 377} 377`}
              style={{ transition: 'all 0.3s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
          }}>
            <div style={{ 
              fontSize: '28px', 
              fontWeight: '700', 
              color: tokens.colors.semanticSuccess,
              fontFamily: "'DM Mono', monospace",
            }}>
              {hitRate}%
            </div>
            <div style={{ fontSize: '11px', color: tokens.colors.textMuted, fontWeight: '500' }}>
              HIT RATE
            </div>
          </div>
        </div>
      </div>
      
      {/* Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div
          onMouseEnter={() => setHoveredStat('read')}
          onMouseLeave={() => setHoveredStat(null)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px',
            background: hoveredStat === 'read' ? tokens.colors.surface : tokens.colors.background,
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            border: `1px solid ${hoveredStat === 'read' ? tokens.colors.semanticSuccess : 'transparent'}`,
          }}
        >
          <span style={{ fontSize: '13px', color: tokens.colors.textMuted }}>Cache Read</span>
          <span style={{ fontSize: '14px', fontWeight: '600', color: hoveredStat === 'read' ? tokens.colors.semanticSuccess : tokens.colors.accentPrimary }}>
            {formatNumber(cacheRead)} tok
          </span>
        </div>
        <div
          onMouseEnter={() => setHoveredStat('write')}
          onMouseLeave={() => setHoveredStat(null)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px',
            background: hoveredStat === 'write' ? tokens.colors.surface : tokens.colors.background,
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            border: `1px solid ${hoveredStat === 'write' ? tokens.colors.accentPrimary : 'transparent'}`,
          }}
        >
          <span style={{ fontSize: '13px', color: tokens.colors.textMuted }}>Cache Write</span>
          <span style={{ fontSize: '14px', fontWeight: '600', color: hoveredStat === 'write' ? tokens.colors.accentPrimary : tokens.colors.accentPrimary }}>
            {formatNumber(cacheWrite)} tok
          </span>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SESSIONS TABLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const SessionsTable = ({ sessions, isExporting = false }: any) => {
  const [sessionLimit, setSessionLimit] = useState('10');
  const visibleSessions = sessions.slice(0, Number(sessionLimit));

  return (
    <div style={{
      background: tokens.colors.surface,
      border: `1px solid ${tokens.colors.surfaceBorder}`,
      borderRadius: '16px',
      padding: '24px',
      boxShadow: tokens.shadows.md,
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '20px',
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          color: tokens.colors.textPrimary,
          fontSize: '16px',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          <MessageSquare size={20} style={{ color: tokens.colors.accentPrimary }} />
          Top Sessions by Cost
        </div>
        <div
          data-export-exclude={isExporting ? 'true' : undefined}
          style={{ position: 'relative' }}
        >
          <select
            value={sessionLimit}
            onChange={(event) => setSessionLimit(event.target.value)}
            style={{
              appearance: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 36px 8px 16px',
              borderRadius: '20px',
              border: `1px solid ${tokens.colors.surfaceBorder}`,
              background: 'transparent',
              color: tokens.colors.textSecondary,
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            <option value="10">Show 10</option>
            <option value="25">Show 25</option>
            <option value="50">Show 50</option>
          </select>
          <ChevronDown
            size={14}
            style={{
              position: 'absolute',
              right: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: tokens.colors.textSecondary,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
      
    <div
      data-export-hide-scrollbar={isExporting ? 'true' : undefined}
      style={{
        overflowX: 'auto',
        scrollbarWidth: isExporting ? 'none' : undefined,
        msOverflowStyle: isExporting ? 'none' : undefined,
      }}
    >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Session ID', 'Model', 'Messages', 'Tokens', 'Cost', 'Time'].map(header => (
                <th key={header} style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: tokens.colors.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: `1px solid ${tokens.colors.surfaceBorder}`,
                }}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleSessions.map((session: any, idx: number) => (
              <tr 
                key={session.id}
                style={{
                  transition: 'background 0.15s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = tokens.colors.background}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{
                  padding: '16px',
                  fontSize: '13px',
                  fontFamily: "'DM Mono', monospace",
                  color: tokens.colors.textSecondary,
                  borderBottom: idx < visibleSessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
                }}>
                {session.id}
                </td>
                <td style={{
                  padding: '16px',
                  borderBottom: idx < visibleSessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
                }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: 'var(--color-accent-primary-15)',
                    color: tokens.colors.accentPrimary,
                  }}>
                    {session.model}
                  </span>
                </td>
                <td style={{
                  padding: '16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: tokens.colors.textSecondary,
                  borderBottom: idx < visibleSessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
                }}>
                  {session.messages}
                </td>
                <td style={{
                  padding: '16px',
                  fontSize: '14px',
                  color: tokens.colors.textSecondary,
                  borderBottom: idx < visibleSessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
                }}>
                  {formatNumber(session.tokens)}
                </td>
                <td style={{
                  padding: '16px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: tokens.colors.semanticSuccess,
                  borderBottom: idx < visibleSessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
                }}>
                  {formatCurrency(session.cost)}
                </td>
                <td style={{
                  padding: '16px',
                  fontSize: '13px',
                  color: tokens.colors.textMuted,
                  borderBottom: idx < visibleSessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
                }}>
                  {session.time}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT WITH REAL DATA
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardContent() {
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-01-01`;
  const defaultTo = now.toISOString().slice(0, 10);

  const [tempFrom, setTempFrom] = useState(defaultFrom);
  const [tempTo, setTempTo] = useState(defaultTo);
  const [showPicker, setShowPicker] = useState(false);
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLElement | null>(null);

  // Settings drawer state and project filter
  const {
    settingsOpen,
    toggleSettings,
    selectedProjectId,
    darkMode,
    dateFrom,
    dateTo,
    setDateRange,
  } = useAppStore();
  const dateRange = { from: dateFrom, to: dateTo };

  // Debug log
  console.log('[DashboardContent] selectedProjectId:', selectedProjectId);

  // Auto-select granularity based on date range
  const calculateGranularity = (from: string, to: string): 'hour' | 'day' | 'week' | 'month' => {
    const startDate = new Date(from);
    const endDate = new Date(to);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 2) return 'hour';      // Up to 2 days -> hourly
    if (daysDiff <= 14) return 'day';      // 3-14 days -> daily
    if (daysDiff <= 60) return 'day';      // 15-60 days -> daily
    if (daysDiff <= 180) return 'week';    // 61-180 days -> weekly
    return 'month';                         // > 180 days -> monthly
  };

  const granularity = calculateGranularity(dateRange.from, dateRange.to);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
  }, [darkMode]);

  console.log('[DashboardContent] selectedProjectId from store:', selectedProjectId);

  const { data: apiData, isLoading, error } = useDashboard(
    dateRange.from,
    dateRange.to,
    shouldRefresh,
    granularity,
    selectedProjectId
  );
  const { data: projectsData } = useProjects();

  // Fetch limit resets
  const { data: limitResets } = useLimitResets(
    dateRange.from,
    dateRange.to,
    true // Always fetch limit resets data
  );

  // Handle refresh button click
  const handleRefresh = () => {
    setShouldRefresh(true);
    // Reset to false after a short delay to allow re-triggering
    setTimeout(() => setShouldRefresh(false), 100);
  };

  // Handle download PNG button click
  const handleDownloadPNG = async () => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const { toPng } = await import('html-to-image');

      if (!dashboardRef.current) {
        throw new Error('Dashboard content not ready for export.');
      }

      setIsExporting(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const backgroundColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-background')
        .trim() || '#ffffff';
      let dataUrl: string;
      try {
        dataUrl = await toPng(dashboardRef.current, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor,
          filter: (node) => !(node instanceof Element && node.hasAttribute('data-export-exclude')),
        });
      } finally {
        setIsExporting(false);
      }

      const data = dataUrl.split(',')[1];
      const now = new Date();
      const pad = (value: number) => value.toString().padStart(2, '0');
      const timestamp = [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate()),
      ].join('') + `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `cc-dashboard-${timestamp}.png`;

      // Show save dialog
      const filePath = await save({
        defaultPath: filename,
        filters: [{
          name: 'PNG Image',
          extensions: ['png']
        }]
      });

      if (!filePath) {
        // User cancelled
        return;
      }

      // Decode base64 to bytes
      const byteCharacters = atob(data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Write file
      await writeFile(filePath, byteArray);

      alert(`PNG report saved to:\n${filePath}`);
    } catch (err) {
      console.error('Failed to download PNG:', err);
      alert('Failed to download PNG report. Check console for details.');
    }
  };

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: tokens.colors.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ fontSize: '18px', fontWeight: '600', color: tokens.colors.textPrimary }}>
          Loading Dashboard...
        </div>
      </div>
    );
  }

  if (error || !apiData) {
    return (
      <div style={{
        minHeight: '100vh',
        background: tokens.colors.background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ fontSize: '18px', fontWeight: '600', color: tokens.colors.semanticError }}>
          Error: {error?.message || 'Failed to load data'}
        </div>
      </div>
    );
  }

  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const normalizeDateString = (value: string) => value.split('T')[0].split(' ')[0];
  const setRange = (from: string, to: string) => {
    setDateRange(from, to);
    setShowPicker(false);
  };
  const setRangeLastDays = (days: number) => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));
    setRange(formatDate(start), formatDate(end));
  };
  const setRangeLast24Hours = () => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 1);
    setRange(formatDate(start), formatDate(end));
  };
  const setRangeAll = () => {
    const dataRange = apiData.meta?.data_range;
    const fallbackStart = apiData.totals.first_session_date
      ? normalizeDateString(apiData.totals.first_session_date)
      : defaultFrom;
    const fallbackEnd = formatDate(new Date());
    setRange(dataRange?.start || fallbackStart, dataRange?.end || fallbackEnd);
  };

  // Transform API data to component format
  const data = {
    dailyActivity: apiData.daily_activity,
    timelineData: apiData.timeline.data.map((d: any) => ({
      period: d.period,
      messages: d.messages,
      tokens: d.tokens,
      cost: d.cost,
    })),
    hourlyData: apiData.hourly_profile.map((h: any) => ({
      hour: h.hour.toString().padStart(2, '0') + ':00',
      activity: h.messages,
    })),
    dailyData: (() => {
      // Aggregate daily_activity by day of week
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayStats: { [key: number]: { count: number; messages: number } } = {};

      // Initialize all days
      for (let i = 0; i < 7; i++) {
        dayStats[i] = { count: 0, messages: 0 };
      }

      // Aggregate by day of week
      Object.entries(apiData.daily_activity).forEach(([date, messages]: [string, any]) => {
        const dayOfWeek = new Date(date).getDay();
        dayStats[dayOfWeek].count++;
        dayStats[dayOfWeek].messages += messages;
      });

      // Calculate average and format for chart (Monday first)
      return [1, 2, 3, 4, 5, 6, 0].map(dayIndex => ({
        day: dayNames[dayIndex],
        activity: dayStats[dayIndex].count > 0
          ? Math.round(dayStats[dayIndex].messages / dayStats[dayIndex].count)
          : 0,
      }));
    })(),
    modelData: apiData.model_distribution.map((m: any) => ({
      model: m.model,
      displayName: m.display_name,
      tokens: m.tokens,
      messages: m.messages,
      cost: m.cost,
    })),
    sessions: apiData.recent_sessions.map((s: any) => ({
      id: s.session_id,
      model: s.display_name,
      messages: s.messages,
      tokens: s.tokens,
      cost: s.cost,
      time: s.first_time.split('T')[1]?.slice(0, 5) || '00:00',
    })),
    totals: {
      messages: apiData.totals.messages,
      sessions: apiData.totals.sessions,
      tokens: apiData.totals.tokens,
      cost: apiData.totals.cost,
      cacheRead: apiData.totals.cache_read,
      cacheWrite: apiData.totals.cache_write,
      maxStreak: apiData.totals.max_streak,
      currentStreak: apiData.totals.current_streak,
    },
    trends: apiData.trends
  };
  const appVersion = apiData.meta?.app_version;
  const visibleProjects = projectsData?.projects.filter((project: any) => project.visible) || [];
  const selectedProject = visibleProjects.find((project: any) => project.project_id === selectedProjectId);
  const projectLabel = selectedProject
    ? getProjectDisplayName(selectedProject)
    : selectedProjectId
      ? getProjectDisplayName({ project_id: selectedProjectId })
      : 'All Projects';
  
  return (
    <div style={{
      minHeight: '100vh',
      background: tokens.colors.background,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <header style={{
        background: tokens.colors.surface,
        borderBottom: `1px solid ${tokens.colors.surfaceBorder}`,
        padding: '16px 32px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '1600px',
          margin: '0 auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${tokens.colors.accentPrimary}, ${tokens.colors.accentSecondary})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Zap size={22} color={tokens.colors.surface} />
            </div>
            <div>
              <h1 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: tokens.colors.textPrimary,
                margin: 0,
                letterSpacing: '-0.5px',
              }}>
                Command Center
              </h1>
              <p style={{
                fontSize: '13px',
                color: tokens.colors.textMuted,
                margin: 0,
              }}>
                Claude Code Analytics Dashboard
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Search */}
            {/* Project filter */}
            <ProjectSelector />

            {/* Date range with Apply button */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => {
                  setTempFrom(dateRange.from);
                  setTempTo(dateRange.to);
                  setShowPicker(!showPicker);
                }}
                title="Select date range"
                aria-label="Select date range"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  background: tokens.colors.background,
                  borderRadius: '10px',
                  border: `1px solid ${tokens.colors.surfaceBorder}`,
                  cursor: 'pointer',
                }}
              >
                <Calendar size={16} color={tokens.colors.accentPrimary} />
                <span style={{ fontSize: '14px', color: tokens.colors.textSecondary }}>
                  {dateRange.from} → {dateRange.to}
                </span>
                <ChevronDown size={14} color={tokens.colors.textMuted} />
              </div>

              {showPicker && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50px',
                    right: 0,
                    background: tokens.colors.surface,
                    border: `1px solid ${tokens.colors.surfaceBorder}`,
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: tokens.shadows.lg,
                    zIndex: 1000,
                    width: '320px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: tokens.colors.textMuted,
                        marginBottom: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        From
                      </label>
                      <DatePicker
                        selected={new Date(tempFrom)}
                        onChange={(date: Date | null) => date && setTempFrom(date.toISOString().split('T')[0])}
                        dateFormat="yyyy-MM-dd"
                        shouldCloseOnSelect={true}
                        customInput={
                          <input
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              padding: '10px 12px',
                              border: `1px solid ${tokens.colors.surfaceBorder}`,
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontFamily: "'DM Mono', monospace",
                              color: tokens.colors.textPrimary,
                              background: tokens.colors.background,
                              cursor: 'pointer',
                            }}
                          />
                        }
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: tokens.colors.textMuted,
                        marginBottom: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        To
                      </label>
                      <DatePicker
                        selected={new Date(tempTo)}
                        onChange={(date: Date | null) => date && setTempTo(date.toISOString().split('T')[0])}
                        dateFormat="yyyy-MM-dd"
                        shouldCloseOnSelect={true}
                        customInput={
                          <input
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              padding: '10px 12px',
                              border: `1px solid ${tokens.colors.surfaceBorder}`,
                              borderRadius: '6px',
                              fontSize: '14px',
                              fontFamily: "'DM Mono', monospace",
                              color: tokens.colors.textPrimary,
                              background: tokens.colors.background,
                              cursor: 'pointer',
                            }}
                          />
                        }
                      />
                    </div>
                  </div>

                  {/* Quick shortcuts */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '6px',
                    marginBottom: '16px',
                    paddingTop: '8px',
                    borderTop: `1px solid ${tokens.colors.surfaceBorder}`,
                  }}>
                    <button
                      onClick={setRangeLast24Hours}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${tokens.colors.surfaceBorder}`,
                        background: tokens.colors.background,
                        color: tokens.colors.textSecondary,
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = tokens.colors.accentPrimary;
                        e.currentTarget.style.color = tokens.colors.surface;
                        e.currentTarget.style.borderColor = tokens.colors.accentPrimary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = tokens.colors.background;
                        e.currentTarget.style.color = tokens.colors.textSecondary;
                        e.currentTarget.style.borderColor = tokens.colors.surfaceBorder;
                      }}
                    >
                      Last 24h
                    </button>
                    <button
                      onClick={() => setRangeLastDays(7)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${tokens.colors.surfaceBorder}`,
                        background: tokens.colors.background,
                        color: tokens.colors.textSecondary,
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = tokens.colors.accentPrimary;
                        e.currentTarget.style.color = tokens.colors.surface;
                        e.currentTarget.style.borderColor = tokens.colors.accentPrimary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = tokens.colors.background;
                        e.currentTarget.style.color = tokens.colors.textSecondary;
                        e.currentTarget.style.borderColor = tokens.colors.surfaceBorder;
                      }}
                    >
                      Last 7 days
                    </button>
                    <button
                      onClick={() => setRangeLastDays(14)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${tokens.colors.surfaceBorder}`,
                        background: tokens.colors.background,
                        color: tokens.colors.textSecondary,
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = tokens.colors.accentPrimary;
                        e.currentTarget.style.color = tokens.colors.surface;
                        e.currentTarget.style.borderColor = tokens.colors.accentPrimary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = tokens.colors.background;
                        e.currentTarget.style.color = tokens.colors.textSecondary;
                        e.currentTarget.style.borderColor = tokens.colors.surfaceBorder;
                      }}
                    >
                      Last 14 days
                    </button>
                    <button
                      onClick={() => setRangeLastDays(30)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${tokens.colors.surfaceBorder}`,
                        background: tokens.colors.background,
                        color: tokens.colors.textSecondary,
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = tokens.colors.accentPrimary;
                        e.currentTarget.style.color = tokens.colors.surface;
                        e.currentTarget.style.borderColor = tokens.colors.accentPrimary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = tokens.colors.background;
                        e.currentTarget.style.color = tokens.colors.textSecondary;
                        e.currentTarget.style.borderColor = tokens.colors.surfaceBorder;
                      }}
                    >
                      Last 30 days
                    </button>
                    <button
                      onClick={() => setRangeLastDays(90)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${tokens.colors.surfaceBorder}`,
                        background: tokens.colors.background,
                        color: tokens.colors.textSecondary,
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = tokens.colors.accentPrimary;
                        e.currentTarget.style.color = tokens.colors.surface;
                        e.currentTarget.style.borderColor = tokens.colors.accentPrimary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = tokens.colors.background;
                        e.currentTarget.style.color = tokens.colors.textSecondary;
                        e.currentTarget.style.borderColor = tokens.colors.surfaceBorder;
                      }}
                    >
                      Last 90 days
                    </button>
                    <button
                      onClick={setRangeAll}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${tokens.colors.surfaceBorder}`,
                        background: tokens.colors.background,
                        color: tokens.colors.textSecondary,
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = tokens.colors.accentPrimary;
                        e.currentTarget.style.color = tokens.colors.surface;
                        e.currentTarget.style.borderColor = tokens.colors.accentPrimary;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = tokens.colors.background;
                        e.currentTarget.style.color = tokens.colors.textSecondary;
                        e.currentTarget.style.borderColor = tokens.colors.surfaceBorder;
                      }}
                    >
                      All
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setShowPicker(false)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: `1px solid ${tokens.colors.surfaceBorder}`,
                        background: 'transparent',
                        color: tokens.colors.textSecondary,
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setRange(tempFrom, tempTo);
                      }}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: tokens.colors.accentPrimary,
                        color: tokens.colors.surface,
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <button
              onClick={handleRefresh}
              title="Refresh data"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                border: `1px solid ${tokens.colors.surfaceBorder}`,
                background: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tokens.colors.background;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <RefreshCw size={18} color={tokens.colors.textMuted} />
            </button>
            <button
              onClick={handleDownloadPNG}
              title="Download PNG report"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                border: `1px solid ${tokens.colors.surfaceBorder}`,
                background: 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tokens.colors.background;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Download size={18} color={tokens.colors.textMuted} />
            </button>
            <button
              onClick={toggleSettings}
              title="Open settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                border: `1px solid ${tokens.colors.surfaceBorder}`,
                background: 'transparent',
                cursor: 'pointer',
              }}
              aria-label="Open settings"
            >
              <Settings size={18} color={tokens.colors.textMuted} />
            </button>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main
        ref={dashboardRef}
        style={{
          maxWidth: '1600px',
          margin: '0 auto',
          padding: '32px',
        }}
      >
        {isExporting && (
          <style>
            {`
              [data-export-hide-scrollbar]::-webkit-scrollbar {
                width: 0 !important;
                height: 0 !important;
              }
            `}
          </style>
        )}
        {isExporting && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(320px, 1fr) auto',
              alignItems: 'center',
              gap: '24px',
              padding: '22px 26px',
              borderRadius: '18px',
              background: `linear-gradient(135deg, ${tokens.colors.surface}, ${tokens.colors.background})`,
              border: `1px solid ${tokens.colors.surfaceBorder}`,
              boxShadow: tokens.shadows.md,
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${tokens.colors.accentPrimary}, ${tokens.colors.accentSecondary})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Zap size={22} color={tokens.colors.surface} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: tokens.colors.textPrimary,
                  letterSpacing: '-0.4px',
                  whiteSpace: 'nowrap',
                }}>
                  Command Center
                </div>
                <div style={{
                  fontSize: '12px',
                  color: tokens.colors.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  whiteSpace: 'nowrap',
                }}>
                  Claude Code Analytics Dashboard
                </div>
              </div>
            </div>
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end',
              alignItems: 'center',
              flexWrap: 'nowrap',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '999px',
                border: `1px solid ${tokens.colors.surfaceBorder}`,
                background: tokens.colors.background,
                whiteSpace: 'nowrap',
              }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.6px', color: tokens.colors.textMuted }}>
                  Projects
                </span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: tokens.colors.textPrimary }}>
                  {projectLabel}
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '999px',
                border: `1px solid ${tokens.colors.surfaceBorder}`,
                background: tokens.colors.background,
                whiteSpace: 'nowrap',
              }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.6px', color: tokens.colors.textMuted }}>
                  Date range
                </span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: tokens.colors.textPrimary }}>
                  {dateRange.from} → {dateRange.to}
                </span>
              </div>
            </div>
          </div>
        )}
        {/* KPI Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '20px',
          marginBottom: '32px',
        }}>
          <KPICard
            title="Messages"
            value={formatNumber(data.totals.messages)}
            subtitle="Total API calls"
            trend={data.trends.messages}
            icon={MessageSquare}
          />
          <KPICard
            title="Sessions"
            value={formatNumber(data.totals.sessions)}
            subtitle="Unique sessions"
            trend={data.trends.sessions}
            icon={Users}
          />
          <KPICard
            title="Tokens"
            value={formatNumber(data.totals.tokens)}
            subtitle="Total processed"
            trend={data.trends.tokens}
            icon={Zap}
          />
          <KPICard
            title="Cost"
            value={formatCurrency(data.totals.cost)}
            subtitle="Usage charges"
            trend={data.trends.cost}
            icon={Coins}
          />
          <KPICard
            title="Streak"
            value={`${data.totals.currentStreak}d`}
            subtitle={`Max: ${data.totals.maxStreak}d`}
            trend={undefined}
            icon={Flame}
            accentColor={tokens.colors.semanticWarning}
          />
        </div>
        
        {/* Activity Timeline */}
        <div style={{ marginBottom: '32px' }}>
          <ActivityTimeline
            data={data.timelineData}
            granularity={granularity}
            limitResets={limitResets || []}
          />
        </div>

        {/* Model Distribution & Cache Efficiency */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          marginBottom: '32px',
        }}>
          <ModelDistribution data={data.modelData} />
          <CacheEfficiency
            cacheRead={data.totals.cacheRead}
            cacheWrite={data.totals.cacheWrite}
          />
        </div>

        {/* Activity Heatmap */}
        <div style={{ marginBottom: '32px' }}>
          <ActivityHeatmap
            data={data.dailyActivity}
            dateFrom={dateRange.from}
            dateTo={dateRange.to}
          />
        </div>

        {/* Hourly & Daily Patterns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          marginBottom: '32px',
        }}>
          <HourlyPatterns data={data.hourlyData} />
          <DailyPatterns data={data.dailyData} />
        </div>
        
        {/* Sessions Table */}
        <SessionsTable sessions={data.sessions} isExporting={isExporting} />
        
        {/* Footer */}
        <footer
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '40px',
            padding: '20px 0',
            borderTop: `1px solid ${tokens.colors.surfaceBorder}`,
            gap: '16px',
          }}
        >
          <div style={{ fontSize: '13px', color: tokens.colors.textMuted, flex: '1 1 60%', minWidth: 0 }}>
            <span>Last updated: {new Date().toLocaleString()}</span>
            <span data-export-exclude="true"> • DB Size: 52.3 MB • </span>
            <span
              data-export-exclude="true"
              style={{ color: tokens.colors.semanticSuccess, marginLeft: '8px' }}
            >
              ● Connected
            </span>
          </div>
          <div style={{ fontSize: '13px', color: tokens.colors.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>
            Command Center{appVersion ? ` v${appVersion}` : ''} • Powered by Claude Code
          </div>
        </footer>
      </main>

      {/* Settings Drawer */}
      <SettingsDrawer isOpen={settingsOpen} onClose={toggleSettings} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP EXPORT WITH QUERY CLIENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardContent />
    </QueryClientProvider>
  );
}
