#!/usr/bin/env bash
# Usage:
#   ./manim-embed.sh <scene.py> <SceneName> [blog-slug] [--caption "text"] [--no-insert]
#
# Examples:
#   ./manim-embed.sh my_scene.py MyScene kernn
#   ./manim-embed.sh my_scene.py MyScene kernn --caption "Data flowing through a systolic array"
#   ./manim-embed.sh my_scene.py MyScene          # just renders + prints embed tag

set -e

SCRIPT="$1"
SCENE="$2"
BLOG="$3"
CAPTION=""
NO_INSERT=0

# Parse extra flags
shift 3 2>/dev/null || shift $# 2>/dev/null
while [[ $# -gt 0 ]]; do
  case "$1" in
    --caption) CAPTION="$2"; shift 2 ;;
    --no-insert) NO_INSERT=1; shift ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

if [[ -z "$SCRIPT" || -z "$SCENE" ]]; then
  echo "Usage: ./manim-embed.sh <scene.py> <SceneName> [blog-slug] [--caption \"text\"] [--no-insert]"
  exit 1
fi

if [[ ! -f "$SCRIPT" ]]; then
  echo "Error: $SCRIPT not found"
  exit 1
fi

SITE_ROOT="$(cd "$(dirname "$0")" && pwd)"
PUBLIC_DIR="$SITE_ROOT/src/public/animations"
mkdir -p "$PUBLIC_DIR"

# Slugify scene name: CamelCase → kebab-case
SLUG=$(echo "$SCENE" | sed 's/\([A-Z]\)/-\1/g' | sed 's/^-//' | tr '[:upper:]' '[:lower:]')

echo "▶ Rendering $SCENE from $SCRIPT..."
TMPDIR=$(mktemp -d)
manim -qm --format mp4 --media_dir "$TMPDIR" "$SCRIPT" "$SCENE"

# Find the output mp4
RAW_MP4=$(find "$TMPDIR" -name "*.mp4" | head -1)
if [[ -z "$RAW_MP4" ]]; then
  echo "Error: Manim did not produce an mp4"
  exit 1
fi

echo "▶ Converting to web formats..."
ffmpeg -i "$RAW_MP4" \
  -c:v libx264 -profile:v baseline -level 3.0 -pix_fmt yuv420p -movflags +faststart \
  "$PUBLIC_DIR/$SLUG.mp4" -y -loglevel error

ffmpeg -i "$RAW_MP4" \
  -c:v libvpx-vp9 -pix_fmt yuv420p -b:v 0 -crf 33 \
  "$PUBLIC_DIR/$SLUG.webm" -y -loglevel error

rm -rf "$TMPDIR"
echo "✓ Saved to src/public/animations/$SLUG.mp4 and .webm"

# Build embed tag
if [[ -n "$CAPTION" ]]; then
  EMBED="<ManimAnimation src=\"/animations/$SLUG.mp4\" caption=\"$CAPTION\" :autoplay=\"true\" :loop=\"true\" />"
else
  EMBED="<ManimAnimation src=\"/animations/$SLUG.mp4\" :autoplay=\"true\" :loop=\"true\" />"
fi

# Insert into blog if slug provided
if [[ -n "$BLOG" && $NO_INSERT -eq 0 ]]; then
  BLOG_MD="$SITE_ROOT/src/blogs/$BLOG/index.md"
  if [[ ! -f "$BLOG_MD" ]]; then
    echo "Warning: blog not found at $BLOG_MD — skipping insert"
  else
    # If this animation is already embedded, skip inserting
    if grep -qF "/animations/$SLUG.mp4" "$BLOG_MD"; then
      echo "✓ Embed already present in src/blogs/$BLOG/index.md — skipping insert"
    else
      # Insert after the first --- frontmatter block (i.e. after the second ---)
      FRONTMATTER_END=$(awk '/^---/{c++;if(c==2){print NR;exit}}' "$BLOG_MD")
      if [[ -n "$FRONTMATTER_END" ]]; then
        INSERT_LINE=$((FRONTMATTER_END + 1))
        sed -i "${INSERT_LINE}i\\${EMBED}\\n" "$BLOG_MD"
        echo "✓ Inserted embed into src/blogs/$BLOG/index.md (line $INSERT_LINE)"
      else
        echo "Warning: could not find frontmatter end in $BLOG_MD"
      fi
    fi
  fi
fi

echo ""
echo "Embed tag:"
echo "$EMBED"
