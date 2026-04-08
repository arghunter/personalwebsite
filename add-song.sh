#!/usr/bin/env bash
# Usage: ./add-song.sh <youtube-url> [filename]
# Downloads the audio, uploads to catbox.moe, prints the track entry.

set -e

URL="${1:-}"
FILENAME="${2:-}"

if [[ -z "$URL" ]]; then
  echo "Usage: $0 <youtube-url> [filename]"
  exit 1
fi

if ! command -v yt-dlp &>/dev/null; then
  echo "yt-dlp not found. Install: brew install yt-dlp / pip install yt-dlp"
  exit 1
fi

# Extract video ID
VIDEO_ID=$(echo "$URL" | grep -oP '(?:v=|youtu\.be/|embed/)([a-zA-Z0-9_-]{11})' | grep -oP '[a-zA-Z0-9_-]{11}' | head -1)
if [[ -z "$VIDEO_ID" ]]; then
  echo "Could not extract video ID from: $URL"
  exit 1
fi

# Fetch title/artist via oEmbed
OEMBED=$(curl -sf "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${VIDEO_ID}&format=json" || true)
if [[ -n "$OEMBED" ]]; then
  TITLE=$(echo "$OEMBED" | grep -oP '"title"\s*:\s*"\K[^"]+' | sed "s/'/\\\\'/g")
  ARTIST=$(echo "$OEMBED" | grep -oP '"author_name"\s*:\s*"\K[^"]+' | sed "s/'/\\\\'/g")
else
  TITLE="Title"
  ARTIST="Artist"
fi

# Derive filename from title if not provided
if [[ -z "$FILENAME" ]]; then
  FILENAME=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//')
fi

OUTDIR="songs"
mkdir -p "$OUTDIR"
OUTFILE="$OUTDIR/$FILENAME.mp3"

if [[ ! -f "$OUTFILE" ]]; then
  echo "Downloading: $TITLE..."
  yt-dlp \
    --extract-audio \
    --audio-format mp3 \
    --audio-quality 0 \
    --output "$OUTDIR/$FILENAME.%(ext)s" \
    --quiet --no-warnings \
    "https://www.youtube.com/watch?v=$VIDEO_ID"
else
  echo "Already downloaded: $OUTFILE"
fi

echo "Uploading to catbox.moe..."
CATBOX_URL=$(curl -sf \
  -F "reqtype=fileupload" \
  -F "fileToUpload=@$OUTFILE" \
  "https://catbox.moe/user/api.php")

if [[ -z "$CATBOX_URL" || "$CATBOX_URL" != https://* ]]; then
  echo "Upload failed (got: $CATBOX_URL)"
  exit 1
fi

echo ""
echo "── Paste into SecretPlayer.vue ───────────────────────────────"
printf "  { id: '%s', url: '%s', title: '%s', artist: '%s' },\n" \
  "$VIDEO_ID" "$CATBOX_URL" "$TITLE" "$ARTIST"
echo ""
