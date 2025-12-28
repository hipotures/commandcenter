import { useState, useRef, useEffect } from 'react';
import { Folder, ChevronDown } from 'lucide-react';
import { useProjects } from '../state/queries';
import { useAppStore } from '../state/store';

const tokens = {
  colors: {
    background: '#FAF8F6',
    surface: '#FFFFFF',
    surfaceBorder: '#E8E3DC',
    textPrimary: '#2B1D13',
    textSecondary: '#695947',
    textMuted: '#9C8D7C',
    accentPrimary: '#D97757',
  },
  shadows: {
    lg: '0 10px 40px rgba(43, 29, 19, 0.12)',
  },
};

export const ProjectSelector = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: projectsData } = useProjects();
  const { selectedProjectId, setSelectedProjectId } = useAppStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter visible projects only
  const visibleProjects = projectsData?.projects.filter(p => p.visible) || [];

  // Debug logging
  console.log('[ProjectSelector] Projects data:', projectsData);
  console.log('[ProjectSelector] Visible projects:', visibleProjects);
  console.log('[ProjectSelector] Selected project ID:', selectedProjectId);

  // Get display name
  const getDisplayName = (project: any): string => {
    if (project.name) return project.name;
    // Extract last directory: -home-xai-DEV-command-center → command-center
    const parts = project.project_id.split('-').filter(Boolean);
    return parts[parts.length - 1] || project.project_id;
  };

  // Find selected project
  const selectedProject = visibleProjects.find(p => p.project_id === selectedProjectId);
  const displayText = selectedProject ? getDisplayName(selectedProject) : 'All';

  console.log('[ProjectSelector] Display text:', displayText);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
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
        onMouseEnter={(e) => {
          e.currentTarget.style.background = tokens.colors.surface;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = tokens.colors.background;
        }}
      >
        <Folder size={16} color={tokens.colors.accentPrimary} />
        <span style={{
          fontSize: '14px',
          color: tokens.colors.textSecondary,
          minWidth: '100px',
        }}>
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

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '50px',
            left: 0,
            background: tokens.colors.surface,
            border: `1px solid ${tokens.colors.surfaceBorder}`,
            borderRadius: '12px',
            boxShadow: tokens.shadows.lg,
            zIndex: 1000,
            minWidth: '200px',
            maxHeight: '400px',
            overflowY: 'auto',
          }}
        >
          {/* "All" option */}
          <div
            onClick={() => {
              console.log('[ProjectSelector] Setting to: All (null)');
              setSelectedProjectId(null);
              setIsOpen(false);
            }}
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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = tokens.colors.background;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            All
          </div>

          {/* Project options */}
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
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tokens.colors.background;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {getDisplayName(project)}
            </div>
          ))}

          {/* Empty state */}
          {visibleProjects.length === 0 && (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              fontSize: '13px',
              color: tokens.colors.textMuted,
            }}>
              No projects found
            </div>
          )}
        </div>
      )}
    </div>
  );
};
