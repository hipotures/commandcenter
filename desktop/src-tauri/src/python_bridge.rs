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
    use log::{info, debug};

    // Execute Python module - try multiple Python commands
    let python_commands = vec!["python", "python3", "uv run python"];
    let mut last_error = String::new();

    for python_cmd in &python_commands {
        let cmd_parts: Vec<&str> = python_cmd.split_whitespace().collect();
        let mut command = if cmd_parts.len() > 1 {
            // For "uv run python"
            let mut cmd = Command::new(cmd_parts[0]);
            for part in &cmd_parts[1..] {
                cmd.arg(part);
            }
            cmd
        } else {
            // For "python" or "python3"
            Command::new(cmd_parts[0])
        };

        command.arg("-m")
               .arg("command_center.tauri_api")
               .args(args);

        match command.output() {
            Ok(output) => {
                // Check exit status
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    last_error = format!("Python error ({}): {}", python_cmd, stderr);
                    debug!("Failed with {}: {}", python_cmd, stderr);
                    continue;
                }

                // Parse JSON from stdout
                let stdout = String::from_utf8_lossy(&output.stdout);

                match serde_json::from_str(&stdout) {
                    Ok(json) => {
                        info!("API call successful ({} bytes)", stdout.len());
                        return Ok(json);
                    }
                    Err(e) => {
                        last_error = format!("JSON parse error: {} | stdout: {}", e, stdout);
                        debug!("JSON parse error: {}", e);
                        continue;
                    }
                }
            }
            Err(e) => {
                last_error = format!("Failed to execute {}: {}", python_cmd, e);
                debug!("Failed to execute {}: {}", python_cmd, e);
                continue;
            }
        }
    }

    Err(last_error)
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
