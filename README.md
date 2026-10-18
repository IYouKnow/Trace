# Trace

**Trace is a Windows screen replay tool.** It records your screen continuously in the
background, keeping a rolling buffer of the last minute or so. When something worth keeping
happens — a clutch play in a game, a bug you want to show someone — you press your hotkey and
Trace saves the last few seconds to a video file.

You don't record a session and trim it afterwards. You just leave Trace running, and save the
moment *after* it happens.

## Features

**Never miss the moment**
- A rolling replay buffer keeps the last 60 seconds in memory (adjustable from 10 to 300).
- Save a clip with a global hotkey that fires even while a fullscreen game has focus.
- Bind your own shortcuts in Settings → Hotkeys.

**Built for games**
- Hardware-accelerated, zero-copy capture keeps the performance cost low.
- Record at up to 240 fps, with the bitrate scaling to match automatically.
- If Trace has to fall back to a software encoder it warns you, so you can install a GPU
  driver before your PC starts feeling slow.

**Audio that sounds right**
- Capture system sound, your microphone, or both at once.
- Pick exactly which playback and recording devices to use.
- Test your microphone in Settings with a live level meter before you record.

**Multi-monitor aware**
- Choose which display Trace records instead of always taking the primary one.
- If the display you picked gets unplugged, Trace quietly falls back to your primary monitor.

**A real clip library**
- Every clip is shown as a thumbnail.
- Play one in a fullscreen player with keyboard controls — space to play or pause, arrow keys
  to seek, Esc to close — or open it in your default player.
- Reveal any clip in its folder, or delete it. Deleted clips go to the **Recycle Bin**, so a
  mistake is easy to undo.
- Clips saved by older versions are repaired automatically.

**Stays out of the way**
- Runs in the system tray so it's out of your way while you play.
- Optionally starts with Windows, so your buffer is always warm.
- Light and dark themes.

## Getting started

1. Download the latest installer from the [Releases page](https://github.com/IYouKnow/Trace/releases)
   and run it.
2. Open Trace and press the play button on the **Home** screen to start the replay buffer.
3. Go and play. When something happens, press **Save clip** — or your hotkey — and the last
   minute is written to disk.
4. Your clips appear in the **Library**, and the most recent ones show up on Home.

## Where clips are saved

Clips are ordinary `.mp4` files, saved to `Videos\Trace` — for example
`C:\Users\<you>\Videos\Trace`. The exact path is shown in Settings → Storage.

## Requirements

- Windows (64-bit).
- A GPU with a hardware video encoder is recommended. Without one, Trace uses a software
  encoder and tells you about it.

## Updates

Trace checks for new versions by itself and lets you know when one is available, whether or not
the window is open. Click **Update & restart** in Settings → Updates to install it. What changed
in each version is listed right there, and shown once after an update.

## Feedback

Found a bug, or have an idea? Please [open an issue](https://github.com/IYouKnow/Trace/issues).
