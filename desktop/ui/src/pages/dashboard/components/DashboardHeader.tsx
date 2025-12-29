import { Download, RefreshCw, Settings, Zap } from 'lucide-react';
import { DateRangePicker } from '../../../features/date-range/DateRangePicker';
import type { DashboardDataRange } from '../../../types/dashboard';
import { tokens } from '../../../styles/tokens';
import { ProjectSelector } from './ProjectSelector';

interface DashboardHeaderProps {
  defaultFrom: string;
  dataRange?: DashboardDataRange;
  firstSessionDate?: string | null;
  onRefresh: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
}

export function DashboardHeader({
  defaultFrom,
  dataRange,
  firstSessionDate,
  onRefresh,
  onExport,
  onOpenSettings,
}: DashboardHeaderProps) {
  return (
    <header
      style={{
        background: tokens.colors.surface,
        borderBottom: `1px solid ${tokens.colors.surfaceBorder}`,
        padding: '16px 32px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '1600px',
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${tokens.colors.accentPrimary}, ${tokens.colors.accentSecondary})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={22} color={tokens.colors.surface} />
          </div>
          <div>
            <h1
              style={{
                fontSize: '20px',
                fontWeight: '700',
                color: tokens.colors.textPrimary,
                margin: 0,
                letterSpacing: '-0.5px',
              }}
            >
              Command Center
            </h1>
            <p
              style={{
                fontSize: '13px',
                color: tokens.colors.textMuted,
                margin: 0,
              }}
            >
              Claude Code Analytics Dashboard
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ProjectSelector />

          <DateRangePicker
            defaultFrom={defaultFrom}
            dataRange={dataRange}
            firstSessionDate={firstSessionDate}
          />

          <button
            onClick={onRefresh}
            title="Refresh data"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              border: `1px solid ${tokens.colors.surfaceBorder}`,
              background: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = tokens.colors.background;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent';
            }}
          >
            <RefreshCw size={18} color={tokens.colors.textMuted} />
          </button>
          <button
            onClick={onExport}
            title="Download PNG report"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              border: `1px solid ${tokens.colors.surfaceBorder}`,
              background: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = tokens.colors.background;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent';
            }}
          >
            <Download size={18} color={tokens.colors.textMuted} />
          </button>
          <button
            onClick={onOpenSettings}
            title="Open settings"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              border: `1px solid ${tokens.colors.surfaceBorder}`,
              background: 'transparent',
              cursor: 'pointer',
            }}
            aria-label="Open settings"
          >
            <Settings size={18} color={tokens.colors.textMuted} />
          </button>
        </div>
      </div>
    </header>
  );
}
