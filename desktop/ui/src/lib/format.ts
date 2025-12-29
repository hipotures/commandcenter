export const formatNumber = (num: number): string => {
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toLocaleString();
};

export const formatCurrency = (num: number): string => {
  return '$' + num.toFixed(2);
};

export const truncateId = (value: string, max = 15): string => (
  value.length > max ? `${value.slice(0, max)}...` : value
);

export const getProjectDisplayName = (project: { name?: string | null; project_id: string }): string => {
  if (project.name) return project.name;
  const parts = project.project_id.split('-').filter(Boolean);
  return parts[parts.length - 1] || project.project_id;
};
