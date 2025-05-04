use std::process::Command;
use log::{info, error};
use env_logger;
use std::fs::create_dir_all;
use std::path::PathBuf;
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

// Get the path to the database file
fn get_db_path() -> PathBuf {
    let app_data_dir = dirs::data_dir()
        .expect("Failed to get app data directory")
        .join("jetraay"); // Add app name as subfolder
    
    // Ensure the directory exists
    create_dir_all(&app_data_dir).expect("Failed to create app data directory");
    
    app_data_dir.join("jets.db")
}

fn init_database() -> Result<()> {
    let db_path = get_db_path();
    info!("Initializing database at: {:?}", db_path);
    
    let conn = Connection::open(&db_path)?;
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
    info!("Saving jet - ID: {}, Method: {}, URL: {}", jet.id, jet.method, jet.url);
    let db_path = get_db_path();
    let conn = Connection::open(db_path).map_err(|e| {
        error!("Failed to open database connection when saving jet: {}", e);
        e.to_string()
    })?;

    // Fetch the current version number
    let current_version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM jet_history WHERE jet_id = ?1",
            params![jet.id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    
    info!("Current version for jet_id {} is {}, saving as version {}", jet.id, current_version, current_version + 1);

    // Save the current state to jet_history
    let jet_data = serde_json::to_string(jet).map_err(|e| {
        error!("Failed to serialize jet data: {}", e);
        e.to_string()
    })?;
    
    conn.execute(
        "INSERT INTO jet_history (jet_id, version, data) VALUES (?1, ?2, ?3)",
        params![jet.id, current_version + 1, jet_data],
    )
    .map_err(|e| {
        error!("Failed to insert into jet_history: {}", e);
        e.to_string()
    })?;
    
    info!("Saved jet history entry for version {}", current_version + 1);

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
    .map_err(|e| {
        error!("Failed to save jet in jets table: {}", e);
        e.to_string()
    })?;
    
    info!("Successfully saved/updated jet ID: {} in jets table", jet.id);
    Ok(())
}

fn load_jets() -> Result<Vec<Jet>, String> {
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
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
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM jets WHERE id = ?1", params![jet_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn rename_jet(jet_id: &str, new_name: &str) -> Result<(), String> {
    let conn = Connection::open(get_db_path()).map_err(|e| e.to_string())?;
    conn.execute("UPDATE jets SET name = ?1 WHERE id = ?2", params![new_name, jet_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn fetch_jet_history(jet_id: &str) -> Result<Vec<(i64, String, String)>, String> {
    info!("Fetching history for jet_id: {}", jet_id);
    let conn = Connection::open(get_db_path()).map_err(|e| {
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
    info!("Attempting to revert jet_id: {} to version: {}", jet_id, version);
    let conn = Connection::open(get_db_path()).map_err(|e| {
        error!("Failed to open database connection for revert: {}", e);
        e.to_string()
    })?;

    // Fetch the specific version data
    info!("Fetching data for jet_id: {} version: {}", jet_id, version);
    let jet_data: String = conn
        .query_row(
            "SELECT data FROM jet_history WHERE jet_id = ?1 AND version = ?2",
            params![jet_id, version],
            |row| row.get(0),
        )
        .map_err(|e| {
            error!("Failed to retrieve history data for version {}: {}", version, e);
            e.to_string()
        })?;

    // Deserialize the data back into a Jet
    let jet: Jet = serde_json::from_str(&jet_data).map_err(|e| {
        error!("Failed to deserialize jet data: {}", e);
        e.to_string()
    })?;
    
    info!("Successfully retrieved version {} for jet_id: {}", version, jet_id);
    info!("Reverting jet to method: {}, url: {}", jet.method, jet.url);

    // Update the jets table directly without creating a new history entry
    conn.execute(
        "UPDATE jets SET name = ?1, method = ?2, url = ?3, headers = ?4, body = ?5 WHERE id = ?6",
        params![
            jet.name,
            jet.method,
            jet.url,
            serde_json::to_string(&jet.headers).map_err(|e| e.to_string())?,
            jet.body,
            jet.id
        ],
    ).map_err(|e| {
        error!("Failed to update jet when reverting: {}", e);
        e.to_string()
    })?;
    
    info!("Successfully reverted jet ID: {} to version {}", jet.id, version);
    Ok(())
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
    info!("Request initiated: {} {}", method, url);
    info!("Headers: {:?}", headers);
    if let Some(body_content) = &body {
        if body_content.len() > 500 {
            info!("Body: {} (truncated)...", &body_content[..500]);
        } else {
            info!("Body: {}", body_content);
        }
    } else {
        info!("Body: None");
    }

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
                let truncated = if stdout.len() > 1000 {
                    format!("{} (truncated)...", &stdout[..1000])
                } else {
                    stdout.clone()
                };
                info!("Request succeeded: {} {} - Response: {}", method, url, truncated);
                Ok(stdout)
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                error!("Request failed: {} {} - Error: {}", method, url, stderr);
                Err(stderr)
            }
        }
        Err(e) => {
            error!("Failed to execute request: {} {} - Error: {}", method, url, e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
fn save_jet_history_command(jet: Jet) -> Result<(), String> {
    info!("Checking if history entry needed for jet_id: {}, method: {}, url: {}", jet.id, jet.method, jet.url);
    let conn = Connection::open(get_db_path()).map_err(|e| {
        error!("Failed to open database connection for history check: {}", e);
        e.to_string()
    })?;

    // Check if this jet already exists and compare headers/body
    let mut should_save_history = true;
    let latest_data = conn.query_row(
        "SELECT headers, body FROM jets WHERE id = ?1",
        params![jet.id],
        |row| {
            let headers: String = row.get(0)?;
            let body: Option<String> = row.get(1)?;
            Ok((headers, body))
        }
    );

    if let Ok((headers_str, existing_body)) = latest_data {
        // Parse headers
        let existing_headers: Vec<String> = serde_json::from_str(&headers_str).unwrap_or_default();
        
        // Check if headers and body are the same
        let headers_same = existing_headers.len() == jet.headers.len() && 
                          existing_headers.iter().all(|h| jet.headers.contains(h));
        let body_same = existing_body == jet.body;
        
        if headers_same && body_same {
            info!("No changes to headers or body detected, skipping history creation");
            should_save_history = false;
        } else {
            info!("Changes detected in headers or body, creating history entry");
        }
    } else {
        info!("No existing jet found with ID: {}, creating initial history entry", jet.id);
    }
    
    if !should_save_history {
        // Just update the jet without creating history
        conn.execute(
            "UPDATE jets SET name = ?1, method = ?2, url = ?3, headers = ?4, body = ?5 WHERE id = ?6",
            params![
                jet.name,
                jet.method,
                jet.url,
                serde_json::to_string(&jet.headers).map_err(|e| e.to_string())?,
                jet.body,
                jet.id
            ],
        ).map_err(|e| {
            error!("Failed to update jet without history: {}", e);
            e.to_string()
        })?;
        
        info!("Successfully updated jet ID: {} without creating history entry", jet.id);
        return Ok(());
    }

    // Fetch the current version number
    let current_version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM jet_history WHERE jet_id = ?1",
            params![jet.id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    
    info!("Current version for jet_id {} is {}, saving new version {}", jet.id, current_version, current_version + 1);

    // Save the current state to jet_history
    let jet_data = serde_json::to_string(&jet).map_err(|e| {
        error!("Failed to serialize jet data: {}", e);
        e.to_string()
    })?;
    
    conn.execute(
        "INSERT INTO jet_history (jet_id, version, data) VALUES (?1, ?2, ?3)",
        params![jet.id, current_version + 1, jet_data],
    )
    .map_err(|e| {
        error!("Failed to insert jet history: {}", e);
        e.to_string()
    })?;

    // Update the main jets table
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
    .map_err(|e| {
        error!("Failed to insert/update jet: {}", e);
        e.to_string()
    })?;

    info!("Successfully saved history entry for jet_id: {} (version {})", jet.id, current_version + 1);
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
