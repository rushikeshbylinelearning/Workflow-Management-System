#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${1:-}"
if [ -z "$DEPLOY_PATH" ]; then
  echo "Usage: remote-after-deploy.sh <deploy-path>"
  exit 1
fi

BACKEND_PATH="${DEPLOY_PATH}/backend"
PROCESS_MANAGER="${PROCESS_MANAGER:-}"
PM2_APP_NAME="${PM2_APP_NAME:-workflow-backend}"
BOOTSTRAP_DB="${BOOTSTRAP_DB:-false}"

cd "$BACKEND_PATH"
chmod +x "$BACKEND_PATH/remote-after-deploy.sh" 2>/dev/null || true
mkdir -p logs uploads tmp

activate_hostinger_node() {
  if command -v npm >/dev/null 2>&1; then
    return 0
  fi

  local activate
  activate="$(find "$HOME/nodevenv" -name activate -type f 2>/dev/null | head -n 1 || true)"
  if [ -n "$activate" ]; then
    # shellcheck disable=SC1090
    source "$activate"
    return 0
  fi

  if [ -d "$HOME/.nvm" ]; then
    # shellcheck disable=SC1091
    source "$HOME/.nvm/nvm.sh"
    nvm use default >/dev/null 2>&1 || true
  fi
}

activate_hostinger_node

if ! command -v npm >/dev/null 2>&1; then
  echo "npm was not found on this server."
  echo "On Hostinger: open the website dashboard → Node.js → Rebuild/Restart after files are uploaded."
  echo "On A2: enable Node.js / PM2 for this account, then re-run the workflow."
  exit 1
fi

echo "Node: $(node -v)"
echo "npm:  $(npm -v)"

if [ -f package-lock.json ]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi

if [ "$BOOTSTRAP_DB" = "true" ]; then
  echo "Bootstrapping empty staging database..."
  node bootstrap-db.js
fi

restart_pm2() {
  if ! command -v pm2 >/dev/null 2>&1; then
    return 1
  fi
  if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    pm2 reload "$PM2_APP_NAME" --update-env || pm2 restart "$PM2_APP_NAME" --update-env
  else
    pm2 start ecosystem.config.js --only "$PM2_APP_NAME" || pm2 start ecosystem.config.js
  fi
  pm2 save || true
  return 0
}

restart_passenger() {
  mkdir -p "$DEPLOY_PATH/tmp" "$BACKEND_PATH/tmp"
  touch "$DEPLOY_PATH/tmp/restart.txt" "$BACKEND_PATH/tmp/restart.txt"
}

case "$PROCESS_MANAGER" in
  pm2)
    restart_pm2
    ;;
  none)
    echo "Skipping process restart"
    ;;
  passenger|"")
    if restart_pm2; then
      echo "Restarted with PM2"
    else
      restart_passenger
      echo "Wrote Passenger/Hostinger restart trigger (tmp/restart.txt)"
    fi
    ;;
  *)
    echo "Unknown PROCESS_MANAGER='$PROCESS_MANAGER' (use pm2, passenger, or none)"
    exit 1
    ;;
esac

echo "Remote deploy steps finished in $BACKEND_PATH"
