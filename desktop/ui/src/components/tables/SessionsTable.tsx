import { useState } from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';
import type { SessionsTableProps } from '../../types/dashboard';
import { formatCurrency, formatNumber, truncateId } from '../../lib/format';
import { tokens } from '../../styles/tokens';

export function SessionsTable({ sessions, isExporting = false }: SessionsTableProps) {
  const [sessionLimit, setSessionLimit] = useState('10');
  const visibleSessions = sessions.slice(0, Number(sessionLimit));
  const rows = visibleSessions.flatMap((session) => {
    const modelRows = session.models.map((model) => ({ type: 'model' as const, session, model }));
    return [{ type: 'summary' as const, session }, ...modelRows];
  });
  const headers = ['Session ID', 'Model', 'Date', 'Duration', 'Messages', 'Tokens', 'Cost'];

  return (
    <div
      style={{
        background: tokens.colors.surface,
        border: `1px solid ${tokens.colors.surfaceBorder}`,
        borderRadius: '16px',
        padding: '24px',
        boxShadow: tokens.shadows.md,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: tokens.colors.textPrimary,
            fontSize: '16px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <MessageSquare size={20} style={{ color: tokens.colors.accentPrimary }} />
          Top Sessions by Cost
        </div>
        <div data-export-exclude={isExporting ? 'true' : undefined} style={{ position: 'relative' }}>
          <select
            value={sessionLimit}
            onChange={(event) => setSessionLimit(event.target.value)}
            style={{
              appearance: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 36px 8px 16px',
              borderRadius: '20px',
              border: `1px solid ${tokens.colors.surfaceBorder}`,
              background: 'transparent',
              color: tokens.colors.textSecondary,
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            <option value="10">Show 10</option>
            <option value="25">Show 25</option>
            <option value="50">Show 50</option>
          </select>
          <ChevronDown
            size={14}
            style={{
              position: 'absolute',
              right: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: tokens.colors.textSecondary,
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      <div
        data-export-hide-scrollbar={isExporting ? 'true' : undefined}
        style={{
          overflowX: 'auto',
          scrollbarWidth: isExporting ? 'none' : undefined,
          msOverflowStyle: isExporting ? 'none' : undefined,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
          <thead>
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  style={{
                    textAlign: header === 'Cost' ? 'right' : 'left',
                    padding:
                      header === 'Session ID'
                        ? '12px 6px 12px 16px'
                        : header === 'Model'
                          ? '12px 16px 12px 6px'
                          : '12px 16px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: header === 'Model' ? 'transparent' : tokens.colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: `1px solid ${tokens.colors.surfaceBorder}`,
                  }}
                >
                  {header === 'Model' ? '\u00A0' : header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isSummary = row.type === 'summary';
              const session = row.session;
              const model = isSummary ? null : row.model;
              const isLastRow = idx === rows.length - 1;
              const rowKey = isSummary ? `${session.id}-summary` : `${session.id}-${model?.model ?? 'model'}`;
              const baseBackground = isSummary ? 'var(--color-surface-hover)' : 'transparent';
              const hoverBackground = tokens.colors.background;

              return (
                <tr
                  key={rowKey}
                  style={{
                    transition: 'background 0.15s ease',
                    cursor: 'pointer',
                    background: baseBackground,
                  }}
                  onMouseEnter={(event) => {
                  event.currentTarget.style.background = hoverBackground;
                  }}
                  onMouseLeave={(event) => {
                  event.currentTarget.style.background = baseBackground;
                  }}
                >
                {isSummary ? (
                  <td
                    colSpan={2}
                    style={{
                      padding: '16px 6px 16px 16px',
                      fontSize: '13px',
                      fontFamily: "'DM Mono', monospace",
                      fontWeight: '600',
                      color: tokens.colors.textSecondary,
                      borderBottom: isLastRow ? 'none' : `1px solid ${tokens.colors.surfaceBorder}`,
                    }}
                  >
                    <span
                      title={session.id}
                      style={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {session.id}
                    </span>
                  </td>
                ) : (
                  <td
                    colSpan={2}
                    style={{
                      padding: '16px 16px 16px 36px',
                      borderBottom: isLastRow ? 'none' : `1px solid ${tokens.colors.surfaceBorder}`,
                    }}
                  >
                    {model ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: 'var(--color-accent-primary-15)',
                          color: tokens.colors.accentPrimary,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {model.model}
                      </span>
                    ) : null}
                  </td>
                )}
                <td
                  style={{
                    padding: '16px',
                    fontSize: '13px',
                    color: tokens.colors.textMuted,
                    whiteSpace: 'nowrap',
                    borderBottom: isLastRow ? 'none' : `1px solid ${tokens.colors.surfaceBorder}`,
                  }}
                >
                  {isSummary ? session.date : ''}
                </td>
                <td
                  style={{
                    padding: '16px',
                    fontSize: '13px',
                    color: tokens.colors.textMuted,
                    borderBottom: isLastRow ? 'none' : `1px solid ${tokens.colors.surfaceBorder}`,
                  }}
                >
                  {isSummary ? session.duration : ''}
                </td>
                <td
                  style={{
                    padding: '16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: tokens.colors.textSecondary,
                    borderBottom: isLastRow ? 'none' : `1px solid ${tokens.colors.surfaceBorder}`,
                  }}
                >
                  {isSummary ? session.messages : model?.messages}
                </td>
                <td
                  style={{
                    padding: '16px',
                    fontSize: '14px',
                    color: tokens.colors.textSecondary,
                    borderBottom: isLastRow ? 'none' : `1px solid ${tokens.colors.surfaceBorder}`,
                  }}
                >
                  {formatNumber(isSummary ? session.tokens : model?.tokens ?? 0)}
                </td>
                <td
                  style={{
                    padding: '16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: tokens.colors.semanticSuccess,
                    textAlign: 'right',
                    borderBottom: isLastRow ? 'none' : `1px solid ${tokens.colors.surfaceBorder}`,
                  }}
                >
                  {formatCurrency(isSummary ? session.cost : model?.cost ?? 0)}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
