# BioPeak Sync - Zepp OS App

Este é o aplicativo BioPeak Sync para relógios Zepp OS que permite sincronizar dados de treino diretamente com a plataforma BioPeak AI.

## Estrutura do Projeto

```
zepp-os-app/
├── app.json                    # Configuração do app
├── page/
│   └── index.page.js          # Tela principal do relógio
├── app-side/
│   └── index.js               # Side Service (app celular)
└── assets/
    ├── icon.png               # Ícone do app (72x72)
    └── preview.png            # Preview para loja (390x450)
```

## Funcionalidades

### Device App (Relógio)
- Interface simples com botão "Sincronizar com BioPeak"
- Coleta dados de atividades do relógio
- Comunica via BLE com o Side Service
- Feedback visual e tátil do status da sincronização

### Side Service (Celular)
- Recebe dados do relógio via BLE
- Autentica com a API BioPeak
- Envia dados para o backend Supabase
- Gerencia tokens de autenticação

### Fluxo de Dados
1. Usuário clica "Sincronizar" no relógio
2. Relógio coleta dados e envia via BLE
3. Side Service recebe e processa dados
4. Side Service autentica e envia para BioPeak API
5. Dados aparecem na plataforma BioPeak

## Configuração

### Pré-requisitos
- Zeus CLI instalado (`npm install @zeppos/zeus-cli -g`)
- Conta Zepp Developer ativa
- App registrado na Zepp Store

### Build e Deploy

1. **Desenvolvimento local:**
```bash
cd zepp-os-app
zeus dev
```

2. **Preview no relógio:**
```bash
zeus preview
```

3. **Build para produção:**
```bash
zeus build
```

4. **Upload para Zepp Store:**
```bash
zeus upload
```

## Configuração da API

O Side Service está configurado para conectar com:
- URL: `https://grcwlmltlcltmwbhdpky.supabase.co/functions/v1/zepp-sync`
- Requer autenticação JWT do usuário BioPeak
- Headers incluem apikey pública do Supabase

## Autenticação

⚠️ **Importante**: O usuário deve estar logado no app BioPeak (PWA) primeiro para que o token de autenticação seja válido.

O Side Service atualmente usa um token mock. Em produção, implementar:
1. OAuth flow através do app companion
2. Armazenamento seguro do token
3. Refresh token automático

## Dados Sincronizados

### Atividade Base
- Tipo de atividade
- Horário de início e duração
- Distância e calorias
- Informações do dispositivo

### Dados Detalhados (quando disponível)
- Amostras de frequência cardíaca
- Coordenadas GPS
- Altitude e velocidade
- Passos e cadência

## Logs e Debugging

Os logs são gerados em:
- **Device App**: Console do Zeus CLI
- **Side Service**: Console do app Zepp

Use `logger.info()` para adicionar logs customizados.

## Limitações Atuais

1. **Mock Data**: Device App gera dados simulados
2. **Autenticação**: Token hardcoded no Side Service
3. **Sensores**: Não conectado aos sensores reais do relógio
4. **Offline**: Sem sincronização offline

## Próximos Passos

1. Conectar com sensores reais (@zos/sensor)
2. Implementar autenticação OAuth real
3. Adicionar sincronização automática
4. Melhorar tratamento de erros
5. Implementar cache offline

## Suporte

Para suporte técnico:
- Documentação Zepp OS: https://docs.zepp.com/
- Comunidade BioPeak: Discord/Telegram
- Issues: GitHub repository