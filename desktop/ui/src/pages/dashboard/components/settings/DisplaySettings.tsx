/**
 * Display Settings - theme and date formatting controls
 */
import { Moon, Sun, ChevronDown } from 'lucide-react';
import { useAppStore } from '../../../../state/store';
import { DATE_FORMAT_OPTIONS, formatDateForDisplay, type DateFormatId } from '../../../../lib/date';

export function DisplaySettings() {
  const { darkMode, toggleDarkMode, dateFormat, setDateFormat } = useAppStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
      <div>
        <h3
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--spacing-md)',
          }}
        >
          Theme
        </h3>

        <div
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 'var(--spacing-sm)',
          }}
        >
          Appearance
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            {darkMode ? (
              <Moon size={20} color="var(--color-accent-primary)" />
            ) : (
              <Sun size={20} color="var(--color-accent-primary)" />
            )}
            <div>
              <div
                style={{
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-text-primary)',
                }}
              >
                Dark Mode
              </div>
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-muted)',
                }}
              >
                {darkMode ? 'Enabled' : 'Disabled'}
              </div>
            </div>
          </div>

          <button
            onClick={toggleDarkMode}
            style={{
              padding: 'var(--spacing-sm) var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              backgroundColor: darkMode ? 'var(--color-accent-primary)' : 'var(--color-surface)',
              color: darkMode ? 'white' : 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            aria-label="Toggle dark mode"
            aria-pressed={darkMode}
          >
            {darkMode ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      <div>
        <h3
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--spacing-md)',
          }}
        >
          Date & Time
        </h3>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--spacing-md)',
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 'var(--font-size-base)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
              }}
            >
              Date format
            </div>
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-muted)',
              }}
            >
              Applies to all dates shown on the dashboard.
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <select
              value={dateFormat}
              onChange={(event) => setDateFormat(event.target.value as DateFormatId)}
              style={{
                appearance: 'none',
                padding: '8px 36px 8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: "'DM Mono', monospace",
                cursor: 'pointer',
                minWidth: '180px',
              }}
              aria-label="Select date format"
            >
              {DATE_FORMAT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} ({formatDateForDisplay('2025-01-31', option.id)})
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
