import type { DashboardBundle } from '../../types/api';
import type { DashboardViewModel } from '../../types/dashboard';
import { formatDurationRange } from '../../lib/time';

const MODEL_VERSION_RE = /(\d+(?:\.\d+)?)/;

const getModelSortKey = (displayName: string) => {
  const trimmed = displayName.trim();
  const match = trimmed.match(MODEL_VERSION_RE);
  const version = match ? Number.parseFloat(match[1]) : Number.POSITIVE_INFINITY;
  const name = match ? trimmed.replace(match[1], '').trim() : trimmed;

  return {
    version,
    name: name.length > 0 ? name : trimmed,
    label: trimmed,
  };
};

const compareModelDisplay = (a: string, b: string) => {
  const aKey = getModelSortKey(a);
  const bKey = getModelSortKey(b);

  if (aKey.version !== bKey.version) {
    return aKey.version - bKey.version;
  }

  const nameCompare = aKey.name.localeCompare(bKey.name, undefined, { sensitivity: 'base' });
  if (nameCompare !== 0) {
    return nameCompare;
  }

  return aKey.label.localeCompare(bKey.label, undefined, { sensitivity: 'base' });
};

export const mapApiToViewModel = (apiData: DashboardBundle): DashboardViewModel => {
  const dailyActivity = apiData.daily_activity;
  const heatmapActivity = apiData.heatmap.daily_activity;
  const heatmapRange = apiData.heatmap.range;
  const timelineData = apiData.timeline.data.map((point) => ({
    period: point.period,
    messages: point.messages,
    tokens: point.tokens,
    cost: point.cost,
  }));
  const hourlyData = apiData.hourly_profile.map((hour) => ({
    hour: hour.hour.toString().padStart(2, '0') + ':00',
    activity: hour.messages,
  }));
  const dailyData = (() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayStats: Record<number, { count: number; messages: number }> = {};

    for (let i = 0; i < 7; i++) {
      dayStats[i] = { count: 0, messages: 0 };
    }

    Object.entries(apiData.daily_activity).forEach(([date, messages]) => {
      const dayOfWeek = new Date(date).getDay();
      dayStats[dayOfWeek].count += 1;
      dayStats[dayOfWeek].messages += Number(messages);
    });

    return [1, 2, 3, 4, 5, 6, 0].map((dayIndex) => ({
      day: dayNames[dayIndex],
      activity:
        dayStats[dayIndex].count > 0
          ? Math.round(dayStats[dayIndex].messages / dayStats[dayIndex].count)
          : 0,
    }));
  })();
  const modelData = apiData.model_distribution
    .map((model) => ({
      model: model.model,
      displayName: model.display_name,
      tokens: model.tokens,
      messages: model.messages,
      cost: model.cost,
    }))
    .sort((a, b) => compareModelDisplay(a.displayName, b.displayName));
  const sessions = apiData.recent_sessions.map((session) => ({
    id: session.session_id,
    messages: session.messages,
    tokens: session.tokens,
    cost: session.cost,
    date: session.first_time || '',
    duration: formatDurationRange(session.first_time, session.last_time),
    models: (session.models ?? []).map((model) => ({
      model: model.display_name,
      messages: model.messages,
      tokens: model.tokens,
      cost: model.cost,
      date: model.first_time || '',
      duration: formatDurationRange(model.first_time, model.last_time),
    })),
  }));

  return {
    dailyActivity,
    heatmapActivity,
    heatmapRange,
    timelineData,
    hourlyData,
    dailyData,
    modelData,
    sessions,
    totals: {
      messages: apiData.totals.messages,
      sessions: apiData.totals.sessions,
      tokens: apiData.totals.tokens,
      cost: apiData.totals.cost,
      cacheRead: apiData.totals.cache_read,
      cacheWrite: apiData.totals.cache_write,
      maxStreak: apiData.totals.max_streak,
      currentStreak: apiData.totals.current_streak,
    },
    trends: apiData.trends,
    meta: {
      dataRange: apiData.meta?.data_range,
      appVersion: apiData.meta?.app_version,
      firstSessionDate: apiData.totals.first_session_date,
    },
  };
};
