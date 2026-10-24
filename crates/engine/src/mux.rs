//! Remuxes buffered packets into an MP4 file (stream copy, no re-encode).

use std::path::Path;

use anyhow::{bail, Result};
use ffmpeg_next as ffmpeg;
use ffmpeg::codec::packet::{Mut, Ref};
use ffmpeg::Packet;

/// Where one packet lives in the caller's slices, so packets from every stream
/// can be ordered together before writing.
enum Source {
    Video(usize),
    Audio(usize, usize),
}

/// Ordering key: packets carry both pts and dts in the shared microsecond base.
fn sort_key(packet: &Packet) -> i64 {
    packet.dts().or_else(|| packet.pts()).unwrap_or(0)
}

/// The earliest timestamp a packet carries, considering both pts and dts.
fn earliest_ts(packet: &Packet) -> Option<i64> {
    match (packet.pts(), packet.dts()) {
        (Some(pts), Some(dts)) => Some(pts.min(dts)),
        (Some(ts), None) | (None, Some(ts)) => Some(ts),
        (None, None) => None,
    }
}

/// Duplicates `packet` for writing, sharing its payload by reference count.
///
/// `av_interleaved_write_frame` takes ownership of the packet it is handed and
/// resets it, so a buffered packet (the replay ring's) must never be written
/// directly. Duplicating leaves the original intact for the next clip, and
/// sharing the buffer avoids copying the compressed bytes.
fn duplicate(packet: &Packet) -> Result<Packet> {
    let mut copy = Packet::empty();
    let ret = unsafe { ffmpeg::ffi::av_packet_ref(copy.as_mut_ptr(), packet.as_ptr()) };
    if ret < 0 {
        bail!("failed to duplicate packet: av_packet_ref returned {ret}");
    }
    Ok(copy)
}

/// Writes the video packets plus one or more audio tracks into a new MP4 at
/// `path`. Packets are stream-copied (no re-encode) and written in timestamp
/// order so the file is properly interleaved. The caller's packets are left
/// untouched.
pub fn write_mp4(
    path: &Path,
    video: (&ffmpeg::encoder::video::Encoder, &[Packet]),
    audios: &[(&ffmpeg::encoder::audio::Encoder, &[Packet])],
    in_time_base: ffmpeg::Rational,
) -> Result<()> {
    let mut output = ffmpeg::format::output(path)?;

    let (video_encoder, video_packets) = video;

    // Work on private duplicates: `av_interleaved_write_frame` consumes each
    // packet it is handed, and these packets live on in the replay ring.
    let mut video_packets: Vec<Packet> = video_packets
        .iter()
        .map(duplicate)
        .collect::<Result<Vec<_>>>()?;
    let mut audios: Vec<(&ffmpeg::encoder::audio::Encoder, Vec<Packet>)> = audios
        .iter()
        .map(|(encoder, packets)| {
            Ok((
                *encoder,
                packets.iter().map(duplicate).collect::<Result<Vec<_>>>()?,
            ))
        })
        .collect::<Result<Vec<_>>>()?;

    // The stream borrow must end before `write_header`, which sets the muxer's
    // own time base.
    let video_index = {
        let mut stream = output.add_stream(video_encoder.id())?;
        stream.set_parameters(video_encoder);
        stream.index()
    };

    let mut audio_indices = Vec::with_capacity(audios.len());
    for (encoder, _) in audios.iter() {
        let index = {
            let mut stream = output.add_stream(encoder.id())?;
            stream.set_parameters(encoder);
            stream.index()
        };
        audio_indices.push(index);
    }

    output.write_header()?;

    // Output time bases are only known after the header is written; rescaling
    // with an unset (0/0) time base would blank the timestamps.
    let video_out_base = output
        .stream(video_index)
        .map(|stream| stream.time_base())
        .unwrap_or(in_time_base);
    let audio_out_bases: Vec<ffmpeg::Rational> = audio_indices
        .iter()
        .map(|index| {
            output
                .stream(*index)
                .map(|stream| stream.time_base())
                .unwrap_or(in_time_base)
        })
        .collect();

    // Merge every packet into one timestamp-ordered list.
    let mut order: Vec<(i64, usize, ffmpeg::Rational, Source)> =
        Vec::with_capacity(video_packets.len() + audios.iter().map(|(_, p)| p.len()).sum::<usize>());
    for (index, packet) in video_packets.iter().enumerate() {
        order.push((sort_key(packet), video_index, video_out_base, Source::Video(index)));
    }
    for (track, (_, packets)) in audios.iter().enumerate() {
        let stream_index = audio_indices[track];
        let out_base = audio_out_bases[track];
        for (index, packet) in packets.iter().enumerate() {
            order.push((sort_key(packet), stream_index, out_base, Source::Audio(track, index)));
        }
    }
    order.sort_by_key(|(key, _, _, _)| *key);

    // Packets carry absolute timestamps (microseconds since the session began),
    // so a clip taken after a long recording would otherwise keep a container
    // duration equal to the whole session while only the buffered window holds
    // real data. Rebase every packet by the earliest timestamp so the clip
    // starts at zero and its duration matches its contents. One shared offset
    // across all streams keeps audio and video in sync.
    let offset = video_packets
        .iter()
        .chain(audios.iter().flat_map(|(_, packets)| packets.iter()))
        .filter_map(earliest_ts)
        .min()
        .unwrap_or(0);

    for (_key, stream_index, out_base, source) in order {
        let packet = match source {
            Source::Video(index) => &mut video_packets[index],
            Source::Audio(track, index) => &mut audios[track].1[index],
        };
        packet.set_stream(stream_index);
        // Shift the origin before rescaling so the offset is scaled along with
        // the timestamps.
        if offset != 0 {
            if let Some(pts) = packet.pts() {
                packet.set_pts(Some(pts - offset));
            }
            if let Some(dts) = packet.dts() {
                packet.set_dts(Some(dts - offset));
            }
        }
        if out_base.0 != 0 && out_base.1 != 0 {
            packet.rescale_ts(in_time_base, out_base);
        }
        packet.write_interleaved(&mut output)?;
    }

    output.write_trailer()?;
    Ok(())
}
