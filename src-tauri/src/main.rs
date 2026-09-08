// Desktop launches must never allocate a console, including local debug builds.
#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

fn main() {
    atoll_lib::run();
}
