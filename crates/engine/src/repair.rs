//! Repairs clips whose container timeline starts at a non-zero offset.
//!
//! Clips used to be muxed with absolute, monotonic timestamps, so a recording
//! that had been running for a while produced an MP4 whose declared duration
//! was the whole session uptime — "an hour long, but only the last minute
//! plays". This remuxes such a file (lossless stream copy) with every stream
//! rebased by the shared earliest timestamp, so the timeline starts at zero.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use ffmpeg_next as ffmpeg;

/// Offsets below this are treated as already-at-zero and left untouched.
const REPAIR_THRESHOLD_US: i64 = 1_000_000;

fn micros() -> ffmpeg::Rational {
    ffmpeg::Rational(1, 1_000_000)
}

/// Rescales `ts` from one time base to another (truncating), like `av_rescale_q`.
fn rescale(ts: i64, from: ffmpeg::Rational, to: ffmpeg::Rational) -> i64 {
    let den = from.1 as i128 * to.0 as i128;
    if den == 0 {
        return 0;
    }
    (ts as i128 * from.0 as i128 * to.1 as i128 / den) as i64
}

/// The earliest timestamp in a file, with the time base it was expressed in.
struct Lead {
    time_base: ffmpeg::Rational,
    ts: i64,
}

/// Where a stream lives in the output, plus the amount to subtract from it.
#[derive(Clone, Copy)]
struct StreamMap {
    in_index: usize,
    out_index: usize,
    in_time_base: ffmpeg::Rational,
    out_time_base: ffmpeg::Rational,
    offset: i64,
}

/// Finds the earliest packet timestamp across all streams, if the file has any.
fn earliest(path: &Path) -> Result<Option<Lead>> {
    let mut input = ffmpeg::format::input(path)?;
    let stream_count = input.streams().count();
    if stream_count == 0 {
        return Ok(None);
    }

    // Interleaved packets arrive in timestamp order, so only the first packet
    // of each stream can be that stream's earliest.
    let mut seen = vec![false; stream_count];
    let mut best: Option<(i64, Lead)> = None;
    for (stream, packet) in input.packets() {
        let index = stream.index();
        if index >= seen.len() || seen[index] {
            continue;
        }
        seen[index] = true;
        if let Some(ts) = packet.dts().or_else(|| packet.pts()) {
            let time_base = stream.time_base();
            let us = rescale(ts, time_base, micros());
            if best.as_ref().map_or(true, |(best_us, _)| us < *best_us) {
                best = Some((us, Lead { time_base, ts }));
            }
        }
        if seen.iter().all(|seen| *seen) {
            break;
        }
    }
    Ok(best.map(|(_, lead)| lead))
}

/// Rewrites `path` in place if its timeline starts well after zero. Returns
/// whether the file was rewritten.
pub fn repair_file(path: &Path) -> Result<bool> {
    let Some(lead) = earliest(path)? else {
        return Ok(false);
    };
    if rescale(lead.ts, lead.time_base, micros()).abs() < REPAIR_THRESHOLD_US {
        return Ok(false);
    }
    remux_rebased(path, &lead)?;
    Ok(true)
}

/// Remuxes to a sibling temp file, then swaps it over the original. The
/// original is only replaced once the rewrite succeeds.
fn remux_rebased(path: &Path, lead: &Lead) -> Result<()> {
    let temp = temp_path(path);
    let _ = std::fs::remove_file(&temp);

    if let Err(error) = write_rebased(path, &temp, lead) {
        let _ = std::fs::remove_file(&temp);
        return Err(error);
    }

    std::fs::rename(&temp, path)
        .with_context(|| format!("failed to replace {}", path.display()))
}

fn write_rebased(source: &Path, temp: &Path, lead: &Lead) -> Result<()> {
    let mut input = ffmpeg::format::input(source)
        .with_context(|| format!("failed to open {}", source.display()))?;
    // Force the mp4 muxer: the temp path has a non-mp4 extension on purpose, so
    // the finished clip never shows up in a library scan as a stray duplicate.
    let mut output = ffmpeg::format::output_as(temp, "mp4")
        .with_context(|| format!("failed to create {}", temp.display()))?;

    let mut map: Vec<StreamMap> = Vec::new();
    for stream in input.streams() {
        let in_time_base = stream.time_base();
        let parameters = stream.parameters();
        let codec = parameters.id();
        let mut out_stream = output.add_stream(codec)?;
        out_stream.set_parameters(parameters);
        map.push(StreamMap {
            in_index: stream.index(),
            out_index: out_stream.index(),
            in_time_base,
            out_time_base: in_time_base,
            offset: rescale(lead.ts, lead.time_base, in_time_base),
        });
    }
    if map.is_empty() {
        anyhow::bail!("no streams to remux");
    }

    output.write_header()?;

    // Output time bases are only known after the header is written.
    for entry in map.iter_mut() {
        if let Some(stream) = output.stream(entry.out_index) {
            entry.out_time_base = stream.time_base();
        }
    }

    for (stream, mut packet) in input.packets() {
        let Some(entry) = map.iter().find(|entry| entry.in_index == stream.index()) else {
            continue;
        };
        let entry = *entry;
        // Shift the origin so the earliest packet lands on zero.
        if let Some(pts) = packet.pts() {
            packet.set_pts(Some(pts - entry.offset));
        }
        if let Some(dts) = packet.dts() {
            packet.set_dts(Some(dts - entry.offset));
        }
        packet.set_stream(entry.out_index);
        if entry.out_time_base.0 != 0 && entry.out_time_base.1 != 0 {
            packet.rescale_ts(entry.in_time_base, entry.out_time_base);
        }
        packet.write_interleaved(&mut output)?;
    }

    output.write_trailer()?;
    Ok(())
}

/// `<clip>.mp4.repairtmp` — same folder (atomic rename), but not a `.mp4`, so it
/// is never mistaken for a clip.
fn temp_path(path: &Path) -> PathBuf {
    let mut name = path
        .file_name()
        .map(OsString::from)
        .unwrap_or_else(|| OsString::from("clip.mp4"));
    name.push(".repairtmp");
    path.with_file_name(name)
}
