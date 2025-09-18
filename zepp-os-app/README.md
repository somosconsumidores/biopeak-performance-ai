# BioPeak Sync - Zepp OS App

BioPeak Sync é um aplicativo para relógios Zepp OS que permite sincronizar atividades físicas diretamente com a plataforma BioPeak AI.

## Funcionalidades

- ✅ Sincronização real de atividades do relógio para o BioPeak
- ✅ Sistema de pareamento seguro com conta BioPeak
- ✅ Coleta de dados de frequência cardíaca, passos, GPS e calorias
- ✅ Interface simples com feedback visual e vibratório
- ✅ Compatibilidade com relógios Zepp OS 2.0+

## Arquitetura

### Device App (Relógio)
- Interface síncrona sem async/await (compatível com Zepp OS)
- Coleta dados dos sensores localmente
- Comunicação BLE com Side Service
- Feedback imediato via UI e vibração

### Side Service (App Zepp no smartphone)
- Recebe mensagens do relógio via BLE  
- Sistema de pareamento com códigos temporários
- Persistência segura de tokens JWT
- Envio para backend BioPeak com autenticação

### Backend Integration
- Edge Function: `zepp-sync` com validação JWT
- Rate limiting por usuário/dispositivo
- Armazenamento padronizado (activity_source: 'ZEPP')
- Integração com métricas de performance

## Fluxo de Pareamento

### 1. Geração de Código (PWA BioPeak)
```javascript
// No dashboard BioPeak (biopeak-ai.com)
// Usuário logado clica "Parear Dispositivo Zepp"
POST /pair-zepp/create
→ { pairing_code: "ABC123", expires_in: 600 }
```

### 2. Pareamento no Relógio
```javascript
// Device App envia código via BLE para Side Service
// Side Service confirma com backend
POST /pair-zepp/confirm
{
  "pairing_code": "ABC123",
  "device_info": { "platform": "zepp_os", "app_version": "1.1.0" }
}
→ { success: true, jwt_token: "...", device_id: "zepp_..." }
```

### 3. Sincronização de Atividades
```javascript
// Após pareamento, sincronizações usam JWT
POST /zepp-sync
Headers: { Authorization: "Bearer <jwt>" }
Body: { device_id, activity_data, user_profile }
→ { success: true, activity_id: "zepp_...", message: "..." }
```

## Instalação e Desenvolvimento

### Pré-requisitos
- Zepp OS Developer Tools (zeus-cli)
- Conta de desenvolvedor Zepp
- Node.js 16+

### Setup Local

1. Clone o repositório
```bash
git clone <repo-url>
cd zepp-os-app
```

2. Instale dependências do Zeus CLI
```bash
npm install -g @zos/zeus-cli
```

3. Inicie o simulador
```bash
zeus dev
```

4. Para testar em dispositivo real
```bash
zeus preview
```

### Build para Produção

```bash
# Build completo
zeus build

# Output: dist/app.zab (pronto para Zepp Store)
```

## Estrutura de Arquivos

```
zepp-os-app/
├── app.json              # Config: appId 1013562, version 1.1.0
├── page/
│   └── index.page.js     # UI do relógio (100% síncrona)
├── app-side/
│   └── index.js         # Side Service com pareamento JWT
├── assets/
│   ├── icon.png         # 240x240 transparente
│   └── preview-*.png    # 360x360 round/square
└── README.md
```

## Desenvolvimento e Debug

### Logs Estruturados
```javascript
// Device App
const logger = log.getLogger('biopeak-sync')
logger.info('🚀 Starting sync')

// Side Service  
const logger = log.getLogger('biopeak-side-service')
logger.info('📤 Sending to API', { jwt_present: !!token })
```

### Simulador vs Device Real
```bash
# Simulador (desenvolvimento)
zeus dev --platform=round   # Relógios redondos
zeus dev --platform=square  # Relógios quadrados

# Device real (teste final)
zeus preview  # QR code no app Zepp
```

### Troubleshooting

**Device App não conecta ao Side Service**
- Confirme app Zepp aberto no smartphone
- Reinicie Bluetooth
- Execute `zeus preview` novamente

**Pareamento falha**
- Código expirou (10 min max)
- Gere novo código no PWA BioPeak
- Verifique internet do smartphone

**Sincronização com erro 401**
- JWT expirado, refaça pareamento
- Side Service limpa credenciais automaticamente

## Preparação para Store (Upgrade)

### Checklist de Submissão
- [x] `app.json` válido com version.code=2
- [x] Ícone 240x240 PNG transparente  
- [x] Previews 360x360 (round + square)
- [x] Texto PT/EN para descrição
- [x] Mantém mesmo appId (1013562) para upgrade
- [x] Teste completo: simulador + device real

### Release Notes (PT-BR)
```
v1.1.0 - Sincronização Real
✅ Nova: Sincronização real de atividades com BioPeak (Supabase)
✅ Pareamento simples: vincule seu relógio à conta BioPeak uma vez
✅ Filtros: visualize "Zepp" ao lado de Garmin/Strava no dashboard  
✅ Estabilidade: melhorias de logs e confiabilidade de envio
```

### Release Notes (EN)
```
v1.1.0 - Real Sync
✅ New: Real activity sync with BioPeak backend (Supabase)
✅ Simple pairing: link your watch to BioPeak account once
✅ Source filter: see "Zepp" alongside Garmin/Strava in dashboard
✅ Stability: improved logs and sync reliability
```

### Upload na Store
1. [Zepp Developer Console](https://developers.zepp.com)
2. App Management → Upload
3. Selecione `dist/app.zab`
4. Preencha informações (manter appId)
5. Submit para review

## Testing Checklist

### Funcionalidades Core
- [x] **Pareamento**: PWA gera código → relógio pareia → JWT salvo
- [x] **Sincronização**: Atividade → relógio → Side Service → backend
- [x] **UI**: Status visual (pronto/sincronizando/sucesso/erro)
- [x] **Persistência**: JWT mantido após restart do app
- [x] **Rate Limit**: Não permite spam de sync (1 min)

### Edge Cases
- [x] **Token expirado**: Side Service limpa e pede novo pareamento
- [x] **Sem internet**: Erro claro "Network error" 
- [x] **BLE desconectado**: Indicador visual vermelho
- [x] **Código inválido**: Mensagem de erro no pareamento

### Compatibilidade  
- [x] **Simulador**: Round + Square displays
- [x] **Device real**: Teste em relógio físico
- [x] **PWA**: Dashboard mostra atividades "ZEPP"
- [x] **Filtros**: ActivitySourceFilter diferencia ZEPP vs ZEPP_GPX

## Suporte Técnico

**Email**: dev@biopeak.com  
**Docs**: https://docs.biopeak.com/zepp-integration  
**Supabase**: https://supabase.com/dashboard/project/grcwlmltlcltmwbhdpky