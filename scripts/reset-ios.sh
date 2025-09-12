#!/usr/bin/env bash
set -euo pipefail

# Reset Capacitor iOS platform to ensure native project uses the current Info.plist

echo "⚙️ Limpando pasta iOS..."
rm -rf ios

echo "📦 (Re)adicionando iOS..."
npx cap add ios

echo "🧹 Build web + sync iOS..."
npm run build
npx cap sync ios

echo "✅ Finalizado. Agora rode: npx cap open ios"
