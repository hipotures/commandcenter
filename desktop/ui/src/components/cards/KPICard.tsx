import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { KPICardProps } from '../../types/dashboard';
import { tokens } from '../../styles/tokens';

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  accentColor = tokens.colors.accentPrimary,
}: KPICardProps) {
  return (
    <div
      style={{
        background: tokens.colors.surface,
        border: `1px solid ${tokens.colors.surfaceBorder}`,
        borderRadius: '16px',
        padding: '24px',
        filter: tokens.shadows.dropMd,
        transition: 'all 0.3s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = 'translateY(-2px)';
        event.currentTarget.style.filter = tokens.shadows.dropLg;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)';
        event.currentTarget.style.filter = tokens.shadows.dropMd;
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          minHeight: '32px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: tokens.colors.textMuted,
            fontSize: '13px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          <Icon size={16} />
          {title}
        </div>
        {trend !== undefined && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: '600',
              color: trend >= 0 ? tokens.colors.semanticSuccess : tokens.colors.semanticError,
              background: trend >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              padding: '4px 8px',
              borderRadius: '20px',
            }}
          >
            {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: '32px',
          fontWeight: '700',
          color: accentColor,
          fontFamily: "'DM Mono', 'SF Mono', monospace",
          letterSpacing: '-1px',
          textAlign: 'left',
          width: '100%',
        }}
      >
        {value}
      </div>
      {subtitle && (
        <div
          style={{
            fontSize: '13px',
            color: tokens.colors.textMuted,
            marginTop: '8px',
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
}
