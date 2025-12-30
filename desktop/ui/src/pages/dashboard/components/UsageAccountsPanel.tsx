import type { UsageAccount } from '../../../types/api';
import { formatUsageValue, maskEmail } from '../../../lib/format';
import { formatDateTimeForDisplay } from '../../../lib/date';
import { useAppStore } from '../../../state/store';
import { tokens } from '../../../styles/tokens';

interface UsageAccountsPanelProps {
  accounts: UsageAccount[];
  hasSelection: boolean;
  isLoading?: boolean;
  errorMessage?: string | null;
  isExporting?: boolean;
}

export function UsageAccountsPanel({
  accounts,
  hasSelection,
  isLoading = false,
  errorMessage = null,
  isExporting = false,
}: UsageAccountsPanelProps) {
  const { dateTimeFormat } = useAppStore();

  const formatResetTime = (localValue?: string | null, rawValue?: string | null): string => {
    if (localValue) {
      return formatDateTimeForDisplay(localValue, dateTimeFormat) || localValue;
    }
    if (rawValue) {
      return rawValue;
    }
    return '—';
  };

  const formatSnapshotTime = (value?: string | null): string => {
    if (!value) {
      return '—';
    }
    return formatDateTimeForDisplay(value, dateTimeFormat) || value;
  };
  if (!hasSelection) {
    return null;
  }

  const latestSnapshotLabel = (() => {
    const timestamps = accounts
      .map((account) => account.captured_at_local)
      .filter((value): value is string => Boolean(value))
      .map((value) => ({ raw: value, parsed: new Date(value) }))
      .filter((entry) => !Number.isNaN(entry.parsed.getTime()))
      .sort((a, b) => b.parsed.getTime() - a.parsed.getTime());

    if (timestamps.length > 0) {
      return formatDateTimeForDisplay(timestamps[0].parsed, dateTimeFormat) || timestamps[0].raw;
    }

    const fallback = accounts.find((account) => account.captured_at_local)?.captured_at_local;
    return formatSnapshotTime(fallback ?? null);
  })();

  const content = (() => {
    if (isLoading) {
      return (
        <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>
          Loading account usage...
        </div>
      );
    }

    if (errorMessage) {
      return (
        <div style={{ color: tokens.colors.semanticError, fontSize: '13px' }}>
          {errorMessage}
        </div>
      );
    }

    if (accounts.length === 0) {
      return (
        <div style={{ color: tokens.colors.textMuted, fontSize: '13px' }}>
          No usage data for selected accounts.
        </div>
      );
    }

    return (
      <div
        data-export-hide-scrollbar={isExporting ? 'true' : undefined}
        style={{
          overflowX: 'auto',
          scrollbarWidth: isExporting ? 'none' : undefined,
          msOverflowStyle: isExporting ? 'none' : undefined,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 2fr) minmax(110px, 0.8fr) minmax(110px, 0.8fr) minmax(170px, 1fr)',
            gap: '12px',
            minWidth: '560px',
            padding: '10px 0',
            borderBottom: `1px solid ${tokens.colors.surfaceBorder}`,
            color: tokens.colors.textMuted,
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
          }}
        >
          <div>Account</div>
          <div>5h usage</div>
          <div>Week usage</div>
          <div>Week reset</div>
        </div>
        {accounts.map((account) => (
          <div
            key={account.email}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(220px, 2fr) minmax(110px, 0.8fr) minmax(110px, 0.8fr) minmax(170px, 1fr)',
              gap: '12px',
              minWidth: '560px',
              padding: '12px 0',
              borderBottom: `1px solid ${tokens.colors.surfaceBorder}`,
              color: tokens.colors.textPrimary,
              fontSize: '14px',
            }}
          >
            <div style={{ fontWeight: 600 }}>{maskEmail(account.email)}</div>
            <div>{formatUsageValue(account.current_session_used_pct, account.current_session_used_raw)}</div>
            <div>{formatUsageValue(account.current_week_used_pct, account.current_week_used_raw)}</div>
            <div>{formatResetTime(account.current_week_resets_local, account.current_week_resets_raw)}</div>
          </div>
        ))}
      </div>
    );
  })();

  return (
    <section
      style={{
        marginBottom: '24px',
        padding: '20px 24px',
        borderRadius: '18px',
        background: tokens.colors.surface,
        border: `1px solid ${tokens.colors.surfaceBorder}`,
        filter: tokens.shadows.dropMd,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '15px', fontWeight: 700, color: tokens.colors.textPrimary }}>
          Account usage
        </div>
        <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>
          {latestSnapshotLabel}
        </div>
      </div>
      {content}
    </section>
  );
}
