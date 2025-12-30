export type DateFormatVariant = 'full' | 'month-year';

export type DateFormatId =
  | 'ymd-dash'
  | 'dmy-dot'
  | 'dmy-slash'
  | 'dmy-dash'
  | 'mdy-slash'
  | 'ymd-slash'
  | 'd-mmm-yyyy'
  | 'mmm-d-yyyy'
  | 'd-mmmm-yyyy'
  | 'ym'
  | 'my'
  | 'ymd-compact';

export type DateTimeFormatId =
  | 'iso-24h'
  | 'iso-24h-space'
  | 'dmy-dot-24h'
  | 'dmy-dot-24h-seconds'
  | 'dmy-slash-24h'
  | 'mdy-slash-12h'
  | 'mdy-slash-12h-seconds'
  | 'd-mmm-24h'
  | 'mmm-d-12h'
  | 'compact-24h';

export type DateFormatOption = {
  id: DateFormatId;
  label: string;
  pattern: string;
  monthYearPattern: string;
  dateFnsFormat: string;
};

export type DateTimeFormatOption = {
  id: DateTimeFormatId;
  label: string;
  pattern: string;
  timePattern: string;
};

export const DEFAULT_DATE_FORMAT: DateFormatId = 'ymd-dash';
export const DEFAULT_DATE_TIME_FORMAT: DateTimeFormatId = 'iso-24h';

export const DATE_FORMAT_OPTIONS: DateFormatOption[] = [
  {
    id: 'ymd-dash',
    label: 'YYYY-MM-DD (ISO)',
    pattern: 'YYYY-MM-DD',
    monthYearPattern: 'YYYY-MM',
    dateFnsFormat: 'yyyy-MM-dd',
  },
  {
    id: 'dmy-dot',
    label: 'DD.MM.YYYY (EU)',
    pattern: 'DD.MM.YYYY',
    monthYearPattern: 'MM.YYYY',
    dateFnsFormat: 'dd.MM.yyyy',
  },
  {
    id: 'dmy-slash',
    label: 'DD/MM/YYYY (EU)',
    pattern: 'DD/MM/YYYY',
    monthYearPattern: 'MM/YYYY',
    dateFnsFormat: 'dd/MM/yyyy',
  },
  {
    id: 'dmy-dash',
    label: 'DD-MM-YYYY (EU)',
    pattern: 'DD-MM-YYYY',
    monthYearPattern: 'MM-YYYY',
    dateFnsFormat: 'dd-MM-yyyy',
  },
  {
    id: 'mdy-slash',
    label: 'MM/DD/YYYY (US)',
    pattern: 'MM/DD/YYYY',
    monthYearPattern: 'MM/YYYY',
    dateFnsFormat: 'MM/dd/yyyy',
  },
  {
    id: 'd-mmm-yyyy',
    label: 'D MMM YYYY',
    pattern: 'D MMM YYYY',
    monthYearPattern: 'MMM YYYY',
    dateFnsFormat: 'd MMM yyyy',
  },
  {
    id: 'mmm-d-yyyy',
    label: 'MMM D, YYYY',
    pattern: 'MMM D, YYYY',
    monthYearPattern: 'MMM YYYY',
    dateFnsFormat: 'MMM d, yyyy',
  },
  {
    id: 'd-mmmm-yyyy',
    label: 'D MMMM YYYY',
    pattern: 'D MMMM YYYY',
    monthYearPattern: 'MMMM YYYY',
    dateFnsFormat: 'd MMMM yyyy',
  },
  {
    id: 'ymd-slash',
    label: 'YYYY/MM/DD',
    pattern: 'YYYY/MM/DD',
    monthYearPattern: 'YYYY/MM',
    dateFnsFormat: 'yyyy/MM/dd',
  },
  {
    id: 'ym',
    label: 'YYYY-MM',
    pattern: 'YYYY-MM',
    monthYearPattern: 'YYYY-MM',
    dateFnsFormat: 'yyyy-MM',
  },
  {
    id: 'my',
    label: 'MM/YYYY',
    pattern: 'MM/YYYY',
    monthYearPattern: 'MM/YYYY',
    dateFnsFormat: 'MM/yyyy',
  },
  {
    id: 'ymd-compact',
    label: 'YYYYMMDD',
    pattern: 'YYYYMMDD',
    monthYearPattern: 'YYYYMM',
    dateFnsFormat: 'yyyyMMdd',
  },
];

