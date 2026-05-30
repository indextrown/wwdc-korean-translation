#!/usr/bin/env sh
set -eu

input="${1:-screenshot.png}"

if [ ! -f "$input" ]; then
  echo "Input image not found: $input" >&2
  exit 1
fi

if [ "${2:-}" ]; then
  output="$2"
else
  dir=$(dirname "$input")
  file=$(basename "$input")
  name="${file%.*}"
  output="$dir/$name-1280x800.jpg"
fi

sips -s format jpeg -z 800 1280 "$input" --out "$output"
sips -g pixelWidth -g pixelHeight -g hasAlpha "$output"

echo "Chrome Web Store screenshot ready: $output"
