/**
 * Day Details Drawer - shows detailed stats for a specific day
 */
import { useDayDetails } from '../../state/queries';
import { useAppStore } from '../../state/store';
import { Drawer } from './Drawer';
import { HourlyChart } from '../charts/HourlyChart';

interface Props {
  date: string | null;
  onClose: () => void;
}

export function DayDrawer({ date, onClose }: Props) {
  const { selectedProjectId } = useAppStore();
  const { data, isLoading, error } = useDayDetails(date, selectedProjectId);

  const formatTokens = (value: number) => {
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toString();
  };

  return (
    <Drawer isOpen={!!date} onClose={onClose} title={`Day: ${date || ''}`} width="700px">
      {isLoading && <div style={{ color: 'var(--color-text-muted)' }}>Loading...</div>}
      {error && <div style={{ color: 'var(--color-error)' }}>Error loading day details</div>}

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
            </div>
          </div>

          {/* Hourly Activity */}
          <div>
            <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
              Hourly Activity
            </h3>
            <HourlyChart data={data.hourly.map((h) => ({ ...h, input_tokens: 0, output_tokens: 0 }))} />
          </div>

          {/* Models */}
          <div>
            <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
              Models Used
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {data.models.map((model) => (
                <div
                  key={model.model}
                  style={{
                    padding: 'var(--spacing-sm)',
                    backgroundColor: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{model.display_name}</span>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                    {formatTokens(model.tokens)} • {model.messages} msgs
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Sessions */}
          <div>
            <h3 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--color-text-primary)' }}>
              Sessions ({data.sessions.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              {data.sessions.map((session) => (
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
                    <code style={{ color: 'var(--color-text-muted)' }}>
                      {session.session_id.slice(0, 12)}...
                    </code>
                    <span style={{ color: 'var(--color-text-secondary)' }}>{session.display_name}</span>
                  </div>
                  <div style={{ color: 'var(--color-text-muted)' }}>
                    {formatTokens(session.tokens)} • {session.messages} msgs • $
                    {session.cost.toFixed(4)}
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
