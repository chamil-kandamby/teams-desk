#!/usr/bin/env bash
# Installs dependencies and registers Teams Desk with the desktop (per user).
#   scripts/install.sh                  install / update
#   scripts/install.sh --default-handler  also make it the handler for msteams: links
#   scripts/install.sh --uninstall      remove desktop entry, icons and autostart
set -euo pipefail
APP_DIR="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
DESKTOP_FILE="$DATA/applications/teams-desk.desktop"
SIZES=(16 24 32 48 64 128 256 512)

if [[ "${1:-}" == "--uninstall" ]]; then
  rm -f "$DESKTOP_FILE" "$HOME/.config/autostart/teams-desk.desktop"
  for s in "${SIZES[@]}"; do rm -f "$DATA/icons/hicolor/${s}x${s}/apps/teams-desk.png"; done
  update-desktop-database "$DATA/applications" 2>/dev/null || true
  echo "Removed. App data is kept in ~/.config/teams-desk"
  exit 0
fi

cd "$APP_DIR"
npm ci --no-fund --no-audit
node node_modules/electron/install.js
chmod +x bin/teams-desk

for s in "${SIZES[@]}"; do
  install -Dm644 "assets/icon-$s.png" "$DATA/icons/hicolor/${s}x${s}/apps/teams-desk.png"
done
gtk-update-icon-cache -q -t "$DATA/icons/hicolor" 2>/dev/null || true

install -d "$DATA/applications"
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=Teams Desk
GenericName=Microsoft Teams client
Comment=Microsoft Teams with a tray icon that survives screen locks
Exec="$APP_DIR/bin/teams-desk" %U
Icon=teams-desk
StartupWMClass=teams-desk
StartupNotify=true
Terminal=false
Categories=Network;Chat;InstantMessaging;
Keywords=teams;microsoft;chat;meeting;call;
MimeType=x-scheme-handler/msteams;
Actions=new-window;

[Desktop Action new-window]
Name=New Window
Exec="$APP_DIR/bin/teams-desk" --new-window
EOF
update-desktop-database "$DATA/applications" 2>/dev/null || true

if [[ "${1:-}" == "--default-handler" ]]; then
  xdg-mime default teams-desk.desktop x-scheme-handler/msteams
  echo "msteams: links now open in Teams Desk"
fi
echo "Installed: $DESKTOP_FILE"
