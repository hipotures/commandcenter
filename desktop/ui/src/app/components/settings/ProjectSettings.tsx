/**
 * Project Settings - manage project visibility and metadata
 */
import { useState } from 'react';
import { useProjects, useUpdateProject } from '../../state/queries';
import type { Project } from '../../types/api';
import { Edit2, Check, X } from 'lucide-react';

export function ProjectSettings() {
  const { data, isLoading, error } = useProjects();
  const updateMutation = useUpdateProject();

  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);

  const handleVisibleToggle = (projectId: string, visible: boolean) => {
    console.log('[ProjectSettings] Updating visibility:', { projectId, visible });
    updateMutation.mutate(
      { projectId, visible },
      {
        onError: (err: any) => {
          console.error('[ProjectSettings] Update error:', err);
          const errorMsg = err?.message || err?.toString() || 'Failed to update visibility';
          setLastError(errorMsg);
          setTimeout(() => setLastError(null), 5000);
        },
        onSuccess: (data) => {
          console.log('[ProjectSettings] Update success:', data);
        },
      }
    );
  };

  const startEditing = (project: Project) => {
    setEditingProject(project.project_id);
    setEditedName(project.name);
    setEditedDescription(project.description);
  };

  const saveEditing = (projectId: string) => {
    updateMutation.mutate(
      {
        projectId,
        name: editedName,
        description: editedDescription
      },
      {
        onSuccess: () => {
          setEditingProject(null);
        },
        onError: (err: any) => {
          const errorMsg = err?.message || err?.toString() || 'Failed to update project';
          setLastError(errorMsg);
          setTimeout(() => setLastError(null), 5000);
        },
      }
    );
  };

  const cancelEditing = () => {
    setEditingProject(null);
    setEditedName('');
    setEditedDescription('');
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div
        style={{
          padding: 'var(--spacing-lg)',
          backgroundColor: 'var(--color-error)',
          color: 'white',
          borderRadius: 'var(--radius-md)',
        }}
        role="alert"
      >
        Error loading projects. Please try again.
      </div>
    );
  }

  if (!data?.projects || data.projects.length === 0) {
    return (
      <div
        style={{
          color: 'var(--color-text-muted)',
          textAlign: 'center',
          padding: 'var(--spacing-lg)',
        }}
      >
        No projects found. Run a scan to discover projects.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {/* Error message */}
      {lastError && (
        <div
          style={{
            padding: 'var(--spacing-md)',
            backgroundColor: 'var(--color-error)',
            color: 'white',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
          }}
          role="alert"
        >
          {lastError}
        </div>
      )}

      {/* Projects table */}
      <div style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}>
        {data.projects.map((project, idx) => (
          <ProjectRow
            key={project.project_id}
            project={project}
            isEditing={editingProject === project.project_id}
            editedName={editedName}
            editedDescription={editedDescription}
            onEditedNameChange={setEditedName}
            onEditedDescriptionChange={setEditedDescription}
            onStartEdit={() => startEditing(project)}
            onSave={() => saveEditing(project.project_id)}
            onCancel={cancelEditing}
            onVisibleToggle={(visible) => handleVisibleToggle(project.project_id, visible)}
            isSaving={updateMutation.isPending}
            isLast={idx === data.projects.length - 1}
          />
        ))}
      </div>

      <p style={{
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-muted)',
        fontStyle: 'italic',
      }}>
        Click on project name or edit icon to modify. Use checkbox to toggle visibility.
      </p>
    </div>
  );
}

interface ProjectRowProps {
  project: Project;
  isEditing: boolean;
  editedName: string;
  editedDescription: string;
  onEditedNameChange: (value: string) => void;
  onEditedDescriptionChange: (value: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onVisibleToggle: (visible: boolean) => void;
  isSaving: boolean;
  isLast: boolean;
}

function ProjectRow({
  project,
  isEditing,
  editedName,
  editedDescription,
  onEditedNameChange,
  onEditedDescriptionChange,
  onStartEdit,
  onSave,
  onCancel,
  onVisibleToggle,
  isSaving,
  isLast,
}: ProjectRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (isEditing) {
    // Edit mode: show form
    return (
      <div
        style={{
          padding: 'var(--spacing-md)',
          backgroundColor: 'var(--color-surface)',
          borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {/* Path */}
          <code style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
          }}>
            {project.absolute_path}
          </code>

          {/* Name input */}
          <input
            type="text"
            value={editedName}
            onChange={(e) => onEditedNameChange(e.target.value)}
            placeholder="Project name..."
            maxLength={100}
            autoFocus
            style={{
              padding: 'var(--spacing-sm)',
              border: '1px solid var(--color-accent-primary)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-medium)',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
          />

          {/* Description input */}
          <input
            type="text"
            value={editedDescription}
            onChange={(e) => onEditedDescriptionChange(e.target.value)}
            placeholder="Description..."
            maxLength={500}
            style={{
              padding: 'var(--spacing-sm)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--font-size-xs)',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text-secondary)',
            }}
          />

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
            <button
              onClick={onCancel}
              disabled={isSaving}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'transparent',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--font-size-xs)',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <X size={14} />
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={isSaving}
              style={{
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-accent-primary)',
                color: 'white',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-medium)',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Check size={14} />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Display mode: compact row
  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        padding: 'var(--spacing-sm) var(--spacing-md)',
        backgroundColor: isHovered ? 'var(--color-surface-hover)' : 'transparent',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
        transition: 'background-color var(--transition-fast)',
        display: 'grid',
        gridTemplateColumns: '24px 1fr auto',
        gap: 'var(--spacing-md)',
        alignItems: 'center',
        minHeight: '48px',
      }}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        className="limit-checkbox size-md"
        checked={project.visible}
        onChange={(e) => onVisibleToggle(e.target.checked)}
        style={{
          cursor: 'pointer',
          width: '16px',
          height: '16px',
        }}
        aria-label={`Toggle visibility for ${project.name || project.absolute_path}`}
      />

      {/* Project info - clickable to edit */}
      <div
        onClick={onStartEdit}
        style={{
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          minWidth: 0,
        }}
      >
        <div style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--color-text-primary)',
        }}>
          {project.name || <span style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>Unnamed project</span>}
        </div>
        {project.description && (
          <div style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {project.description}
          </div>
        )}
        <code style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-tertiary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {project.absolute_path}
        </code>
      </div>

      {/* Edit button - visible on hover */}
      <button
        onClick={onStartEdit}
        style={{
          padding: 'var(--spacing-xs)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: 'transparent',
          color: 'var(--color-text-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          opacity: isHovered ? 1 : 0,
          transition: 'opacity var(--transition-fast)',
        }}
        aria-label="Edit project"
      >
        <Edit2 size={14} />
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: '140px',
            backgroundColor: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
