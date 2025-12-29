/**
 * Privacy Settings - manage account visibility in the dashboard
 */
import { useUsageAccounts } from '../../../../state/queries';
import { useAppStore } from '../../../../state/store';

export function PrivacySettings() {
  const { data, isLoading, error } = useUsageAccounts();
  const { visibleUsageAccounts, toggleUsageAccount } = useAppStore();

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div
        style={{
          padding: 'var(--spacing-lg)',
          backgroundColor: 'var(--color-error)',
          color: 'white',
          borderRadius: 'var(--radius-md)',
        }}
        role="alert"
      >
        Error loading usage accounts. Please try again.
      </div>
    );
  }

  if (!data?.accounts || data.accounts.length === 0) {
    return (
      <div
        style={{
          color: 'var(--color-text-muted)',
          textAlign: 'center',
          padding: 'var(--spacing-lg)',
        }}
      >
        No usage accounts found. Run the usage logger to collect data.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      <div>
        <h3
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
            marginBottom: 'var(--spacing-xs)',
          }}
        >
          Account privacy
        </h3>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
          Select which accounts should appear in the dashboard.
        </p>
      </div>

      <div
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        {data.accounts.map((account, index) => {
          const isLast = index === data.accounts.length - 1;
          const checked = visibleUsageAccounts.includes(account.email);
          return (
            <label
              key={account.email}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--spacing-md)',
                padding: 'var(--spacing-md)',
                borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: 'var(--font-size-base)', color: 'var(--color-text-primary)' }}>
                  {account.email}
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                  Show account usage panel
                </span>
              </div>
              <input
                type="checkbox"
                className="limit-checkbox size-md"
                checked={checked}
                onChange={() => toggleUsageAccount(account.email)}
                aria-label={`Show usage for ${account.email}`}
              />
            </label>
          );
        })}
      </div>

      <p
        style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)',
          fontStyle: 'italic',
        }}
      >
        Unchecked accounts remain hidden on the dashboard.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: '72px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
