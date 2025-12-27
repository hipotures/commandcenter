import { useState, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './datepicker-custom.css';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  MessageSquare, Users, Coins, Zap, Flame, Database,
  Calendar, TrendingUp, Clock, Cpu, ChevronDown, Download,
  RefreshCw, Settings, Search, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { useDashboard } from './state/queries';

// ═══════════════════════════════════════════════════════════════════════════════
// CLAUDE CODE DESIGN TOKENS
// ═══════════════════════════════════════════════════════════════════════════════
const tokens = {
  colors: {
    background: '#F7F1E9',
    surface: '#FFF9F2',
    surfaceBorder: '#E8D7C6',
    textPrimary: '#2B1D13',
    textSecondary: '#4A3426',
    textTertiary: '#6B5142',
    textMuted: '#8A7264',
    accentPrimary: '#D97757',
    accentSecondary: '#C4623F',
    semanticSuccess: '#22C55E',
    semanticWarning: '#F59E0B',
    semanticError: '#EF4444',
    heatmap: ['#F0E6DC', '#E6D6C8', '#D9C1AE', '#CBA590', '#BC8873', '#AE6E5B', '#9A5647'],
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(43, 29, 19, 0.05)',
    md: '0 4px 6px -1px rgba(43, 29, 19, 0.07), 0 2px 4px -2px rgba(43, 29, 19, 0.05)',
    lg: '0 10px 15px -3px rgba(43, 29, 19, 0.08), 0 4px 6px -4px rgba(43, 29, 19, 0.04)',
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
        {weeks.map((week, idx) => {
          if (week.length === 0) return null;

          // Show month label only when month changes
          const currentMonth = new Date(week[0].date).getMonth();
          const prevMonth = idx > 0 && weeks[idx - 1].length > 0
            ? new Date(weeks[idx - 1][0].date).getMonth()
            : -1;

          return (
            <div key={idx} style={{
              width: '14px',
              fontSize: '11px',
              color: tokens.colors.textMuted,
              fontWeight: '500',
              textAlign: 'left',
            }}>
              {currentMonth !== prevMonth ? monthLabels[currentMonth] : ''}
            </div>
          );
        })}
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
                        outline: isInSelectedRange ? `1px solid ${tokens.colors.accentPrimary}80` : 'none',
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

  const chartColors = [
    tokens.colors.accentPrimary,
    tokens.colors.accentSecondary,
    tokens.colors.heatmap[4],
  ];

  const totalTokens = data.reduce((sum: number, m: any) => sum + m.tokens, 0);

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
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
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
              {data.map((_: any, idx: number) => (
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
      </div>
      
      {/* Legend */}
      <div style={{
        marginTop: '16px',
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
      }}>
        {data.map((model: any, idx: number) => (
          <div
            key={model.model}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderRadius: '8px',
              background: tokens.colors.background,
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
                {((model.tokens / totalTokens) * 100).toFixed(1)}%
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
const ActivityTimeline = ({ data }: any) => {
  const [metric, setMetric] = useState('messages');
  
  const metrics = [
    { key: 'messages', label: 'Messages', color: tokens.colors.accentPrimary },
    { key: 'tokens', label: 'Tokens', color: tokens.colors.heatmap[5] },
    { key: 'cost', label: 'Cost', color: tokens.colors.semanticSuccess },
  ];

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
      
      <div style={{ height: '280px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={tokens.colors.accentPrimary} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={tokens.colors.accentPrimary} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={tokens.colors.surfaceBorder} />
            <XAxis 
              dataKey="month" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: tokens.colors.textMuted, fontSize: 12 }}
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
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOURLY PATTERNS CHART
// ═══════════════════════════════════════════════════════════════════════════════
const HourlyPatterns = ({ data }: any) => {
  const peakHour = data.reduce((max: any, curr: any) => curr.activity > max.activity ? curr : max, data[0]);

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
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
      </div>
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginTop: '16px',
        padding: '12px',
        background: `${tokens.colors.accentPrimary}10`,
        borderRadius: '8px',
      }}>
        <Zap size={16} style={{ color: tokens.colors.accentPrimary }} />
        <span style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>
          Peak activity: <strong>{peakHour.hour}</strong> ({peakHour.activity} avg messages)
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CACHE EFFICIENCY COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const CacheEfficiency = ({ cacheRead, cacheWrite }: any) => {
  const hitRate = ((cacheRead / (cacheRead + cacheWrite)) * 100).toFixed(1);

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
              stroke={tokens.colors.semanticSuccess}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${(parseFloat(hitRate) / 100) * 377} 377`}
              style={{ transition: 'stroke-dasharray 1s ease' }}
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
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px',
          background: tokens.colors.background,
          borderRadius: '8px',
        }}>
          <span style={{ fontSize: '13px', color: tokens.colors.textMuted }}>Cache Read</span>
          <span style={{ fontSize: '14px', fontWeight: '600', color: tokens.colors.accentPrimary }}>
            {formatNumber(cacheRead)} tok
          </span>
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px',
          background: tokens.colors.background,
          borderRadius: '8px',
        }}>
          <span style={{ fontSize: '13px', color: tokens.colors.textMuted }}>Cache Write</span>
          <span style={{ fontSize: '14px', fontWeight: '600', color: tokens.colors.accentPrimary }}>
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
const SessionsTable = ({ sessions }: any) => (
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
        <MessageSquare size={20} style={{ color: tokens.colors.accentPrimary }} />
        Recent Sessions
      </div>
      <button style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '8px 16px',
        borderRadius: '20px',
        border: `1px solid ${tokens.colors.surfaceBorder}`,
        background: 'transparent',
        color: tokens.colors.textSecondary,
        fontSize: '13px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}>
        View All
        <ChevronDown size={14} />
      </button>
    </div>
    
    <div style={{ overflowX: 'auto' }}>
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
          {sessions.map((session: any, idx: number) => (
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
                borderBottom: idx < sessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
              }}>
                {session.id}...
              </td>
              <td style={{
                padding: '16px',
                borderBottom: idx < sessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
              }}>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: `${tokens.colors.accentPrimary}15`,
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
                borderBottom: idx < sessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
              }}>
                {session.messages}
              </td>
              <td style={{
                padding: '16px',
                fontSize: '14px',
                color: tokens.colors.textSecondary,
                borderBottom: idx < sessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
              }}>
                {formatNumber(session.tokens)}
              </td>
              <td style={{
                padding: '16px',
                fontSize: '14px',
                fontWeight: '600',
                color: tokens.colors.semanticSuccess,
                borderBottom: idx < sessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
              }}>
                {formatCurrency(session.cost)}
              </td>
              <td style={{
                padding: '16px',
                fontSize: '13px',
                color: tokens.colors.textMuted,
                borderBottom: idx < sessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT WITH REAL DATA
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardContent() {
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-01-01`;
  const defaultTo = now.toISOString().slice(0, 10);

  const [dateRange, setDateRange] = useState({ from: defaultFrom, to: defaultTo });
  const [tempFrom, setTempFrom] = useState(defaultFrom);
  const [tempTo, setTempTo] = useState(defaultTo);
  const [showPicker, setShowPicker] = useState(false);

  const { data: apiData, isLoading, error } = useDashboard(
    dateRange.from,
    dateRange.to,
    false,
    'month'
  );

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

  // Transform API data to component format
  const data = {
    dailyActivity: apiData.daily_activity,
    monthlyData: apiData.timeline.data.map((d: any) => ({
      month: d.period,
      messages: d.messages,
      tokens: d.tokens,
      cost: d.cost,
    })),
    hourlyData: apiData.hourly_profile.map((h: any) => ({
      hour: h.hour.toString().padStart(2, '0') + ':00',
      activity: h.messages,
    })),
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
    }
  };
  
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
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: tokens.colors.background,
              borderRadius: '10px',
              border: `1px solid ${tokens.colors.surfaceBorder}`,
            }}>
              <Search size={16} color={tokens.colors.textMuted} />
              <input
                type="text"
                placeholder="Search sessions..."
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '14px',
                  color: tokens.colors.textSecondary,
                  width: '160px',
                }}
              />
            </div>
            
            {/* Date range with Apply button */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => {
                  setTempFrom(dateRange.from);
                  setTempTo(dateRange.to);
                  setShowPicker(!showPicker);
                }}
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
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setDateRange({ from: today, to: today });
                        setShowPicker(false);
                      }}
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
                      Today
                    </button>
                    <button
                      onClick={() => {
                        const today = new Date();
                        const dayOfWeek = today.getDay();
                        const start = new Date(today);
                        start.setDate(today.getDate() - dayOfWeek);
                        const end = new Date(today);
                        end.setDate(today.getDate() + (6 - dayOfWeek));
                        setDateRange({
                          from: start.toISOString().split('T')[0],
                          to: end.toISOString().split('T')[0]
                        });
                        setShowPicker(false);
                      }}
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
                      This Week
                    </button>
                    <button
                      onClick={() => {
                        const today = new Date();
                        const start = new Date(today.getFullYear(), today.getMonth(), 1);
                        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                        setDateRange({
                          from: start.toISOString().split('T')[0],
                          to: end.toISOString().split('T')[0]
                        });
                        setShowPicker(false);
                      }}
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
                      This Month
                    </button>
                    <button
                      onClick={() => {
                        const today = new Date();
                        const year = today.getFullYear();
                        const month = String(today.getMonth() + 1).padStart(2, '0');
                        const day = String(today.getDate()).padStart(2, '0');
                        setDateRange({
                          from: `${year}-01-01`,
                          to: `${year}-${month}-${day}`
                        });
                        setShowPicker(false);
                      }}
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
                      This Year
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
                        setDateRange({ from: tempFrom, to: tempTo });
                        setShowPicker(false);
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
            <button style={{
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
            }}>
              <RefreshCw size={18} color={tokens.colors.textMuted} />
            </button>
            <button style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              border: `1px solid ${tokens.colors.surfaceBorder}`,
              background: 'transparent',
              cursor: 'pointer',
            }}>
              <Download size={18} color={tokens.colors.textMuted} />
            </button>
            <button style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              border: `1px solid ${tokens.colors.surfaceBorder}`,
              background: 'transparent',
              cursor: 'pointer',
            }}>
              <Settings size={18} color={tokens.colors.textMuted} />
            </button>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '32px',
      }}>
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
            trend={12}
            icon={MessageSquare}
          />
          <KPICard
            title="Sessions"
            value={formatNumber(data.totals.sessions)}
            subtitle="Unique sessions"
            trend={8}
            icon={Users}
          />
          <KPICard
            title="Tokens"
            value={formatNumber(data.totals.tokens)}
            subtitle="Total processed"
            trend={15}
            icon={Zap}
          />
          <KPICard
            title="Cost"
            value={formatCurrency(data.totals.cost)}
            subtitle="Usage charges"
            trend={-3}
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
          <ActivityTimeline data={data.monthlyData} />
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

        {/* Hourly Patterns */}
        <div style={{ marginBottom: '32px' }}>
          <HourlyPatterns data={data.hourlyData} />
        </div>
        
        {/* Sessions Table */}
        <SessionsTable sessions={data.sessions} />
        
        {/* Footer */}
        <footer style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '40px',
          padding: '20px 0',
          borderTop: `1px solid ${tokens.colors.surfaceBorder}`,
        }}>
          <div style={{ fontSize: '13px', color: tokens.colors.textMuted }}>
            Last updated: {new Date().toLocaleString()} • DB Size: 52.3 MB • 
            <span style={{ color: tokens.colors.semanticSuccess, marginLeft: '8px' }}>● Connected</span>
          </div>
          <div style={{ fontSize: '13px', color: tokens.colors.textMuted }}>
            Command Center v2.2.0 • Powered by Claude Code
          </div>
        </footer>
      </main>
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
