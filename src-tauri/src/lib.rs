use std::process::Command;
use log::{info, error};
use env_logger;
use std::fs::OpenOptions;
use std::io::{Read, Write};
use serde::{Deserialize, Serialize};
use rusqlite::{params, Connection, Result};

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

#[derive(Serialize, Deserialize, Clone)]
struct Jet {
    id: String, // Unique identifier for the jet
    name: Option<String>, // Optional name for the jet
    method: String,
    url: String,
    headers: Vec<String>,
    body: Option<String>,
}

const DB_PATH: &str = "jets.db";

fn init_database() -> Result<()> {
    let conn = Connection::open(DB_PATH)?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS jets (
            id TEXT PRIMARY KEY,
            name TEXT,
            method TEXT NOT NULL,
            url TEXT NOT NULL,
            headers TEXT NOT NULL,
            body TEXT
        )",
        [],
    )?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS jet_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            jet_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            data TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(jet_id) REFERENCES jets(id)
        )",
        [],
    )?;
    Ok(())
}

fn save_jet(jet: &Jet) -> Result<(), String> {
    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;

    // Fetch the current version number
    let current_version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM jet_history WHERE jet_id = ?1",
            params![jet.id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Save the current state to jet_history
    let jet_data = serde_json::to_string(jet).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO jet_history (jet_id, version, data) VALUES (?1, ?2, ?3)",
        params![jet.id, current_version + 1, jet_data],
    )
    .map_err(|e| e.to_string())?;

    // Save or update the jet in the jets table
    conn.execute(
        "INSERT INTO jets (id, name, method, url, headers, body) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, method = excluded.method, url = excluded.url, headers = excluded.headers, body = excluded.body",
        params![
            jet.id,
            jet.name,
            jet.method,
            jet.url,
            serde_json::to_string(&jet.headers).map_err(|e| e.to_string())?,
            jet.body
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn load_jets() -> Result<Vec<Jet>, String> {
    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, method, url, headers, body FROM jets").map_err(|e| e.to_string())?;
    let jets_iter = stmt.query_map([], |row| {
        Ok(Jet {
            id: row.get(0)?,
            name: row.get(1).ok(),
            method: row.get(2)?,
            url: row.get(3)?,
            headers: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or_default(),
            body: row.get(5).ok(),
        })
    }).map_err(|e| e.to_string())?;

    let mut jets = Vec::new();
    for jet in jets_iter {
        jets.push(jet.map_err(|e| e.to_string())?);
    }
    Ok(jets)
}

fn delete_jet(jet_id: &str) -> Result<(), String> {
    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM jets WHERE id = ?1", params![jet_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn rename_jet(jet_id: &str, new_name: &str) -> Result<(), String> {
    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;
    conn.execute("UPDATE jets SET name = ?1 WHERE id = ?2", params![new_name, jet_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn fetch_jet_history(jet_id: &str) -> Result<Vec<(i64, String, String)>, String> {
    info!("Fetching history for jet_id: {}", jet_id);
    let conn = Connection::open(DB_PATH).map_err(|e| {
        error!("Failed to open database connection: {}", e);
        e.to_string()
    })?;
    let mut stmt = conn
        .prepare("SELECT version, data, timestamp FROM jet_history WHERE jet_id = ?1 ORDER BY version DESC")
        .map_err(|e| {
            error!("Failed to prepare statement: {}", e);
            e.to_string()
        })?;

    let history_iter = stmt
        .query_map(params![jet_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(|e| {
            error!("Failed to execute query: {}", e);
            e.to_string()
        })?;

    let mut history = Vec::new();
    for entry in history_iter {
        match entry {
            Ok(data) => history.push(data),
            Err(e) => {
                error!("Failed to map query result: {}", e);
                return Err(e.to_string());
            }
        }
    }
    info!("Successfully fetched history for jet_id: {}", jet_id);
    Ok(history)
}

fn revert_jet_to_version(jet_id: &str, version: i64) -> Result<(), String> {
    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;

    // Fetch the specific version data
    let jet_data: String = conn
        .query_row(
            "SELECT data FROM jet_history WHERE jet_id = ?1 AND version = ?2",
            params![jet_id, version],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Deserialize the data back into a Jet
    let jet: Jet = serde_json::from_str(&jet_data).map_err(|e| e.to_string())?;

    // Save the Jet back to the jets table
    save_jet(&jet)
}

#[tauri::command]
fn save_jet_command(method: String, url: String, headers: Vec<String>, body: Option<String>) -> Result<(), String> {
    let jet = Jet { id: uuid::Uuid::new_v4().to_string(), name: None, method, url, headers, body };
    save_jet(&jet)
}

#[tauri::command]
fn get_jets_command() -> Result<Vec<Jet>, String> {
    load_jets()
}

#[tauri::command]
fn delete_jet_command(jet_id: String) -> Result<(), String> {
    delete_jet(&jet_id)
}

#[tauri::command]
fn rename_jet_command(jet_id: String, new_name: String) -> Result<(), String> {
    rename_jet(&jet_id, &new_name)
}

#[tauri::command]
fn fetch_jet_history_command(jet_id: String) -> Result<Vec<(i64, String, String)>, String> {
    info!("Invoking fetch_jet_history_command for jet_id: {}", jet_id);
    let result = fetch_jet_history(&jet_id);
    if let Err(ref e) = result {
        error!("Error in fetch_jet_history_command: {}", e);
    }
    result
}

#[tauri::command]
fn revert_jet_to_version_command(jet_id: String, version: i64) -> Result<(), String> {
    revert_jet_to_version(&jet_id, version)
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

#[tauri::command]
fn save_jet_history_command(jet: Jet) -> Result<(), String> {
    let conn = Connection::open(DB_PATH).map_err(|e| e.to_string())?;

    // Fetch the current version number
    let current_version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM jet_history WHERE jet_id = ?1",
            params![jet.id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    // Save the current state to jet_history
    let jet_data = serde_json::to_string(&jet).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO jet_history (jet_id, version, data) VALUES (?1, ?2, ?3)",
        params![jet.id, current_version + 1, jet_data],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logger(); // Initialize the logger
    init_database().expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            run_curl,
            save_jet_command,
            get_jets_command,
            delete_jet_command,
            rename_jet_command,
            fetch_jet_history_command,
            revert_jet_to_version_command,
            save_jet_history_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
