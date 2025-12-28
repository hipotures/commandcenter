/**
 * Settings Drawer - configuration panel with tabs
 */
import { useState } from 'react';
import { Drawer } from './Drawer';
import { ProjectSettings } from '../settings/ProjectSettings';
import { ThemeSettings } from '../settings/ThemeSettings';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type TabId = 'projects' | 'theme';

export function SettingsDrawer({ isOpen, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('projects');

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Settings" width="700px">
      {/* Tabs navigation */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-sm)',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 'var(--spacing-lg)',
        }}
        role="tablist"
      >
        <TabButton
          active={activeTab === 'projects'}
          onClick={() => setActiveTab('projects')}
          role="tab"
          aria-selected={activeTab === 'projects'}
        >
          Projects
        </TabButton>
        <TabButton
          active={activeTab === 'theme'}
          onClick={() => setActiveTab('theme')}
          role="tab"
          aria-selected={activeTab === 'theme'}
        >
          Theme
        </TabButton>
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {activeTab === 'projects' && <ProjectSettings />}
        {activeTab === 'theme' && <ThemeSettings />}
      </div>
    </Drawer>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  role?: string;
  'aria-selected'?: boolean;
}

function TabButton({ active, onClick, children, ...props }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: 'var(--spacing-md)',
        border: 'none',
        backgroundColor: 'transparent',
        color: active ? 'var(--color-accent-primary)' : 'var(--color-text-muted)',
        fontSize: 'var(--font-size-base)',
        fontWeight: active ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
        cursor: 'pointer',
        borderBottom: active ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
        transition: 'all var(--transition-fast)',
      }}
      {...props}
    >
      {children}
    </button>
  );
}