export const DATE_TIME_FORMAT_OPTIONS: DateTimeFormatOption[] = [
  {
    id: 'iso-24h',
    label: 'YYYY-MM-DDTHH:mm:ss (ISO)',
    pattern: 'YYYY-MM-DDTHH:mm:ss',
    timePattern: 'HH:mm:ss',
  },
  {
    id: 'iso-24h-space',
    label: 'YYYY-MM-DD HH:mm:ss (Log)',
    pattern: 'YYYY-MM-DD HH:mm:ss',
    timePattern: 'HH:mm:ss',
  },
  {
    id: 'dmy-dot-24h',
    label: 'DD.MM.YYYY HH:mm (EU)',
    pattern: 'DD.MM.YYYY HH:mm',
    timePattern: 'HH:mm',
  },
  {
    id: 'dmy-dot-24h-seconds',
    label: 'DD.MM.YYYY HH:mm:ss (EU)',
    pattern: 'DD.MM.YYYY HH:mm:ss',
    timePattern: 'HH:mm:ss',
  },
  {
    id: 'dmy-slash-24h',
    label: 'DD/MM/YYYY HH:mm (EU)',
    pattern: 'DD/MM/YYYY HH:mm',
    timePattern: 'HH:mm',
  },
  {
    id: 'mdy-slash-12h',
    label: 'MM/DD/YYYY h:mm A (US)',
    pattern: 'MM/DD/YYYY h:mm A',
    timePattern: 'h:mm A',
  },
  {
    id: 'mdy-slash-12h-seconds',
    label: 'MM/DD/YYYY h:mm:ss A (US)',
    pattern: 'MM/DD/YYYY h:mm:ss A',
    timePattern: 'h:mm:ss A',
  },
  {
    id: 'd-mmm-24h',
    label: 'D MMM YYYY, HH:mm',
    pattern: 'D MMM YYYY, HH:mm',
    timePattern: 'HH:mm',
  },
  {
    id: 'mmm-d-12h',
    label: 'MMM D, YYYY, h:mm A',
    pattern: 'MMM D, YYYY, h:mm A',
    timePattern: 'h:mm A',
  },
  {
    id: 'compact-24h',
    label: 'YYYYMMDD-HHmmss',
    pattern: 'YYYYMMDD-HHmmss',
    timePattern: 'HHmmss',
  },
];

const DATE_FORMAT_LOOKUP = new Map<DateFormatId, DateFormatOption>(
  DATE_FORMAT_OPTIONS.map((option) => [option.id, option])
);

const DATE_TIME_FORMAT_LOOKUP = new Map<DateTimeFormatId, DateTimeFormatOption>(
  DATE_TIME_FORMAT_OPTIONS.map((option) => [option.id, option])
);

type DateParts = {
  year?: number;
  month?: number;
  day?: number;
  hour?: number;
  minute?: number;
  second?: number;
};

type PatternToken = { type: 'token' | 'literal'; value: string };

type FormatOptions = { locale?: string };

type DateFormatOptions = FormatOptions & { variant?: DateFormatVariant };

const TOKEN_LIST = [
  'YYYY',
  'MMMM',
  'MMM',
  'MM',
  'DD',
  'HH',
  'hh',
  'mm',
  'ss',
  'A',
  'a',
  'D',
  'H',
  'h',
];

const pad2 = (value: number) => value.toString().padStart(2, '0');

const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2})(?::(\d{2})(?::(\d{2}))?)?)?/;
const TIME_ONLY_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;
const HAS_TZ_PATTERN = /[zZ]|[+-]\d{2}:?\d{2}$/;

const patternCache = new Map<string, PatternToken[]>();

export const getUserLocale = (): string => {
  if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
    const locale = new Intl.DateTimeFormat().resolvedOptions().locale;
    if (locale) {
      return locale;
    }
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'en-US';
};

export const isEnglishLocale = (locale: string): boolean => locale.toLowerCase().startsWith('en');

const getMonthName = (month: number, locale: string, length: 'short' | 'long'): string => {
  const date = new Date(2025, month - 1, 1);
  return new Intl.DateTimeFormat(locale, { month: length }).format(date);
};

const tokenizePattern = (pattern: string): PatternToken[] => {
  const cached = patternCache.get(pattern);
  if (cached) {
    return cached;
  }

  const tokens: PatternToken[] = [];
  let i = 0;

  while (i < pattern.length) {
    let matched: string | null = null;
    for (const token of TOKEN_LIST) {
      if (pattern.startsWith(token, i)) {
        matched = token;
        break;
      }
    }

    if (matched) {
      tokens.push({ type: 'token', value: matched });
      i += matched.length;
    } else {
      tokens.push({ type: 'literal', value: pattern[i] });
      i += 1;
    }
  }

  patternCache.set(pattern, tokens);
  return tokens;
};

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

