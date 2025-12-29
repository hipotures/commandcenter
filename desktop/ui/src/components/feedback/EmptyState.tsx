import type { EmptyStateProps } from '../../types/dashboard';
import { tokens } from '../../styles/tokens';

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: '12px',
        color: tokens.colors.textMuted,
        background: tokens.colors.background,
        borderRadius: '12px',
        border: `1px dashed ${tokens.colors.surfaceBorder}`,
        padding: '12px',
      }}
    >
      {message}
    </div>
  );
}
