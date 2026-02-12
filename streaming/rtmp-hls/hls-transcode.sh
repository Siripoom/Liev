#!/bin/sh
set -eu

STREAM_NAME="$1"
OUT_DIR="/var/www/hls/live/$STREAM_NAME"
mkdir -p "$OUT_DIR"

exec ffmpeg -nostdin -hide_banner -loglevel warning \
  -i "rtmp://127.0.0.1/live/$STREAM_NAME" \
  -map 0:v:0 -map 0:a:0? \
  -c:v copy \
  -c:a aac -b:a 128k -ac 2 \
  -f hls \
  -hls_time 2 \
  -hls_list_size 6 \
  -hls_flags delete_segments+append_list+omit_endlist \
  -hls_segment_filename "$OUT_DIR/segment_%03d.ts" \
  "$OUT_DIR/index.m3u8"
