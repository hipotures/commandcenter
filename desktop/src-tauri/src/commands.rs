/// Tauri command handlers
///
/// This module defines all Tauri commands that the frontend can invoke.
use serde_json::Value;

use crate::python_bridge::call_python_api;

// ============================================================================
// Tauri Commands
// ============================================================================
//
// Note: Commands use individual parameters instead of structs for simpler
// frontend integration with Tauri v2 invoke API.

/// Get complete dashboard bundle with all statistics.
///
/// # Arguments
///
/// * `from` - Start date (YYYY-MM-DD)
/// * `to` - End date (YYYY-MM-DD)
/// * `refresh` - Whether to perform incremental update
/// * `granularity` - Timeline granularity (month/week/day)
///
/// # Returns
///
/// JSON object containing:
/// - range: date range
/// - totals: aggregate statistics
/// - daily_activity: daily message counts
/// - timeline: time-series data grouped by granularity
/// - model_distribution: per-model statistics
/// - hourly_profile: 24-hour activity profile
/// - recent_sessions: latest sessions
#[tauri::command]
pub async fn get_dashboard_bundle(
    from: String,
    to: String,
    refresh: bool,
    granularity: String,
) -> Result<Value, String> {
    let refresh_str = if refresh { "1" } else { "0" };

    call_python_api(&[
        "dashboard",
        "--from",
        &from,
        "--to",
        &to,
        "--refresh",
        refresh_str,
        "--granularity",
        &granularity,
    ])
}

/// Get detailed statistics for a specific day.
///
/// # Arguments
///
/// * `date` - Date (YYYY-MM-DD)
///
/// # Returns
///
/// JSON object containing:
/// - date: the queried date
/// - totals: day totals
/// - hourly: hourly breakdown
/// - models: model distribution for the day
/// - sessions: sessions active on the day
#[tauri::command]
pub async fn get_day_details(date: String) -> Result<Value, String> {
    call_python_api(&["day", "--date", &date])
}

/// Get detailed statistics for a specific model.
///
/// # Arguments
///
/// * `model` - Model identifier
/// * `from` - Start date (YYYY-MM-DD)
/// * `to` - End date (YYYY-MM-DD)
///
/// # Returns
///
/// JSON object containing:
/// - model: model identifier
/// - display_name: formatted model name
/// - range: date range
/// - totals: aggregate statistics
/// - daily_activity: daily breakdown
/// - sessions: top sessions for this model
#[tauri::command]
pub async fn get_model_details(
    model: String,
    from: String,
    to: String,
) -> Result<Value, String> {
    call_python_api(&[
        "model",
        "--model",
        &model,
        "--from",
        &from,
        "--to",
        &to,
    ])
}

/// Get detailed statistics for a specific session.
///
/// # Arguments
///
/// * `session_id` - Session identifier
///
/// # Returns
///
/// JSON object containing:
/// - session_id: session identifier
/// - model: primary model used
/// - display_name: formatted model name
/// - date: session date
/// - first_time/last_time: session timestamps
/// - totals: aggregate statistics
/// - messages: individual message breakdowns
#[tauri::command]
pub async fn get_session_details(session_id: String) -> Result<Value, String> {
    call_python_api(&["session", "--id", &session_id])
}

/// Get limit reset events for a date range.
///
/// # Arguments
///
/// * `from` - Start date (YYYY-MM-DD)
/// * `to` - End date (YYYY-MM-DD)
///
/// # Returns
///
/// JSON array containing limit reset events with:
/// - limit_type: type of limit ('5-hour', 'session', 'spending_cap', 'context')
/// - reset_at: ISO timestamp when limit resets
/// - reset_text: original reset text (e.g., "resets 12am")
/// - summary: full summary text
/// - year: year of the event
/// - date: date of the event (YYYY-MM-DD)
#[tauri::command]
pub async fn get_limit_resets(from: String, to: String) -> Result<Value, String> {
    call_python_api(&["limits", "--from", &from, "--to", &to])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dashboard_params_deserialize() {
        let json = r#"{"from": "2025-01-01", "to": "2025-12-31", "refresh": true, "granularity": "month"}"#;
        let params: DashboardParams = serde_json::from_str(json).unwrap();
        assert_eq!(params.from, "2025-01-01");
        assert_eq!(params.to, "2025-12-31");
        assert!(params.refresh);
        assert_eq!(params.granularity, "month");
    }

    #[test]
    fn test_dashboard_params_default_granularity() {
        let json = r#"{"from": "2025-01-01", "to": "2025-12-31"}"#;
        let params: DashboardParams = serde_json::from_str(json).unwrap();
        assert_eq!(params.granularity, "month");
        assert!(!params.refresh);
    }
}
