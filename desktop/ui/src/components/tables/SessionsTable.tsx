import { useState } from 'react';
import { ChevronDown, MessageSquare } from 'lucide-react';
import type { SessionsTableProps } from '../../types/dashboard';
import { formatCurrency, formatNumber, truncateId } from '../../lib/format';
import { tokens } from '../../styles/tokens';

export function SessionsTable({ sessions, isExporting = false }: SessionsTableProps) {
  const [sessionLimit, setSessionLimit] = useState('10');
  const visibleSessions = sessions.slice(0, Number(sessionLimit));

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
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Session ID', 'Model', 'Messages', 'Tokens', 'Cost', 'Date', 'Duration'].map((header) => (
                <th
                  key={header}
                  style={{
                    textAlign: 'left',
                    padding: '12px 16px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: tokens.colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: `1px solid ${tokens.colors.surfaceBorder}`,
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleSessions.map((session, idx) => (
              <tr
                key={session.id}
                style={{
                  transition: 'background 0.15s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = tokens.colors.background;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = 'transparent';
                }}
              >
                <td
                  style={{
                    padding: '16px',
                    fontSize: '13px',
                    fontFamily: "'DM Mono', monospace",
                    color: tokens.colors.textSecondary,
                    borderBottom:
                      idx < visibleSessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
                  }}
                >
                  <span title={session.id}>{truncateId(session.id)}</span>
                </td>
                <td
                  style={{
                    padding: '16px',
                    borderBottom:
                      idx < visibleSessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
                  }}
                >
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
                    {session.model}
                  </span>
                </td>
                <td
                  style={{
                    padding: '16px',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: tokens.colors.textSecondary,
                    borderBottom:
                      idx < visibleSessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
                  }}
                >
                  {session.messages}
                </td>
                <td
                  style={{
                    padding: '16px',
                    fontSize: '14px',
                    color: tokens.colors.textSecondary,
                    borderBottom:
                      idx < visibleSessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
                  }}
                >
                  {formatNumber(session.tokens)}
                </td>
                <td
                  style={{
                    padding: '16px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: tokens.colors.semanticSuccess,
                    borderBottom:
                      idx < visibleSessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
                  }}
                >
                  {formatCurrency(session.cost)}
                </td>
                <td
                  style={{
                    padding: '16px',
                    fontSize: '13px',
                    color: tokens.colors.textMuted,
                    borderBottom:
                      idx < visibleSessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
                  }}
                >
                  {session.date}
                </td>
                <td
                  style={{
                    padding: '16px',
                    fontSize: '13px',
                    color: tokens.colors.textMuted,
                    borderBottom:
                      idx < visibleSessions.length - 1 ? `1px solid ${tokens.colors.surfaceBorder}` : 'none',
                  }}
                >
                  {session.duration}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
