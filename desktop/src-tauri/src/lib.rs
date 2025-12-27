// Module declarations
mod commands;
mod python_bridge;

use commands::{get_dashboard_bundle, get_day_details, get_model_details, get_session_details, get_limit_resets};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_dashboard_bundle,
      get_day_details,
      get_model_details,
      get_session_details,
      get_limit_resets
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
