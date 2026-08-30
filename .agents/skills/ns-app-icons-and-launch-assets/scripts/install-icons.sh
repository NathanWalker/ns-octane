#!/usr/bin/env bash
# Install a 1024x1024 PNG at every size the project already declares.
#   scripts/install-icons.sh icon-1024.png [App_Resources]
# iOS: fills the existing AppIcon.appiconset files (Contents.json stays valid).
# Android: mipmap-*/ic_launcher.png at the five launcher densities.
set -euo pipefail
SRC="${1:?icon-1024.png}"; AR="${2:-App_Resources}"
D="$AR/iOS/Assets.xcassets/AppIcon.appiconset"
for f in "$D"/icon-*.png; do
  sz=$(sips -g pixelWidth "$f" | tail -1 | awk '{print $2}')
  sips -Z "$sz" "$SRC" --out "$f" >/dev/null
done
cp "$SRC" "$D/icon-1024.png"
R="$AR/Android/src/main/res"
for d in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  n=${d%%:*}; sz=${d##*:}; mkdir -p "$R/mipmap-$n"
  sips -Z "$sz" "$SRC" --out "$R/mipmap-$n/ic_launcher.png" >/dev/null
done
echo "installed iOS appiconset + Android mipmaps from $SRC"
