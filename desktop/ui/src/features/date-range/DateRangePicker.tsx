import DatePicker from 'react-datepicker';
import { Calendar, ChevronDown } from 'lucide-react';
import 'react-datepicker/dist/react-datepicker.css';
import '../../styles/datepicker-custom.css';
import type { DashboardDataRange } from '../../types/dashboard';
import { formatDateForDisplay, getDateFormatOption } from '../../lib/date';
import { useAppStore } from '../../state/store';
import { tokens } from '../../styles/tokens';
import { useDateRange } from './useDateRange';

interface DateRangePickerProps {
  defaultFrom: string;
  dataRange?: DashboardDataRange;
  firstSessionDate?: string | null;
}

export function DateRangePicker({
  defaultFrom,
  dataRange,
  firstSessionDate,
}: DateRangePickerProps) {
  const {
    dateRange,
    tempFrom,
    tempTo,
    setTempFrom,
    setTempTo,
    isOpen,
    togglePicker,
    closePicker,
    applyRange,
    setRangeLast24Hours,
    setRangeLastDays,
    setRangeAll,
  } = useDateRange({ defaultFrom, dataRange, firstSessionDate });
  const { dateFormat } = useAppStore();
  const dateFormatOption = getDateFormatOption(dateFormat);
  const formattedFrom = formatDateForDisplay(dateRange.from, dateFormat) || dateRange.from;
  const formattedTo = formatDateForDisplay(dateRange.to, dateFormat) || dateRange.to;

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={togglePicker}
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
          {formattedFrom} → {formattedTo}
        </span>
        <ChevronDown size={14} color={tokens.colors.textMuted} />
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '50px',
            right: 0,
            background: tokens.colors.surface,
            border: `1px solid ${tokens.colors.surfaceBorder}`,
            borderRadius: '12px',
            padding: '20px',
            filter: tokens.shadows.dropLg,
            zIndex: 1000,
            width: '320px',
          }}
        >
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: tokens.colors.textMuted,
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                From
              </label>
              <DatePicker
                selected={new Date(tempFrom)}
                onChange={(date: Date | null) => date && setTempFrom(date.toISOString().split('T')[0])}
                dateFormat={dateFormatOption.dateFnsFormat}
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
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: tokens.colors.textMuted,
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                To
              </label>
              <DatePicker
                selected={new Date(tempTo)}
                onChange={(date: Date | null) => date && setTempTo(date.toISOString().split('T')[0])}
                dateFormat={dateFormatOption.dateFnsFormat}
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

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '6px',
              marginBottom: '16px',
              paddingTop: '8px',
              borderTop: `1px solid ${tokens.colors.surfaceBorder}`,
            }}
          >
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
              onMouseEnter={(event) => {
                event.currentTarget.style.background = tokens.colors.accentPrimary;
                event.currentTarget.style.color = tokens.colors.surface;
                event.currentTarget.style.borderColor = tokens.colors.accentPrimary;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = tokens.colors.background;
                event.currentTarget.style.color = tokens.colors.textSecondary;
                event.currentTarget.style.borderColor = tokens.colors.surfaceBorder;
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
              onMouseEnter={(event) => {
                event.currentTarget.style.background = tokens.colors.accentPrimary;
                event.currentTarget.style.color = tokens.colors.surface;
                event.currentTarget.style.borderColor = tokens.colors.accentPrimary;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = tokens.colors.background;
                event.currentTarget.style.color = tokens.colors.textSecondary;
                event.currentTarget.style.borderColor = tokens.colors.surfaceBorder;
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
              onMouseEnter={(event) => {
                event.currentTarget.style.background = tokens.colors.accentPrimary;
                event.currentTarget.style.color = tokens.colors.surface;
                event.currentTarget.style.borderColor = tokens.colors.accentPrimary;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = tokens.colors.background;
                event.currentTarget.style.color = tokens.colors.textSecondary;
                event.currentTarget.style.borderColor = tokens.colors.surfaceBorder;
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
              onMouseEnter={(event) => {
                event.currentTarget.style.background = tokens.colors.accentPrimary;
                event.currentTarget.style.color = tokens.colors.surface;
                event.currentTarget.style.borderColor = tokens.colors.accentPrimary;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = tokens.colors.background;
                event.currentTarget.style.color = tokens.colors.textSecondary;
                event.currentTarget.style.borderColor = tokens.colors.surfaceBorder;
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
              onMouseEnter={(event) => {
                event.currentTarget.style.background = tokens.colors.accentPrimary;
                event.currentTarget.style.color = tokens.colors.surface;
                event.currentTarget.style.borderColor = tokens.colors.accentPrimary;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = tokens.colors.background;
                event.currentTarget.style.color = tokens.colors.textSecondary;
                event.currentTarget.style.borderColor = tokens.colors.surfaceBorder;
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
              onMouseEnter={(event) => {
                event.currentTarget.style.background = tokens.colors.accentPrimary;
                event.currentTarget.style.color = tokens.colors.surface;
                event.currentTarget.style.borderColor = tokens.colors.accentPrimary;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = tokens.colors.background;
                event.currentTarget.style.color = tokens.colors.textSecondary;
                event.currentTarget.style.borderColor = tokens.colors.surfaceBorder;
              }}
            >
              All
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={closePicker}
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
              onClick={applyRange}
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
  );
}
