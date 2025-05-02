use std::process::Command;
use log::{info, error};
use env_logger;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Initialize the logger
fn init_logger() {
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info) // Set default logging level to Info
        .init();
}

#[tauri::command]
fn run_curl(method: &str, url: &str, headers: Vec<String>, body: Option<String>) -> Result<String, String> {
    let mut command = Command::new("curl");

    // Add HTTP method
    command.arg("-X").arg(method);

    // Add URL
    command.arg(url);

    // Add headers
    for header in headers {
        command.arg("-H").arg(header);
    }

    // Add body if present
    if let Some(body_content) = body {
        command.arg("-d").arg(body_content);
    }

    // Log the constructed command for debugging
    info!("Executing command: {:?}", command);

    // Execute the command
    match command.output() {
        Ok(output) => {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                info!("Command succeeded with output: {}", stdout); // Log success
                Ok(stdout)
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                error!("Command failed with error: {}", stderr); // Log error
                Err(stderr)
            }
        }
        Err(e) => {
            error!("Failed to execute command: {}", e); // Log execution failure
            Err(e.to_string())
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logger(); // Initialize the logger

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, run_curl])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
