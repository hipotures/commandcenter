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
/// * `project_id` - Optional project filter
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
    project_id: Option<String>,
) -> Result<Value, String> {
    eprintln!("[Rust] get_dashboard_bundle received project_id: {:?}", project_id);
    let refresh_str = if refresh { "1" } else { "0" };

    let mut args = vec![
        "dashboard".to_string(),
        "--from".to_string(),
        from,
        "--to".to_string(),
        to,
        "--refresh".to_string(),
        refresh_str.to_string(),
        "--granularity".to_string(),
        granularity,
    ];

    if let Some(pid) = project_id {
        args.push(format!("--project-id={}", pid));
    }

    let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    eprintln!("[Rust] get_dashboard_bundle args: {:?}", args_refs);
    call_python_api(&args_refs)
}

/// Get detailed statistics for a specific day.
///
/// # Arguments
///
/// * `date` - Date (YYYY-MM-DD)
/// * `project_id` - Optional project filter
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
pub async fn get_day_details(date: String, project_id: Option<String>) -> Result<Value, String> {
    let mut args = vec!["day".to_string(), "--date".to_string(), date];

    if let Some(pid) = project_id {
        args.push(format!("--project-id={}", pid));
    }

    let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    eprintln!("[Rust] get_dashboard_bundle args: {:?}", args_refs);
    call_python_api(&args_refs)
}

/// Get detailed statistics for a specific model.
///
/// # Arguments
///
/// * `model` - Model identifier
/// * `from` - Start date (YYYY-MM-DD)
/// * `to` - End date (YYYY-MM-DD)
/// * `project_id` - Optional project filter
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
    project_id: Option<String>,
) -> Result<Value, String> {
    let mut args = vec![
        "model".to_string(),
        "--model".to_string(),
        model,
        "--from".to_string(),
        from,
        "--to".to_string(),
        to,
    ];

    if let Some(pid) = project_id {
        args.push(format!("--project-id={}", pid));
    }

    let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    eprintln!("[Rust] get_dashboard_bundle args: {:?}", args_refs);
    call_python_api(&args_refs)
}

/// Get detailed statistics for a specific session.
///
/// # Arguments
///
/// * `session_id` - Session identifier
/// * `project_id` - Optional project filter
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
pub async fn get_session_details(
    session_id: String,
    project_id: Option<String>,
) -> Result<Value, String> {
    let mut args = vec!["session".to_string(), "--id".to_string(), session_id];

    if let Some(pid) = project_id {
        args.push(format!("--project-id={}", pid));
    }

    let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    eprintln!("[Rust] get_dashboard_bundle args: {:?}", args_refs);
    call_python_api(&args_refs)
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

/// Export PNG usage report for a date range.
///
/// # Arguments
///
/// * `from` - Start date (YYYY-MM-DD)
/// * `to` - End date (YYYY-MM-DD)
///
/// # Returns
///
/// JSON object containing:
/// - filename: suggested filename for the PNG
/// - data: base64-encoded PNG image data
/// - size: size of PNG in bytes
/// - mime_type: "image/png"
#[tauri::command]
pub async fn export_png_report(from: String, to: String) -> Result<Value, String> {
    call_python_api(&["export-png", "--from", &from, "--to", &to])
}

/// Get all projects with metadata.
///
/// # Returns
///
/// JSON object containing:
/// - projects: array of project objects with:
///   - project_id: unique identifier
///   - name: display name
///   - description: project description
///   - absolute_path: full filesystem path
///   - first_seen: ISO timestamp when first discovered
///   - last_seen: ISO timestamp when last seen
///   - visible: boolean visibility flag
#[tauri::command]
pub async fn get_projects() -> Result<Value, String> {
    call_python_api(&["projects"])
}

/// Update project metadata fields.
///
/// # Arguments
///
/// * `project_id` - Project identifier (required)
/// * `name` - New display name (optional)
/// * `description` - New description (optional)
/// * `visible` - Visibility flag (optional)
///
/// # Returns
///
/// JSON object containing:
/// - project: updated project object
#[tauri::command]
pub async fn update_project(
    project_id: String,
    name: Option<String>,
    description: Option<String>,
    visible: Option<bool>,
) -> Result<Value, String> {
    // Build args as owned Strings to avoid lifetime issues
    // Use --key=value format to avoid issues with project_id starting with hyphen
    let mut args: Vec<String> = vec![
        "update-project".to_string(),
        format!("--project-id={}", project_id),
    ];

    // Collect optional parameters
    if let Some(n) = name {
        args.push(format!("--name={}", n));
    }

    if let Some(d) = description {
        args.push(format!("--description={}", d));
    }

    if let Some(v) = visible {
        args.push(format!("--visible={}", if v { "1" } else { "0" }));
    }

    // Convert to &str for call_python_api
    let args_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    call_python_api(&args_refs)
}

#[cfg(test)]
mod tests {
    // Note: Tests removed as DashboardParams struct no longer exists
    // Commands now use individual parameters for simpler frontend integration
}
