
# Ring Timelapse generator

A Docker container that periodically takes snapshots from your [Ring](https://www.ring.com) cameras and then creates timelapse videos of the snapshots.

**Fork of [wictorwilen/ring-timelapse](https://github.com/wictorwilen/ring-timelapse)**

## What's Different in This Fork

- **Live-capture mode**: Records 3 seconds of live stream and extracts a frame, yielding **full 2K resolution** instead of Ring's default 640px snapshots
- **Skip devices**: Exclude specific cameras from snapshots (useful for battery-powered cams)
- **Custom cron schedules**: Configure snapshot and timelapse timing at container runtime (no rebuild needed)
- Updated to **Node.js 22 Alpine** for better compatibility with WebRTC streaming

[![MIT License](https://img.shields.io/apm/l/atomic-design-ui.svg?)](https://github.com/wictorwilen/ring-timelapse/blob/main/LICENSE.md)

## Features

- Records live streams from Ring cameras for full-resolution snapshots (2K/4K capable)
- Takes snapshots periodically (configurable via cron)
- Creates timelapse videos from snapshots (optional)
- Runs as a Docker container with minimal footprint
- Skip specific cameras to avoid battery drain
- Configurable schedules at container runtime

> **NOTE**: Live-capture mode uses streaming, which may drain battery faster on battery-powered cameras. Use `SKIPPED_DEVICES` to exclude them.

## Installation

1. Generate a Ring refresh token:

``` bash
npx -p ring-client-api ring-auth-cli
```

2. Create a directory for snapshots/timelapses:

``` bash
mkdir -p /media/timelapse
```

3. Run the container:

``` bash
docker run \
  -d \
  --name ring-timelapse \
  -e TOKEN="<insert token here>" \
  -e USE_LIVE_CAPTURE="true" \
  -e CRON_SCHEDULE="0 12 * * *" \
  -v "/media/timelapse:/app/dist/target" \
  --restart unless-stopped \
  wictorwilen/ring-timelapse:latest
```

Replace the token and adjust paths/schedules as needed.

## Environment Variables

### Required

- `TOKEN` — Your Ring refresh token (see Installation)

### Optional

- `USE_LIVE_CAPTURE` — Record live stream for full-resolution snapshots instead of API snapshots (default: `false`). Set to `true` for 2K quality.
- `CRON_SCHEDULE` — Crontab schedule for snapshots (default: `*/15 * * * *` = every 15 minutes). Examples:
  - `"0 12 * * *"` = once daily at noon
  - `"0 */6 * * *"` = every 6 hours
  - `"*/30 * * * *"` = every 30 minutes
- `CRON_SCHEDULE_TIMELAPSE` — Crontab schedule for timelapse generation. Leave unset to disable.
- `SKIPPED_DEVICES` — Comma-separated list of camera names to skip (e.g., `"Front Door,Back Door"`)

## Docker Compose Example

``` yaml
services:
  ring-timelapse:
    build:
      context: https://github.com/blairwigley-coburg/ring-timelapse.git
      dockerfile: Dockerfile
    container_name: ring-timelapse
    environment:
      - TOKEN: "<insert token here>"
      - USE_LIVE_CAPTURE: "true"
      - CRON_SCHEDULE: "0 12 * * *"
      - SKIPPED_DEVICES=Front Door
    volumes:
      - /media/timelapse:/app/dist/target
    restart: unless-stopped
```

Replace the `TOKEN` with your Ring refresh token and adjust the volumes/devices as needed.

## Original Repository

This is a fork of [wictorwilen/ring-timelapse](https://github.com/wictorwilen/ring-timelapse). Check the original for the standard snapshot-based approach.

## Authors

- Original: [@wictorwilen](https://www.github.com/wictorwilen)
- Fork improvements: Battery/resolution optimizations
  
## License

[MIT](https://choosealicense.com/licenses/mit/)
