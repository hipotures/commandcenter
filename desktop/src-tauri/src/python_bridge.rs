/// Python CLI bridge for Tauri commands
///
/// This module handles executing the Python tauri_api module and parsing JSON responses.
use serde_json::Value;
use std::process::Command;

/// Execute Python tauri_api module and return JSON result.
///
/// # Arguments
///
/// * `args` - Command-line arguments to pass to Python module
///
/// # Returns
///
/// * `Ok(Value)` - Parsed JSON response from Python
/// * `Err(String)` - Error message if execution or parsing fails
///
/// # Example
///
/// ```ignore
/// let result = call_python_api(&["dashboard", "--from", "2025-01-01", "--to", "2025-12-27"]);
/// ```
pub fn call_python_api(args: &[&str]) -> Result<Value, String> {
    // Execute Python module
    let output = Command::new("python")
        .arg("-m")
        .arg("command_center.tauri_api")
        .args(args)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    // Check exit status
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python error: {}", stderr));
    }

    // Parse JSON from stdout
    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout).map_err(|e| format!("JSON parse error: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore] // Requires Python environment
    fn test_call_python_api() {
        let result = call_python_api(&[
            "dashboard",
            "--from",
            "2025-01-01",
            "--to",
            "2025-01-01",
            "--refresh",
            "0",
            "--granularity",
            "day",
        ]);
        assert!(result.is_ok());
    }
}
