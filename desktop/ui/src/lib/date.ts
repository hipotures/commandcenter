export type DateFormatPart = 'year' | 'month' | 'day';

export type DateFormatId =
  | 'ymd-dash'
  | 'dmy-dash'
  | 'dmy-dot'
  | 'dmy-slash'
  | 'mdy-slash'
  | 'ymd-slash';

export type DateFormatOption = {
  id: DateFormatId;
  label: string;
  order: DateFormatPart[];
  separator: string;
  dateFnsFormat: string;
};

export const DEFAULT_DATE_FORMAT: DateFormatId = 'ymd-dash';

export const DATE_FORMAT_OPTIONS: DateFormatOption[] = [
  {
    id: 'ymd-dash',
    label: 'YYYY-MM-DD',
    order: ['year', 'month', 'day'],
    separator: '-',
    dateFnsFormat: 'yyyy-MM-dd',
  },
  {
    id: 'dmy-dash',
    label: 'DD-MM-YYYY',
    order: ['day', 'month', 'year'],
    separator: '-',
    dateFnsFormat: 'dd-MM-yyyy',
  },
  {
    id: 'dmy-dot',
    label: 'DD.MM.YYYY',
    order: ['day', 'month', 'year'],
    separator: '.',
    dateFnsFormat: 'dd.MM.yyyy',
  },
  {
    id: 'dmy-slash',
    label: 'DD/MM/YYYY',
    order: ['day', 'month', 'year'],
    separator: '/',
    dateFnsFormat: 'dd/MM/yyyy',
  },
  {
    id: 'mdy-slash',
    label: 'MM/DD/YYYY',
    order: ['month', 'day', 'year'],
    separator: '/',
    dateFnsFormat: 'MM/dd/yyyy',
  },
  {
    id: 'ymd-slash',
    label: 'YYYY/MM/DD',
    order: ['year', 'month', 'day'],
    separator: '/',
    dateFnsFormat: 'yyyy/MM/dd',
  },
];

const DATE_FORMAT_LOOKUP = new Map<DateFormatId, DateFormatOption>(
  DATE_FORMAT_OPTIONS.map((option) => [option.id, option])
);

type DateParts = {
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
};

const pad2 = (value: number) => value.toString().padStart(2, '0');

const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2})(?::(\d{2})(?::(\d{2}))?)?)?/;
const TIME_ONLY_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;
const HAS_TZ_PATTERN = /[zZ]|[+-]\d{2}:?\d{2}$/;

const parseDateParts = (value: string | Date): DateParts | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
      hour: value.getHours(),
      minute: value.getMinutes(),
      second: value.getSeconds(),
    };
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (HAS_TZ_PATTERN.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        year: parsed.getFullYear(),
        month: parsed.getMonth() + 1,
        day: parsed.getDate(),
        hour: parsed.getHours(),
        minute: parsed.getMinutes(),
        second: parsed.getSeconds(),
      };
    }
  }

  const dateMatch = trimmed.match(DATE_TIME_PATTERN);
  if (dateMatch) {
    const year = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const day = Number(dateMatch[3]);
    const hour = dateMatch[4] !== undefined ? Number(dateMatch[4]) : undefined;
    const minute = dateMatch[5] !== undefined ? Number(dateMatch[5]) : undefined;
    const second = dateMatch[6] !== undefined ? Number(dateMatch[6]) : undefined;

    if ([year, month, day].some((part) => Number.isNaN(part))) {
      return null;
    }

    return {
      year,
      month,
      day,
      hour: Number.isNaN(hour ?? NaN) ? undefined : hour,
      minute: Number.isNaN(minute ?? NaN) ? undefined : minute,
      second: Number.isNaN(second ?? NaN) ? undefined : second,
    };
  }

  const timeMatch = trimmed.match(TIME_ONLY_PATTERN);
  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    const second = timeMatch[3] !== undefined ? Number(timeMatch[3]) : undefined;
    if ([hour, minute].some((part) => Number.isNaN(part))) {
      return null;
    }
    return {
      hour,
      minute,
      second: Number.isNaN(second ?? NaN) ? undefined : second,
    };
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return {
      year: parsed.getFullYear(),
      month: parsed.getMonth() + 1,
      day: parsed.getDate(),
      hour: parsed.getHours(),
      minute: parsed.getMinutes(),
      second: parsed.getSeconds(),
    };
  }

  return null;
};

const formatDateParts = (
  parts: DateParts,
  formatId: DateFormatId,
  includeParts: DateFormatPart[]
): string | null => {
  const option = DATE_FORMAT_LOOKUP.get(formatId) ?? DATE_FORMAT_OPTIONS[0];
  const resolvedParts = option.order.filter((part) => includeParts.includes(part));
  if (resolvedParts.length === 0) {
    return null;
  }

  const values: Record<DateFormatPart, string> = {
    year: parts.year !== undefined ? String(parts.year) : '',
    month: parts.month !== undefined ? pad2(parts.month) : '',
    day: parts.day !== undefined ? pad2(parts.day) : '',
  };

  if (resolvedParts.some((part) => !values[part])) {
    return null;
  }

  return resolvedParts.map((part) => values[part]).join(option.separator);
};

export const getDateFormatOption = (formatId: DateFormatId): DateFormatOption =>
  DATE_FORMAT_LOOKUP.get(formatId) ?? DATE_FORMAT_OPTIONS[0];

export const formatDateForDisplay = (
  value: string | Date,
  formatId: DateFormatId,
  includeParts: DateFormatPart[] = ['year', 'month', 'day']
): string => {
  if (!value) {
    return '';
  }
  const parts = parseDateParts(value);
  if (!parts) {
    return typeof value === 'string' ? value : '';
  }
  const formatted = formatDateParts(parts, formatId, includeParts);
  if (!formatted) {
    return typeof value === 'string' ? value : '';
  }
  return formatted;
};

export const formatTimeForDisplay = (
  value: string | Date,
  options: { includeSeconds?: boolean } = {}
): string => {
  const parts = parseDateParts(value);
  if (!parts || parts.hour === undefined || parts.minute === undefined) {
    return '';
  }
  const hours = pad2(parts.hour);
  const minutes = pad2(parts.minute);
  if (options.includeSeconds) {
    const seconds = pad2(parts.second ?? 0);
    return `${hours}:${minutes}:${seconds}`;
  }
  return `${hours}:${minutes}`;
};

export const formatDateTimeForDisplay = (
  value: string | Date,
  formatId: DateFormatId,
  options: { includeSeconds?: boolean } = {}
): string => {
  const date = formatDateForDisplay(value, formatId);
  if (!date) {
    return '';
  }
  const time = formatTimeForDisplay(value, options);
  if (!time) {
    return date;
  }
  return `${date} ${time}`;
};

export const formatDateHourForDisplay = (value: string | Date, formatId: DateFormatId): string => {
  const date = formatDateForDisplay(value, formatId);
  if (!date) {
    return '';
  }
  const parts = parseDateParts(value);
  if (!parts || parts.hour === undefined) {
    return date;
  }
  return `${date} ${pad2(parts.hour)}:00`;
};

export const toDateMs = (value: string): number => new Date(value).getTime();

export const normalizeDateString = (value: string): string => value.split('T')[0].split(' ')[0];

export const formatDate = (date: Date): string => date.toISOString().split('T')[0];

export const startOfDay = (timestamp: number): number => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};
