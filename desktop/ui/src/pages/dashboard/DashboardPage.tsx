import { useRef, useState } from 'react';
import { Coins, Flame, MessageSquare, Users, Zap } from 'lucide-react';
import { ActivityHeatmap } from '../../components/charts/ActivityHeatmap';
import { ActivityTimeline } from '../../components/charts/ActivityTimeline';
import { DailyPatterns } from '../../components/charts/DailyPatterns';
import { HourlyPatterns } from '../../components/charts/HourlyPatterns';
import { ModelDistribution } from '../../components/charts/ModelDistribution';
import { CacheEfficiency } from '../../components/cards/CacheEfficiency';
import { KPICard } from '../../components/cards/KPICard';
import { SessionsTable } from '../../components/tables/SessionsTable';
import { useExportPng } from '../../features/export-dashboard/useExportPng';
import { formatCurrency, formatNumber, getProjectDisplayName } from '../../lib/format';
import { formatDateTimeForDisplay } from '../../lib/date';
import { calculateGranularity } from '../../lib/time';
import { useDashboard, useLimitResets, useProjects, useUsageAccounts } from '../../state/queries';
import { useAppStore } from '../../state/store';
import { tokens } from '../../styles/tokens';
import { DashboardHeader } from './components/DashboardHeader';
import { SettingsDrawer } from './components/SettingsDrawer';
import { UsageAccountsPanel } from './components/UsageAccountsPanel';
import { useDashboardViewModel } from './useDashboardViewModel';

