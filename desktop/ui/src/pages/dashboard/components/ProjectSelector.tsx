import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Folder } from 'lucide-react';
import { getProjectDisplayName } from '../../../lib/format';
import { useProjects } from '../../../state/queries';
import { useAppStore } from '../../../state/store';
import { tokens } from '../../../styles/tokens';

export function ProjectSelector() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: projectsData } = useProjects();
  const { selectedProjectId, setSelectedProjectId } = useAppStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const visibleProjects = projectsData?.projects.filter((project) => project.visible) || [];

  console.log('[ProjectSelector] Projects data:', projectsData);
  console.log('[ProjectSelector] Visible projects:', visibleProjects);
  console.log('[ProjectSelector] Selected project ID:', selectedProjectId);

  const selectedProject = visibleProjects.find((project) => project.project_id === selectedProjectId);
  const allProjectsLabel = 'All Projects';
  const allProjectsTooltip = 'Select project filter';
  const displayText = selectedProject ? getProjectDisplayName(selectedProject) : allProjectsLabel;

  console.log('[ProjectSelector] Display text:', displayText);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        title={selectedProject ? getProjectDisplayName(selectedProject) : allProjectsTooltip}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          background: tokens.colors.background,
          borderRadius: '10px',
          border: `1px solid ${tokens.colors.surfaceBorder}`,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = tokens.colors.surface;
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = tokens.colors.background;
        }}
      >
        <Folder size={16} color={tokens.colors.accentPrimary} />
        <span
          style={{
            fontSize: '14px',
            color: tokens.colors.textSecondary,
            minWidth: '100px',
          }}
        >
          {displayText}
        </span>
        <ChevronDown
          size={14}
          color={tokens.colors.textMuted}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s ease',
          }}
        />
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '50px',
            left: 0,
            background: tokens.colors.surface,
            border: `1px solid ${tokens.colors.surfaceBorder}`,
            borderRadius: '12px',
            filter: tokens.shadows.dropLg,
            zIndex: 1000,
            minWidth: '200px',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          <div
            onClick={() => {
              console.log('[ProjectSelector] Setting to: All (null)');
              setSelectedProjectId(null);
              setIsOpen(false);
            }}
            title={allProjectsTooltip}
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              color: selectedProjectId === null
                ? tokens.colors.accentPrimary
                : tokens.colors.textSecondary,
              fontWeight: selectedProjectId === null ? '600' : '400',
              borderBottom: `1px solid ${tokens.colors.surfaceBorder}`,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = tokens.colors.background;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent';
            }}
          >
            {allProjectsLabel}
          </div>

          {visibleProjects.map((project) => (
            <div
              key={project.project_id}
              onClick={() => {
                console.log('[ProjectSelector] Setting to:', project.project_id);
                setSelectedProjectId(project.project_id);
                setIsOpen(false);
              }}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                color: selectedProjectId === project.project_id
                  ? tokens.colors.accentPrimary
                  : tokens.colors.textSecondary,
                fontWeight: selectedProjectId === project.project_id ? '600' : '400',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = tokens.colors.background;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent';
              }}
            >
              {getProjectDisplayName(project)}
            </div>
          ))}

          {visibleProjects.length === 0 && (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                fontSize: '13px',
                color: tokens.colors.textMuted,
              }}
            >
              No projects found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
