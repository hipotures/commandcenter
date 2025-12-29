// Module declarations
mod commands;
mod python_bridge;

use commands::{
    get_dashboard_bundle,
    get_day_details,
    get_model_details,
    get_session_details,
    get_limit_resets,
    export_png_report,
    get_projects,
    get_usage_accounts,
    update_project,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
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
      get_limit_resets,
      export_png_report,
      get_projects,
      get_usage_accounts,
      update_project
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
