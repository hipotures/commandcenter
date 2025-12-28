/**
 * Model Details Drawer - shows detailed stats for a specific model
 */
import { useModelDetails } from '../../state/queries';
import { useAppStore } from '../../state/store';
import { Drawer } from './Drawer';

interface Props {
  model: string | null;
  onClose: () => void;
}

export function ModelDrawer({ model, onClose }: Props) {
  const { dateFrom, dateTo, selectedProjectId } = useAppStore();
  const { data, isLoading, error } = useModelDetails(model, dateFrom, dateTo, selectedProjectId);

  const formatTokens = (value: number) => {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <Drawer
      isOpen={!!model}
      onClose={onClose}
      title={data ? `Model: ${data.display_name}` : 'Model Details'}
      width="700px"
    >
      {isLoading && <div style={{ color: 'var(--color-text-muted)' }}>Loading...</div>}
      {error && <div style={{ color: 'var(--color-error)' }}>Error loading model details</div>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
          {/* Totals */}
          <div>
            <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
              Totals
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-md)' }}>
              <StatCard label="Messages" value={data.totals.messages.toLocaleString()} />
              <StatCard label="Sessions" value={data.totals.sessions.toLocaleString()} />
              <StatCard label="Tokens" value={formatTokens(data.totals.tokens)} />
              <StatCard label="Cost" value={`$${data.totals.cost.toFixed(4)}`} />
              <StatCard label="Input Tokens" value={formatTokens(data.totals.input_tokens)} />
              <StatCard label="Output Tokens" value={formatTokens(data.totals.output_tokens)} />
            </div>
          </div>

          {/* Daily Activity */}
          <div>
            <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
              Daily Activity
            </h3>
            <div
              style={{
                maxHeight: '200px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xs)',
              }}
            >
              {Object.entries(data.daily_activity)
                .reverse()
                .map(([date, stats]) => (
                  <div
                    key={date}
                    style={{
                      padding: 'var(--spacing-sm)',
                      backgroundColor: 'var(--color-surface)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    <span style={{ color: 'var(--color-text-secondary)' }}>{date}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {formatTokens(stats.tokens)} • {stats.messages} msgs
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Top Sessions */}
          <div>
            <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
              Top Sessions
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              {data.sessions.map((session, index) => (
                <div
                  key={session.session_id}
                  style={{
                    padding: 'var(--spacing-sm)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-sm)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
                      <span
                        style={{
                          color: 'var(--color-text-muted)',
                          fontSize: 'var(--font-size-xs)',
                          fontWeight: 'var(--font-weight-semibold)',
                        }}
                      >
                        #{index + 1}
                      </span>
                      <code style={{ color: 'var(--color-text-muted)' }}>
                        {session.session_id.slice(0, 12)}...
                      </code>
                    </div>
                    <span style={{ color: 'var(--color-accent-primary)', fontWeight: 'var(--font-weight-semibold)' }}>
                      {formatTokens(session.tokens)}
                    </span>
                  </div>
                  <div style={{ color: 'var(--color-text-muted)' }}>
                    {session.messages} msgs • ${session.cost.toFixed(4)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 'var(--spacing-md)',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div
        style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)',
          marginBottom: 'var(--spacing-xs)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--color-text-primary)',
        }}
      >
        {value}
      </div>
    </div>
  );
}
