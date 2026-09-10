fn main() {
    // Windows resource compilation must rerun when the packaged icon changes.
    println!("cargo:rerun-if-changed=icons/icon.ico");
    tauri_build::build()
}
