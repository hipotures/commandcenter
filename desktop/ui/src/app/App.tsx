/**
 * Main Application Component
 */
import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from './state/store';
import { useDashboard } from './state/queries';
import './styles/tokens.css';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function Dashboard() {
  const { darkMode, dateFrom, dateTo, granularity, liveMode, liveInterval } =
    useAppStore();

  const { data, isLoading, error, refetch } = useDashboard(
    dateFrom,
    dateTo,
    false,
    granularity
  );

  // Apply dark mode
  useEffect(() => {
    document.documentElement.setAttribute(
      'data-theme',
      darkMode ? 'dark' : 'light'
    );
  }, [darkMode]);

  // Live mode polling
  useEffect(() => {
    if (!liveMode) return;
    const interval = setInterval(() => {
      refetch();
    }, liveInterval * 1000);
    return () => clearInterval(interval);
  }, [liveMode, liveInterval, refetch]);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          color: 'var(--color-text-muted)',
        }}
      >
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 'var(--spacing-lg)',
        }}
      >
        <h2 style={{ color: 'var(--color-error)' }}>Error loading data</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <button
          onClick={() => refetch()}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            backgroundColor: 'var(--color-accent-primary)',
            color: 'white',
            borderRadius: 'var(--radius-md)',
            fontWeight: 'var(--font-weight-semibold)',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ padding: 'var(--spacing-xl)' }}>
      {/* Header */}
      <header
        style={{
          marginBottom: 'var(--spacing-2xl)',
          paddingBottom: 'var(--spacing-lg)',
          borderBottom: '2px solid var(--color-border)',
        }}
      >
        <h1
          style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-accent-primary)',
            marginBottom: 'var(--spacing-sm)',
          }}
        >
          COMMAND CENTER
        </h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Claude Code Usage Dashboard • {data.range.from} - {data.range.to}
        </p>
      </header>

      {/* KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-2xl)',
        }}
      >
        <KPICard
          label="Messages"
          value={data.totals.messages.toLocaleString()}
        />
        <KPICard
          label="Sessions"
          value={data.totals.sessions.toLocaleString()}
        />
        <KPICard
          label="Tokens"
          value={formatTokens(data.totals.tokens)}
        />
        <KPICard label="Cost" value={`$${data.totals.cost.toFixed(2)}`} />
        <KPICard
          label="Streak"
          value={`${data.totals.current_streak}/${data.totals.max_streak}`}
        />
      </div>

      {/* Models */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          padding: 'var(--spacing-lg)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-md)',
          marginBottom: 'var(--spacing-xl)',
        }}
      >
        <h2
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-semibold)',
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-text-primary)',
          }}
        >
          Model Distribution
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {data.model_distribution.slice(0, 5).map((model) => (
            <div
              key={model.model}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--spacing-sm)',
                backgroundColor: 'var(--color-background)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <span style={{ fontWeight: 'var(--font-weight-medium)' }}>
                {model.display_name}
              </span>
              <div style={{ display: 'flex', gap: 'var(--spacing-lg)', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
                  {formatTokens(model.tokens)} tokens
                </span>
                <span style={{ color: 'var(--color-accent-primary)', fontWeight: 'var(--font-weight-semibold)' }}>
                  {model.percent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Sessions */}
      <div
        style={{
          backgroundColor: 'var(--color-surface)',
          padding: 'var(--spacing-lg)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <h2
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-semibold)',
            marginBottom: 'var(--spacing-md)',
            color: 'var(--color-text-primary)',
          }}
        >
          Recent Sessions
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={tableHeaderStyle}>Session ID</th>
                <th style={tableHeaderStyle}>Model</th>
                <th style={tableHeaderStyle}>Messages</th>
                <th style={tableHeaderStyle}>Tokens</th>
                <th style={tableHeaderStyle}>Last Time</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_sessions.slice(0, 10).map((session) => (
                <tr
                  key={session.session_id}
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                >
                  <td style={tableCellStyle}>
                    <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {session.session_id.slice(0, 8)}...
                    </code>
                  </td>
                  <td style={tableCellStyle}>{session.display_name}</td>
                  <td style={tableCellStyle}>{session.messages}</td>
                  <td style={tableCellStyle}>{formatTokens(session.tokens)}</td>
                  <td style={tableCellStyle}>
                    {new Date(session.last_time).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <footer
        style={{
          marginTop: 'var(--spacing-2xl)',
          paddingTop: 'var(--spacing-lg)',
          borderTop: '1px solid var(--color-border)',
          textAlign: 'center',
          color: 'var(--color-text-muted)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        Command Center • Desktop Dashboard • Tauri + React
      </footer>
    </div>
  );
}

// Helper Components
function KPICard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        padding: 'var(--spacing-lg)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-md)',
        transition: 'var(--transition-normal)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div
        style={{
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 'var(--spacing-sm)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 'var(--font-size-3xl)',
          fontWeight: 'var(--font-weight-bold)',
          fontFamily: 'var(--font-family-mono)',
          color: 'var(--color-text-primary)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

// Helper functions
function formatTokens(count: number): string {
  if (count >= 1e9) return `${(count / 1e9).toFixed(1)}B`;
  if (count >= 1e6) return `${(count / 1e6).toFixed(1)}M`;
  if (count >= 1e3) return `${(count / 1e3).toFixed(1)}K`;
  return count.toLocaleString();
}

const tableHeaderStyle: React.CSSProperties = {
  padding: 'var(--spacing-sm) var(--spacing-md)',
  textAlign: 'left',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-semibold)',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const tableCellStyle: React.CSSProperties = {
  padding: 'var(--spacing-sm) var(--spacing-md)',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-secondary)',
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