export function DashboardPage() {
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-01-01`;
  const [shouldRefresh, setShouldRefresh] = useState(false);
  const dashboardRef = useRef<HTMLElement | null>(null);

  const {
    settingsOpen,
    toggleSettings,
    selectedProjectId,
    dateFrom,
    dateTo,
    visibleUsageAccounts,
    dateTimeFormat,
  } = useAppStore();
  const dateRange = { from: dateFrom, to: dateTo };

  console.log('[DashboardContent] selectedProjectId:', selectedProjectId);
  console.log('[DashboardContent] selectedProjectId from store:', selectedProjectId);

  const granularity = calculateGranularity(dateRange.from, dateRange.to);

  const { data: apiData, isLoading, error } = useDashboard(
    dateRange.from,
    dateRange.to,
    shouldRefresh,
    granularity,
    selectedProjectId
  );
  const { data: projectsData } = useProjects();
  const { data: limitResets } = useLimitResets(dateRange.from, dateRange.to, true);
  const {
    data: usageAccountsData,
    isLoading: usageAccountsLoading,
    error: usageAccountsError,
  } = useUsageAccounts();

  const viewModel = useDashboardViewModel(apiData);
  const { isExporting, exportPng } = useExportPng({ dashboardRef });

  const handleRefresh = () => {
    setShouldRefresh(true);
    setTimeout(() => setShouldRefresh(false), 100);
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: tokens.colors.background,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: '600', color: tokens.colors.textPrimary }}>
          Loading Dashboard...
        </div>
      </div>
    );
  }

  if (error || !viewModel) {
    const errorMessage = (error as { message?: string } | null)?.message || 'Failed to load data';
    return (
      <div
        style={{
          minHeight: '100vh',
          background: tokens.colors.background,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: '600', color: tokens.colors.semanticError }}>
          Error: {errorMessage}
        </div>
      </div>
    );
  }

  const visibleProjects = projectsData?.projects.filter((project) => project.visible) || [];
  const selectedProject = visibleProjects.find((project) => project.project_id === selectedProjectId);
  const projectLabel = selectedProject
    ? getProjectDisplayName(selectedProject)
    : selectedProjectId
      ? getProjectDisplayName({ project_id: selectedProjectId })
      : 'All Projects';

  const usageAccounts = usageAccountsData?.accounts ?? [];
  const selectedUsageAccounts = usageAccounts.filter((account) =>
    visibleUsageAccounts.includes(account.email)
  );
  const usageErrorMessage =
    (usageAccountsError as { message?: string } | null)?.message || null;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: tokens.colors.background,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <DashboardHeader
        defaultFrom={defaultFrom}
        dataRange={viewModel.meta.dataRange}
        firstSessionDate={viewModel.meta.firstSessionDate}
        onRefresh={handleRefresh}
        onExport={exportPng}
        onOpenSettings={toggleSettings}
      />

      <main
        ref={dashboardRef}
        data-exporting={isExporting ? 'true' : undefined}
        style={{
          maxWidth: '1600px',
          margin: '0 auto',
          padding: '32px',
        }}
      >
        {isExporting && (
          <style>
            {`
              [data-export-hide-scrollbar]::-webkit-scrollbar {
                width: 0 !important;
                height: 0 !important;
              }
              [data-exporting='true'] .recharts-tooltip-wrapper,
              [data-exporting='true'] .recharts-tooltip-cursor {
                display: none !important;
              }
            `}
          </style>
        )}
        {isExporting && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(320px, 1fr) auto',
              alignItems: 'center',
              gap: '24px',
              padding: '22px 26px',
              borderRadius: '18px',
              background: `linear-gradient(135deg, ${tokens.colors.surface}, ${tokens.colors.background})`,
              border: `1px solid ${tokens.colors.surfaceBorder}`,
              boxShadow: tokens.shadows.md,
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: `linear-gradient(135deg, ${tokens.colors.accentPrimary}, ${tokens.colors.accentSecondary})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Zap size={22} color={tokens.colors.surface} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: tokens.colors.textPrimary,
                    letterSpacing: '-0.4px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Command Center
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: tokens.colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Claude Code Analytics Dashboard
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                alignItems: 'center',
                flexWrap: 'nowrap',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '999px',
                  border: `1px solid ${tokens.colors.surfaceBorder}`,
                  background: tokens.colors.background,
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: tokens.colors.textMuted,
                  }}
                >
                  Projects
                </span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: tokens.colors.textPrimary }}>
                  {projectLabel}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '999px',
                  border: `1px solid ${tokens.colors.surfaceBorder}`,
                  background: tokens.colors.background,
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: tokens.colors.textMuted,
                  }}
                >
                  Date range
                </span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: tokens.colors.textPrimary }}>
                  {dateRange.from} → {dateRange.to}
                </span>
              </div>
            </div>
          </div>
        )}
        <UsageAccountsPanel
          accounts={selectedUsageAccounts}
          hasSelection={visibleUsageAccounts.length > 0}
          isLoading={usageAccountsLoading}
          errorMessage={usageErrorMessage}
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '20px',
            marginBottom: '32px',
          }}
        >
          <KPICard
            title="Messages"
            value={formatNumber(viewModel.totals.messages)}
            subtitle="Total API calls"
            trend={viewModel.trends.messages}
            icon={MessageSquare}
          />
          <KPICard
            title="Sessions"
            value={formatNumber(viewModel.totals.sessions)}
            subtitle="Unique sessions"
            trend={viewModel.trends.sessions}
            icon={Users}
          />
          <KPICard
            title="Tokens"
            value={formatNumber(viewModel.totals.tokens)}
            subtitle="Total processed"
            trend={viewModel.trends.tokens}
            icon={Zap}
          />
          <KPICard
            title="Cost"
            value={formatCurrency(viewModel.totals.cost)}
            subtitle="Usage charges"
            trend={viewModel.trends.cost}
            icon={Coins}
          />
          <KPICard
            title="Streak"
            value={`${viewModel.totals.currentStreak}d`}
            subtitle={`Max: ${viewModel.totals.maxStreak}d`}
            trend={undefined}
            icon={Flame}
            accentColor={tokens.colors.semanticWarning}
          />
        </div>

        <div style={{ marginBottom: '32px' }}>
          <ActivityTimeline
            data={viewModel.timelineData}
            granularity={granularity}
            limitResets={limitResets || []}
            isExporting={isExporting}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '32px',
          }}
        >
          <ModelDistribution data={viewModel.modelData} isExporting={isExporting} />
          <CacheEfficiency cacheRead={viewModel.totals.cacheRead} cacheWrite={viewModel.totals.cacheWrite} />
        </div>

        <div style={{ marginBottom: '32px' }}>
          <ActivityHeatmap
            data={viewModel.heatmapActivity}
            heatmapFrom={viewModel.heatmapRange.from}
            heatmapTo={viewModel.heatmapRange.to}
            selectedFrom={dateRange.from}
            selectedTo={dateRange.to}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            marginBottom: '32px',
          }}
        >
          <HourlyPatterns data={viewModel.hourlyData} isExporting={isExporting} />
          <DailyPatterns data={viewModel.dailyData} isExporting={isExporting} />
        </div>

        <SessionsTable sessions={viewModel.sessions} isExporting={isExporting} />

        <footer
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '40px',
            padding: '20px 0',
            borderTop: `1px solid ${tokens.colors.surfaceBorder}`,
            gap: '16px',
          }}
        >
          <div style={{ fontSize: '13px', color: tokens.colors.textMuted, flex: '1 1 60%', minWidth: 0 }}>
            <span>Last updated: {formatDateTimeForDisplay(new Date(), dateTimeFormat)}</span>
            <span data-export-exclude="true"> • DB Size: 52.3 MB • </span>
            <span data-export-exclude="true" style={{ color: tokens.colors.semanticSuccess, marginLeft: '8px' }}>
              ● Connected
            </span>
          </div>
          <div style={{ fontSize: '13px', color: tokens.colors.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>
            Command Center{viewModel.meta.appVersion ? ` v${viewModel.meta.appVersion}` : ''} • Powered by Claude Code
          </div>
        </footer>
      </main>

      <SettingsDrawer isOpen={settingsOpen} onClose={toggleSettings} />
    </div>
  );
}
