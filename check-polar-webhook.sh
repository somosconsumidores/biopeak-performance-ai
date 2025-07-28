#!/bin/bash

echo "🔍 Verificando webhooks registrados na Polar..."
echo ""

# Token ativo do usuário
ACCESS_TOKEN="aaa6f4948905ad1ad6c4847604ef368b"

# URL do nosso webhook
WEBHOOK_URL="https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/polar-activities-webhook"

echo "Token usado: ${ACCESS_TOKEN:0:8}..."
echo "Webhook esperado: $WEBHOOK_URL"
echo ""

# Listar webhooks existentes
echo "📋 Listando webhooks existentes:"
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     https://www.polaraccesslink.com/v3/notifications

echo ""
echo ""

# Tentar registrar nosso webhook (caso não esteja registrado)
echo "📝 Tentando registrar nosso webhook:"
curl -s -X POST \
     -H "Authorization: Bearer $ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d "{\"url\": \"$WEBHOOK_URL\"}" \
     https://www.polaraccesslink.com/v3/notifications

echo ""