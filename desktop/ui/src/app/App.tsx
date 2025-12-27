/**
 * Main Application Component - Full Dashboard with Charts and Drill-down
 */
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAppStore } from './state/store';
import { useDashboard } from './state/queries';
import { Header } from './components/Header';
import { TimelineChart } from './components/charts/TimelineChart';
import { HourlyChart } from './components/charts/HourlyChart';
import { ModelPieChart } from './components/charts/ModelPieChart';
import { Heatmap } from './components/charts/Heatmap';
import { DayDrawer } from './components/drawers/DayDrawer';
import { ModelDrawer } from './components/drawers/ModelDrawer';
import { SessionDrawer } from './components/drawers/SessionDrawer';
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
  const {
    darkMode,
    dateFrom,
    dateTo,
    granularity,
    liveMode,
    liveInterval,
    selectedDay,
    selectedModel,
    selectedSession,
    setSelectedDay,
    setSelectedModel,
    setSelectedSession,
  } = useAppStore();

  const [refresh, setRefresh] = useState(false);
  const { data, isLoading, error, refetch, isFetching } = useDashboard(
    dateFrom,
    dateTo,
    refresh,
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
      setRefresh(true);
      refetch().then(() => setRefresh(false));
    }, liveInterval * 1000);
    return () => clearInterval(interval);
  }, [liveMode, liveInterval, refetch]);

  const handleRefresh = () => {
    setRefresh(true);
    refetch().then(() => setRefresh(false));
  };

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
          onClick={handleRefresh}
          style={{
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            backgroundColor: 'var(--color-accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 'var(--font-weight-semibold)',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ padding: 'var(--spacing-xl)', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Header with controls */}
      <Header onRefresh={handleRefresh} isRefreshing={isFetching} />

      {/* KPI Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--spacing-md)',
          marginBottom: 'var(--spacing-2xl)',
        }}
      >
        <KPICard label="Messages" value={data.totals.messages.toLocaleString()} />
        <KPICard label="Sessions" value={data.totals.sessions.toLocaleString()} />
        <KPICard label="Tokens" value={formatTokens(data.totals.tokens)} />
        <KPICard label="Cost" value={`$${data.totals.cost.toFixed(2)}`} />
        <KPICard
          label="Streak"
          value={`${data.totals.current_streak}/${data.totals.max_streak}`}
        />
      </div>

      {/* Timeline Chart */}
      <Section title="Token Usage Timeline">
        <TimelineChart data={data.timeline.data} granularity={granularity} />
      </Section>

      {/* Two Column Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
          gap: 'var(--spacing-xl)',
          marginBottom: 'var(--spacing-xl)',
        }}
      >
        {/* Hourly Profile */}
        <Section title="24-Hour Activity Profile">
          <HourlyChart data={data.hourly_profile} />
        </Section>

        {/* Model Distribution */}
        <Section title="Model Distribution">
          <ModelPieChart
            data={data.model_distribution}
            onModelClick={(model) => setSelectedModel(model)}
          />
        </Section>
      </div>

      {/* Heatmap */}
      <Section title="Daily Activity Heatmap">
        <Heatmap
          data={Object.entries(data.daily_activity).map(([date, messages]) => ({
            date,
            messages: messages as number,
            tokens: messages as number * 1000, // Approximate tokens
          }))}
          onDayClick={(day) => setSelectedDay(day)}
        />
      </Section>

      {/* Recent Sessions Table */}
      <Section title="Recent Sessions">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={tableHeaderStyle}>Session ID</th>
                <th style={tableHeaderStyle}>Model</th>
                <th style={tableHeaderStyle}>Messages</th>
                <th style={tableHeaderStyle}>Tokens</th>
                <th style={tableHeaderStyle}>Cost</th>
                <th style={tableHeaderStyle}>Last Time</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_sessions.slice(0, 15).map((session) => (
                <tr
                  key={session.session_id}
                  onClick={() => setSelectedSession(session.session_id)}
                  style={{
                    borderBottom: '1px solid var(--color-border)',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td style={tableCellStyle}>
                    <code style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {session.session_id.slice(0, 12)}...
                    </code>
                  </td>
                  <td style={tableCellStyle}>{session.display_name}</td>
                  <td style={tableCellStyle}>{session.messages}</td>
                  <td style={tableCellStyle}>{formatTokens(session.tokens)}</td>
                  <td style={tableCellStyle}>${session.cost.toFixed(4)}</td>
                  <td style={tableCellStyle}>
                    {new Date(session.last_time).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Drawers */}
      <DayDrawer date={selectedDay} onClose={() => setSelectedDay(null)} />
      <ModelDrawer model={selectedModel} onClose={() => setSelectedModel(null)} />
      <SessionDrawer sessionId={selectedSession} onClose={() => setSelectedSession(null)} />

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
        Command Center • {data.range.from} - {data.range.to}
      </footer>
    </div>
  );
}

// Helper Components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
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
        {title}
      </h2>
      {children}
    </div>
  );
}

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
