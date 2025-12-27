/**
 * Session Details Drawer - shows detailed stats for a specific session
 */
import { useSessionDetails } from '../../state/queries';
import { Drawer } from './Drawer';

interface Props {
  sessionId: string | null;
  onClose: () => void;
}

export function SessionDrawer({ sessionId, onClose }: Props) {
  const { data, isLoading, error } = useSessionDetails(sessionId);

  const formatTokens = (value: number) => {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <Drawer
      isOpen={!!sessionId}
      onClose={onClose}
      title={sessionId ? `Session: ${sessionId.slice(0, 16)}...` : 'Session Details'}
      width="800px"
    >
      {isLoading && <div style={{ color: 'var(--color-text-muted)' }}>Loading...</div>}
      {error && <div style={{ color: 'var(--color-error)' }}>Error loading session details</div>}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
          {/* Metadata */}
          <div>
            <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
              Session Info
            </h3>
            <div
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xs)',
                fontSize: 'var(--font-size-sm)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Model:</span>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>
                  {data.display_name}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Date:</span>
                <span style={{ color: 'var(--color-text-primary)' }}>{data.date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Started:</span>
                <span style={{ color: 'var(--color-text-primary)' }}>
                  {new Date(data.first_time).toLocaleTimeString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Ended:</span>
                <span style={{ color: 'var(--color-text-primary)' }}>
                  {new Date(data.last_time).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div>
            <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
              Totals
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--spacing-md)' }}>
              <StatCard label="Messages" value={data.totals.messages.toLocaleString()} />
              <StatCard label="Tokens" value={formatTokens(data.totals.tokens)} />
              <StatCard label="Input Tokens" value={formatTokens(data.totals.input_tokens)} />
              <StatCard label="Output Tokens" value={formatTokens(data.totals.output_tokens)} />
              <StatCard label="Cache Read" value={formatTokens(data.totals.cache_read)} />
              <StatCard label="Cache Write" value={formatTokens(data.totals.cache_write)} />
            </div>
            <div style={{ marginTop: 'var(--spacing-md)' }}>
              <StatCard label="Total Cost" value={`$${data.totals.cost.toFixed(6)}`} />
            </div>
          </div>

          {/* Messages */}
          <div>
            <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
              Messages ({data.messages.length})
            </h3>
            <div
              style={{
                maxHeight: '400px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-xs)',
              }}
            >
              {data.messages.map((message, index) => (
                <div
                  key={index}
                  style={{
                    padding: 'var(--spacing-sm)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-sm)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      #{index + 1} • {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{message.display_name}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-md)', color: 'var(--color-text-muted)' }}>
                    <span>
                      In: {formatTokens(message.input_tokens)}
                    </span>
                    <span>
                      Out: {formatTokens(message.output_tokens)}
                    </span>
                    {message.cache_read > 0 && (
                      <span style={{ color: 'var(--color-accent-primary)' }}>
                        Cache: {formatTokens(message.cache_read)}
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto' }}>
                      ${message.cost.toFixed(6)}
                    </span>
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
