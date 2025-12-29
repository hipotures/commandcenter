export const toDateMs = (value: string): number => new Date(value).getTime();

export const normalizeDateString = (value: string): string => value.split('T')[0].split(' ')[0];

export const formatDate = (date: Date): string => date.toISOString().split('T')[0];

export const formatDateHour = (value: string): string => {
  if (!value) {
    return '';
  }
  const match = value.match(/(\d{4}-\d{2}-\d{2}).*?(\d{2}):/);
  if (!match) {
    return normalizeDateString(value);
  }
  return `${match[1]} ${match[2]}:00`;
};

export const startOfDay = (timestamp: number): number => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};
