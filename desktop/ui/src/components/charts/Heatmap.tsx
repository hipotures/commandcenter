/**
 * 53x7 Heatmap - weekly activity visualization (53 weeks x 7 days)
 */
import { useMemo } from 'react';
import { formatDateForDisplay } from '../../lib/date';
import { useAppStore } from '../../state/store';

interface DailyActivity {
  date: string;
  messages: number;
  tokens: number;
}

interface Props {
  data: DailyActivity[];
  onDayClick?: (date: string) => void;
}

export function Heatmap({ data, onDayClick }: Props) {
  const { dateFormat } = useAppStore();
  const { grid, maxTokens } = useMemo(() => {
    // Create a map of date -> activity
    const activityMap = new Map(data.map((d) => [d.date, d]));

    // Find min/max dates
    const dates = data.map((d) => new Date(d.date));
    if (dates.length === 0) return { grid: [], maxTokens: 1 };

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));

    // Start from the Sunday before minDate
    const startDate = new Date(minDate);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // Build 53 weeks x 7 days grid
    const grid: (DailyActivity | null)[][] = [];
    let currentDate = new Date(startDate);
    const maxTokens = Math.max(...data.map((d) => d.tokens), 1);

    for (let week = 0; week < 53; week++) {
      const weekData: (DailyActivity | null)[] = [];
      for (let day = 0; day < 7; day++) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const activity = activityMap.get(dateStr);
        weekData.push(activity || null);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      grid.push(weekData);
    }

    return { grid, maxTokens };
  }, [data]);

  const getColor = (tokens: number | undefined) => {
    if (!tokens || tokens === 0) return 'var(--color-border)';
    const intensity = Math.min(tokens / maxTokens, 1);
    if (intensity < 0.2) return '#3b82f620';
    if (intensity < 0.4) return '#3b82f640';
    if (intensity < 0.6) return '#3b82f660';
    if (intensity < 0.8) return '#3b82f680';
    return '#3b82f6';
  };

  const formatTokens = (value: number) => {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toString();
  };

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div style={{ padding: 'var(--spacing-md)', overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: '2px', minWidth: '900px' }}>
        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingRight: '8px' }}>
          {dayLabels.map((label, i) => (
            <div
              key={i}
              style={{
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: 'var(--color-text-muted)',
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div style={{ display: 'flex', gap: '2px' }}>
          {grid.map((week, weekIndex) => (
            <div key={weekIndex} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {week.map((day, dayIndex) => (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  title={
                    day
                      ? `${formatDateForDisplay(day.date, dateFormat) || day.date}\n${day.messages} messages\n${formatTokens(day.tokens)} tokens`
                      : ''
                  }
                  onClick={() => day && onDayClick?.(day.date)}
                  style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: getColor(day?.tokens),
                    borderRadius: '2px',
                    cursor: day && onDayClick ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (day) {
                      e.currentTarget.style.transform = 'scale(1.2)';
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          marginTop: 'var(--spacing-md)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)',
        }}
      >
        <span>Less</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((intensity, i) => (
            <div
              key={i}
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: getColor(intensity * maxTokens),
                borderRadius: '2px',
              }}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
