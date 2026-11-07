#!/bin/zsh
# Rebuild revamp/ost/ from the full OST folder: 45 s preview clips (starts 20% in,
# fades in/out, no embedded art) plus 480px covers, and prints the track table
# that ost.js embeds. Usage: ./build-ost-previews.sh "/path/to/VECTOR DRIFT OST"
set -e
SRC="${1:?path to the OST folder}"; OUT="$(cd "$(dirname "$0")" && pwd)/ost"; LEN=45
mkdir -p "$OUT"; i=0
for f in "$SRC"/*.mp3; do
  i=$((i+1)); n=$(printf %02d $i)
  title=$(ffprobe -v error -show_entries format_tags=title -of csv=p=0 "$f")
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
  start=$(python3 -c "d=$dur;print(round(max(0,min(d*0.2,d-$LEN)),2))")
  clip=$(python3 -c "print(min($LEN,$dur))")
  ffmpeg -v error -y -ss "$start" -t "$clip" -i "$f" -vn -af "afade=t=in:d=0.4,afade=t=out:st=$(python3 -c "print(max(0,$clip-2))"):d=2" -c:a libmp3lame -b:a 96k -ar 44100 -map_metadata -1 "$OUT/$n.mp3"
  ffmpeg -v error -y -i "$f" -an -vf scale=480:480 -q:v 4 -frames:v 1 "$OUT/$n.jpg"
  printf '  [%s, %s, %s],\n' "\"$title\"" "$(python3 -c "print(round($dur))")" "$start"
done
