import { AlertTriangle } from 'lucide-react';
import { tokens } from '../../../styles/tokens';

interface RangeNoticeProps {
  message: string;
  isVisible: boolean;
}

export function RangeNotice({ message, isVisible }: RangeNoticeProps) {
  return (
    <div
      data-export-exclude="true"
      style={{
        position: 'fixed',
        top: '96px',
        right: '16px',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '12px',
        background: `linear-gradient(135deg, ${tokens.colors.background}, ${tokens.colors.surface})`,
        border: `1px solid ${tokens.colors.surfaceBorder}`,
        boxShadow: tokens.shadows.md,
        color: tokens.colors.textSecondary,
        width: 'min(420px, calc(100vw - 32px))',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0)' : 'translateX(120%)',
        transition: 'opacity 0.7s ease, transform 0.85s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'transform, opacity',
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '10px',
          background: 'var(--color-accent-primary-10)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <AlertTriangle size={16} color={tokens.colors.semanticWarning} />
      </div>
      <div style={{ fontSize: '13px' }}>{message}</div>
    </div>
  );
}
