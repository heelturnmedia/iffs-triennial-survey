#!/bin/sh
# Writes runtime env vars into a JS file loaded before the app bundle.
# This allows Dokploy/Docker runtime env vars to reach a Vite SPA.
cat > /usr/share/nginx/html/env-config.js <<EOF
window.__env = {
  VITE_SUPABASE_URL:      "${VITE_SUPABASE_URL}",
  VITE_SUPABASE_ANON_KEY: "${VITE_SUPABASE_ANON_KEY}",
  VITE_MAPBOX_TOKEN:      "${VITE_MAPBOX_TOKEN}"
};
EOF
exec nginx -g 'daemon off;'
