//! trace engine: capture, encode, replay buffer and clip saving.
//!
//! Pipeline: `capture` -> `encode` -> `ring` (+ `audio`) -> `mux` -> `session`.

pub mod audio;
pub mod audio_encode;
pub mod audio_mix;
pub mod capture;
pub mod encode;
pub mod hw;
pub mod monitor;
pub mod mux;
pub mod repair;
pub mod ring;
pub mod session;
