/// Tauri command handlers
///
/// This module defines all Tauri commands that the frontend can invoke.
use serde::Deserialize;
use serde_json::Value;

use crate::python_bridge::call_python_api;

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct DashboardParams {
    pub from: String,
    pub to: String,
    #[serde(default)]
    pub refresh: bool,
    #[serde(default = "default_granularity")]
    pub granularity: String,
}

fn default_granularity() -> String {
    "month".to_string()
}

#[derive(Debug, Deserialize)]
pub struct DayParams {
    pub date: String,
}

#[derive(Debug, Deserialize)]
pub struct ModelParams {
    pub model: String,
    pub from: String,
    pub to: String,
}

#[derive(Debug, Deserialize)]
pub struct SessionParams {
    #[serde(rename = "sessionId")]
    pub session_id: String,
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Get complete dashboard bundle with all statistics.
///
/// # Arguments
///
/// * `params` - Dashboard query parameters (date range, refresh flag, granularity)
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
pub async fn get_dashboard_bundle(params: DashboardParams) -> Result<Value, String> {
    let refresh_str = if params.refresh { "1" } else { "0" };

    call_python_api(&[
        "dashboard",
        "--from",
        &params.from,
        "--to",
        &params.to,
        "--refresh",
        refresh_str,
        "--granularity",
        &params.granularity,
    ])
}

/// Get detailed statistics for a specific day.
///
/// # Arguments
///
/// * `params` - Day query parameters (date)
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
pub async fn get_day_details(params: DayParams) -> Result<Value, String> {
    call_python_api(&["day", "--date", &params.date])
}

/// Get detailed statistics for a specific model.
///
/// # Arguments
///
/// * `params` - Model query parameters (model name, date range)
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
pub async fn get_model_details(params: ModelParams) -> Result<Value, String> {
    call_python_api(&[
        "model",
        "--model",
        &params.model,
        "--from",
        &params.from,
        "--to",
        &params.to,
    ])
}

/// Get detailed statistics for a specific session.
///
/// # Arguments
///
/// * `params` - Session query parameters (session ID)
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
pub async fn get_session_details(params: SessionParams) -> Result<Value, String> {
    call_python_api(&["session", "--id", &params.session_id])
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
