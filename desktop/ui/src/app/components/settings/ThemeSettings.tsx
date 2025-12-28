/**
 * Theme Settings - dark/light mode toggle and future color customization
 */
import { useAppStore } from '../../state/store';
import { Sun, Moon } from 'lucide-react';

export function ThemeSettings() {
  const { darkMode, toggleDarkMode } = useAppStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
      {/* Dark mode toggle */}
      <div>
        <h3
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--spacing-md)',
          }}
        >
          Appearance
        </h3>

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

      {/* Future: Custom colors */}
      <div>
        <h3
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--spacing-md)',
          }}
        >
          Customization
        </h3>

        <div
          style={{
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-size-sm)',
            textAlign: 'center',
          }}
        >
          Custom color schemes coming soon...
        </div>
      </div>
    </div>
  );
}
