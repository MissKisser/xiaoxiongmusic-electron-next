<div align="center">

<img alt="Xiaoxiong Music logo" width="120" height="120" src="public/icons/favicon.png" />

<h2>Xiaoxiong Music</h2>

<p>🎵 Cross-platform desktop music player with rich lyric support and wide audio format compatibility.</p>

<p>v4 line rebased on <a href="https://github.com/SPlayer-Dev/SPlayer-Next">SPlayer-Next</a>, with built-in unlock service and license management.</p>

[![Stars](https://img.shields.io/github/stars/MissKisser/xiaoxiongmusic-electron?style=flat)](https://github.com/MissKisser/xiaoxiongmusic-electron/stargazers)
[![Release](https://img.shields.io/github/v/release/MissKisser/xiaoxiongmusic-electron)](https://github.com/MissKisser/xiaoxiongmusic-electron/releases)
[![License](https://img.shields.io/github/license/MissKisser/xiaoxiongmusic-electron)](https://github.com/MissKisser/xiaoxiongmusic-electron/blob/main/LICENSE)
[![Issues](https://img.shields.io/github/issues/MissKisser/xiaoxiongmusic-electron)](https://github.com/MissKisser/xiaoxiongmusic-electron/issues)

**English** | [简体中文](./README.md)

</div>

---

## Features

- 🎵 **Broad format support** — MP3, FLAC, WAV, AAC, OGG, APE, and more, decoded via FFmpeg
- 📝 **Rich lyrics** — LRC / QRC / YRC / TTML, word-by-word highlighting and translations, with desktop, dynamic-island, and taskbar lyric windows
- 🔓 **Built-in unlock service** — Netease, Kuwo, Bodian, and Gequbao channels with automatic fallback for greyed-out tracks (plus a download-fallback switch)
- 🌐 **Streaming servers** — Subsonic / Navidrome / Jellyfin / Emby (multi-server, auto-connect)
- 🖥️ **Cross-platform** — Windows / macOS / Linux (desktop only, no web build)
- 🎚️ **Audio spectrum** — real-time FFT visualization
- 🏷️ **Metadata editing** — edit local track tags and cover art
- ⬇️ **Downloads** — built-in download manager
- 📊 **Playback stats** — daily/weekly charts, heatmaps, Top rankings
- 🎙️ **Song recognition** — loopback capture + audio fingerprinting
- 🔐 **Licensing & admin console** — client authorization plus code/version/log management (`/bamger`)
- 🗂️ **WebDAV remote playlists** — mount a remote library as local playlists
- 🔄 **Lossless upgrade** — first launch migrates v3 settings, playlists, and the local library automatically (backed up first, never migrates twice)
- 🎧 **System media integration** — Windows SMTC / Linux MPRIS / macOS Now Playing + Discord RPC
- ⚡ **High-performance audio engine** — FFmpeg + Rust
- 🎨 **Adaptive theming** — cover-based colors, Light / Dark / Auto

## Relationship with upstream

The v4 line is rebased on [SPlayer-Dev/SPlayer-Next](https://github.com/SPlayer-Dev/SPlayer-Next): upstream owns player evolution, while this repository only ports its own features back onto it (licensing, admin, embedded services, unlock, remote playlists, branding, migration). Conflicting changes follow upstream, with the Gequbao unlock channel kept as the sole exception. Upstream update channels, docs, and the plugin market stay untouched.

## Development

### Requirements

- **Node.js** >= 22.19
- **pnpm** 11.5.2 (`corepack prepare pnpm@11.5.2 --activate`)
- **Rust toolchain** (required to build the native modules)
- MSVC + Windows SDK for Windows builds

### Native Modules

| Module              | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| `audio-engine`      | High-performance audio decoding (FFmpeg), playback, FFT, covers    |
| `audio-capture`     | System audio capture (song recognition)                            |
| `media-ctrl`        | System media controls + Discord status                             |
| `opencc`            | Simplified/Traditional Chinese conversion                          |
| `taskbar-lyric`     | Native Windows taskbar lyric rendering                             |
| `taskbar-thumbnail` | Windows taskbar thumbnails                                         |

### Getting Started

```bash
# 1. Install dependencies (includes better-sqlite3 rebuild)
pnpm install

# 2. Verify with an unpacked build (never launches a window, artifacts only)
pnpm build:unpack
```

### Building

```bash
pnpm build         # Full build: clean → native → typecheck → electron-vite

pnpm build:win     # Package for Windows (includes latest.yml update metadata)
pnpm build:mac     # Package for macOS
pnpm build:linux   # Package for Linux (AppImage / deb / rpm / tar.gz / pacman)
```

> Builds target the current architecture only; cross-compilation is not supported. Publishing requires maintainer confirmation.

### Other Scripts

```bash
pnpm typecheck        # tsc + vue-tsc (node + web targets)
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm build:native     # Build the Rust native modules only (add `--dev` for debug)
pnpm test             # Node tests + web tests
pnpm test:native      # Rust tests
```

## Acknowledgements

Thanks to the open-source projects and the upstream author that make this possible:

- [SPlayer-Next](https://github.com/SPlayer-Dev/SPlayer-Next) (by [imsyy](https://github.com/imsyy)) — the v4 baseline player
- [applemusic-like-lyrics](https://github.com/Steve-xmh/applemusic-like-lyrics) — Apple Music-style lyrics component library
- [NeteaseCloudMusicApiEnhanced](https://github.com/neteasecloudmusicapienhanced/api-enhanced) — NetEase Cloud Music API
- Embedded `server/` submodule: [xiaoxiongmusic-server](https://github.com/MissKisser/xiaoxiongmusic-server) (cloud licensing and version APIs)

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](https://www.gnu.org/licenses/agpl-3.0.html); the full text ships in `LICENSE`.

- **Modification & distribution:** must stay under **AGPL-3.0** with complete source code provided.
- **Derivative works:** must adopt **AGPL-3.0** and retain the license and copyright notices of this project and upstream.
- **Attribution:** the original author and upstream project must be credited; the About page keeps its attribution to upstream contributors.
- **Network service clause:** serve a modified version over a network and you must offer the corresponding source under AGPL-3.0 Section 13.
- **No warranty:** the software is provided "as is".

## Disclaimer

This project is for personal learning and research only, and must not be used for commercial or unlawful purposes. Some features rely on third-party APIs; users are solely responsible for complying with applicable laws, regulations, and service agreements. The authors accept no liability for any direct or indirect consequences arising from its use.
