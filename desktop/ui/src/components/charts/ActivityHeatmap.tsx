import { useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import type { ActivityHeatmapProps } from '../../types/dashboard';
import { formatDateForDisplay } from '../../lib/date';
import { useAppStore } from '../../state/store';
import { tokens } from '../../styles/tokens';

export function ActivityHeatmap({ data, dateFrom, dateTo }: ActivityHeatmapProps) {
  const { dateFormat } = useAppStore();
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const { weeks, maxCount } = useMemo(() => {
    const allDates = Object.keys(data);
    if (allDates.length === 0) {
      return { weeks: [], maxCount: 1 };
    }

    const sortedDates = allDates.sort();
    const firstDate = new Date(sortedDates[0]);
    const lastDate = new Date(sortedDates[sortedDates.length - 1]);

    const start = new Date(firstDate.getFullYear(), 0, 1);
    const end = new Date(lastDate.getFullYear(), 11, 31);

    const filledData: Record<string, number> = {};
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      filledData[dateStr] = data[dateStr] || 0;
    }

    const entries = Object.entries(filledData).sort(([a], [b]) => a.localeCompare(b));
    const max = Math.max(...Object.values(filledData).map((value) => value as number), 1);

    const weeksMap = new Map<string, Array<{ date: string; count: number; dayOfWeek: number }>>();

    entries.forEach(([date, count]) => {
      const day = new Date(date);
      const dayOfWeek = (day.getDay() + 6) % 7;

      const monday = new Date(day);
      monday.setDate(day.getDate() - dayOfWeek);
      const weekKey = monday.toISOString().split('T')[0];

      if (!weeksMap.has(weekKey)) {
        weeksMap.set(weekKey, []);
      }

      weeksMap.get(weekKey)!.push({ date, count, dayOfWeek });
    });

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
        <Calendar size={20} style={{ color: tokens.colors.accentPrimary }} />
        Activity Heatmap
      </div>

      <div style={{ display: 'flex', marginLeft: '36px', marginBottom: '8px', gap: '3.3px' }}>
        {weeks.map((week, idx) => (
          <div
            key={idx}
            style={{
              width: '14px',
              fontSize: '11px',
              color: tokens.colors.textMuted,
              fontWeight: '500',
              textAlign: 'left',
            }}
          >
            {week.length === 0 ? '' : monthLabelSlots[idx] || ''}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3.6px', marginRight: '8px' }}>
          {dayLabels.map((day) => (
            <div
              key={day}
              style={{
                height: '14px',
                fontSize: '10px',
                color: tokens.colors.textMuted,
                display: 'flex',
                alignItems: 'center',
                fontWeight: '500',
              }}
            >
              {day}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '3.3px', position: 'relative' }}>
          {weeks.map((week, weekIdx) => {
            const isFirstWeek = weekIdx === 0;

            if (week.length === 0) return null;

            const minDayOfWeek = Math.min(...week.map((day) => day.dayOfWeek));

            return (
              <div key={weekIdx} style={{ display: 'flex', flexDirection: 'column', gap: '3.6px' }}>
                {isFirstWeek &&
                  Array.from({ length: minDayOfWeek }, (_, idx) => (
                    <div key={`empty-${idx}`} style={{ width: '14px', height: '14px' }} />
                  ))}

                {week
                  .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                  .map((day) => {
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

          {hoveredDay && (
            <div
              style={{
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
              }}
            >
              {formatDateForDisplay(hoveredDay, dateFormat) || hoveredDay}: {data[hoveredDay] || 0} messages
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '16px',
          marginLeft: '36px',
        }}
      >
        <span style={{ fontSize: '11px', color: tokens.colors.textMuted }}>Less</span>
        {tokens.colors.heatmap.map((color, idx) => (
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
}