const formatPattern = (value: string | Date, pattern: string, locale: string): string => {
  const parts = parseDateParts(value);
  if (!parts) {
    return '';
  }

  const tokens = tokenizePattern(pattern);
  const tokenValues = tokens.filter((token) => token.type === 'token').map((token) => token.value);
  const hasYear = tokenValues.includes('YYYY');
  const hasMonth = tokenValues.some((token) => token === 'MM' || token === 'MMM' || token === 'MMMM');
  const hasDay = tokenValues.some((token) => token === 'DD' || token === 'D');
  const hasHour = tokenValues.some((token) => token === 'HH' || token === 'H' || token === 'hh' || token === 'h');
  const hasMinute = tokenValues.includes('mm');
  const hasSecond = tokenValues.includes('ss');

  if (hasYear && parts.year === undefined) {
    return '';
  }
  if (hasMonth && parts.month === undefined) {
    return '';
  }
  if (hasDay && parts.day === undefined) {
    return '';
  }
  if (hasHour && parts.hour === undefined) {
    return '';
  }
  if (hasMinute && parts.minute === undefined) {
    return '';
  }

  const year = parts.year ?? 0;
  const month = parts.month ?? 1;
  const day = parts.day ?? 1;
  const hour24 = parts.hour ?? 0;
  const minute = parts.minute ?? 0;
  const second = parts.second ?? 0;
  const hour12 = ((hour24 + 11) % 12) + 1;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';

  const monthShort = hasMonth && tokenValues.includes('MMM') ? getMonthName(month, locale, 'short') : '';
  const monthLong = hasMonth && tokenValues.includes('MMMM') ? getMonthName(month, locale, 'long') : '';

  return tokens
    .map((token) => {
      if (token.type === 'literal') {
        return token.value;
      }

      switch (token.value) {
        case 'YYYY':
          return String(year);
        case 'MM':
          return pad2(month);
        case 'DD':
          return pad2(day);
        case 'D':
          return String(day);
        case 'MMM':
          return monthShort || getMonthName(month, locale, 'short');
        case 'MMMM':
          return monthLong || getMonthName(month, locale, 'long');
        case 'HH':
          return pad2(hour24);
        case 'H':
          return String(hour24);
        case 'hh':
          return pad2(hour12);
        case 'h':
          return String(hour12);
        case 'mm':
          return pad2(minute);
        case 'ss':
          return pad2(hasSecond ? second : 0);
        case 'A':
          return ampm;
        case 'a':
          return ampm.toLowerCase();
        default:
          return token.value;
      }
    })
    .join('');
};

export const getDateFormatOption = (formatId: DateFormatId): DateFormatOption =>
  DATE_FORMAT_LOOKUP.get(formatId) ?? DATE_FORMAT_OPTIONS[0];

export const getDateTimeFormatOption = (formatId: DateTimeFormatId): DateTimeFormatOption =>
  DATE_TIME_FORMAT_LOOKUP.get(formatId) ?? DATE_TIME_FORMAT_OPTIONS[0];

export const formatDateForDisplay = (
  value: string | Date,
  formatId: DateFormatId,
  options: DateFormatOptions = {}
): string => {
  if (!value) {
    return '';
  }
  const option = getDateFormatOption(formatId);
  const locale = options.locale ?? getUserLocale();
  const pattern = options.variant === 'month-year' ? option.monthYearPattern : option.pattern;
  const formatted = formatPattern(value, pattern, locale);
  if (!formatted) {
    return typeof value === 'string' ? value : '';
  }
  return formatted;
};

export const formatDateTimeForDisplay = (
  value: string | Date,
  formatId: DateTimeFormatId,
  options: FormatOptions = {}
): string => {
  if (!value) {
    return '';
  }
  const option = getDateTimeFormatOption(formatId);
  const locale = options.locale ?? getUserLocale();
  const formatted = formatPattern(value, option.pattern, locale);
  if (!formatted) {
    return typeof value === 'string' ? value : '';
  }
  return formatted;
};

export const formatTimeForDisplay = (
  value: string | Date,
  formatId: DateTimeFormatId,
  options: FormatOptions = {}
): string => {
  if (!value) {
    return '';
  }
  const option = getDateTimeFormatOption(formatId);
  const locale = options.locale ?? getUserLocale();
  return formatPattern(value, option.timePattern, locale);
};

export const toDateMs = (value: string): number => new Date(value).getTime();

export const normalizeDateString = (value: string): string => value.split('T')[0].split(' ')[0];

export const formatDate = (date: Date): string => date.toISOString().split('T')[0];

export const startOfDay = (timestamp: number): number => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};
