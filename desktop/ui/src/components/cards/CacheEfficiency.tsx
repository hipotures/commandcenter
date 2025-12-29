import { useState } from 'react';
import { Database } from 'lucide-react';
import type { CacheEfficiencyProps } from '../../types/dashboard';
import { formatNumber } from '../../lib/format';
import { tokens } from '../../styles/tokens';

export function CacheEfficiency({ cacheRead, cacheWrite }: CacheEfficiencyProps) {
  const [hoveredStat, setHoveredStat] = useState<'read' | 'write' | null>(null);
  const safeCacheRead = Number(cacheRead) || 0;
  const safeCacheWrite = Number(cacheWrite) || 0;
  const cacheTotal = safeCacheRead + safeCacheWrite;
  const hitRateValue = cacheTotal > 0 ? (safeCacheRead / cacheTotal) * 100 : 0;
  const hitRate = hitRateValue.toFixed(1);

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
          gap: '8px',
          marginBottom: '20px',
          color: tokens.colors.textPrimary,
          fontSize: '16px',
          fontWeight: '600',
        }}
      >
        <Database size={20} style={{ color: tokens.colors.accentPrimary }} />
        Cache Efficiency
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px 0',
        }}
      >
        <div style={{ position: 'relative', width: '140px', height: '140px' }}>
          <svg width="140" height="140" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="70"
              cy="70"
              r="60"
              fill="none"
              stroke={tokens.colors.surfaceBorder}
              strokeWidth="12"
            />
            <circle
              cx="70"
              cy="70"
              r="60"
              fill="none"
              stroke={
                hoveredStat === 'read'
                  ? tokens.colors.semanticSuccess
                  : hoveredStat === 'write'
                    ? tokens.colors.accentPrimary
                    : tokens.colors.semanticSuccess
              }
              strokeWidth={hoveredStat ? 14 : 12}
              strokeLinecap="round"
              strokeDasharray={`${(hitRateValue / 100) * 377} 377`}
              style={{ transition: 'all 0.3s ease' }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '28px',
                fontWeight: '700',
                color: tokens.colors.semanticSuccess,
                fontFamily: "'DM Mono', monospace",
              }}
            >
              {hitRate}%
            </div>
            <div style={{ fontSize: '11px', color: tokens.colors.textMuted, fontWeight: '500' }}>
              HIT RATE
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div
          onMouseEnter={() => setHoveredStat('read')}
          onMouseLeave={() => setHoveredStat(null)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px',
            background: hoveredStat === 'read' ? tokens.colors.surface : tokens.colors.background,
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            border: `1px solid ${hoveredStat === 'read' ? tokens.colors.semanticSuccess : 'transparent'}`,
            flexWrap: 'nowrap',
          }}
        >
          <span style={{ fontSize: '13px', color: tokens.colors.textMuted, whiteSpace: 'nowrap' }}>
            Cache Read
          </span>
          <span
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: hoveredStat === 'read' ? tokens.colors.semanticSuccess : tokens.colors.accentPrimary,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {formatNumber(cacheRead)} tok
          </span>
        </div>
        <div
          onMouseEnter={() => setHoveredStat('write')}
          onMouseLeave={() => setHoveredStat(null)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px',
            background: hoveredStat === 'write' ? tokens.colors.surface : tokens.colors.background,
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            border: `1px solid ${hoveredStat === 'write' ? tokens.colors.accentPrimary : 'transparent'}`,
            flexWrap: 'nowrap',
          }}
        >
          <span style={{ fontSize: '13px', color: tokens.colors.textMuted, whiteSpace: 'nowrap' }}>
            Cache Write
          </span>
          <span
            style={{
              fontSize: '14px',
              fontWeight: '600',
              color: hoveredStat === 'write' ? tokens.colors.accentPrimary : tokens.colors.accentPrimary,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {formatNumber(cacheWrite)} tok
          </span>
        </div>
      </div>
    </div>
  );
}
