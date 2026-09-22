use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

/// Alleen deze collecties mogen gelezen/geschreven worden (voorkomt pad-manipulatie via de naam).
const COLLECTIES: [&str; 3] = ["klassen", "lessen", "lokalen"];

/// Waar de JSON-bestanden staan.
/// - `KLASPLATTEGROND_DATA` (env) wint altijd.
/// - Release: `data/` naast de exe, zodat alles bij de app blijft en nergens anders heen gaat.
/// - Dev: in %LOCALAPPDATA%, bewust BUITEN de (OneDrive-)projectmap, zodat namen nooit in de cloud belanden.
fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(p) = std::env::var("KLASPLATTEGROND_DATA") {
        if !p.trim().is_empty() {
            return Ok(PathBuf::from(p));
        }
    }
    if cfg!(debug_assertions) {
        let base = app
            .path()
            .app_local_data_dir()
            .map_err(|e| format!("Geen lokale data-map: {e}"))?;
        return Ok(base.join("dev-data"));
    }
    let exe = std::env::current_exe().map_err(|e| format!("Kan exe-pad niet bepalen: {e}"))?;
    let dir = exe.parent().ok_or("Exe heeft geen map")?;
    Ok(dir.join("data"))
}

fn bestand(app: &tauri::AppHandle, naam: &str) -> Result<PathBuf, String> {
    if !COLLECTIES.contains(&naam) {
        return Err(format!("Onbekende collectie: {naam}"));
    }
    Ok(data_dir(app)?.join(format!("{naam}.json")))
}

#[tauri::command]
fn get_data_path(app: tauri::AppHandle) -> Result<String, String> {
    Ok(data_dir(&app)?.to_string_lossy().to_string())
}

/// Geeft `null` terug als het bestand nog niet bestaat.
#[tauri::command]
fn load_collection(app: tauri::AppHandle, name: String) -> Result<Option<serde_json::Value>, String> {
    let pad = bestand(&app, &name)?;
    if !pad.exists() {
        return Ok(None);
    }
    let tekst = fs::read_to_string(&pad).map_err(|e| format!("Kan {name}.json niet lezen: {e}"))?;
    let waarde = serde_json::from_str(&tekst)
        .map_err(|e| format!("{name}.json is geen geldige JSON (backup: {name}.json.bak): {e}"))?;
    Ok(Some(waarde))
}

/// Schrijft atomair: eerst naar .tmp, vorige versie naar .bak, dan hernoemen.
#[tauri::command]
fn save_collection(app: tauri::AppHandle, name: String, value: serde_json::Value) -> Result<(), String> {
    let pad = bestand(&app, &name)?;
    if let Some(dir) = pad.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("Kan data-map niet maken: {e}"))?;
    }
    let tekst = serde_json::to_string_pretty(&value).map_err(|e| format!("Kan niet serialiseren: {e}"))?;
    let tmp = suffix(&pad, "tmp");
    fs::write(&tmp, tekst).map_err(|e| format!("Kan {name}.json niet schrijven: {e}"))?;
    if pad.exists() {
        let _ = fs::copy(&pad, suffix(&pad, "bak"));
    }
    fs::rename(&tmp, &pad).map_err(|e| format!("Kan {name}.json niet vervangen: {e}"))
}

fn suffix(pad: &Path, ext: &str) -> PathBuf {
    let mut s = pad.as_os_str().to_owned();
    s.push(".");
    s.push(ext);
    PathBuf::from(s)
}

/// Schrijft een export (bv. CSV) naar een pad dat de gebruiker zelf via het opslaan-dialoogvenster koos.
#[tauri::command]
fn write_export_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Kan bestand niet schrijven: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_data_path,
            load_collection,
            save_collection,
            write_export_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
