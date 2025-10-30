# 🎵 Configuração de Áudio em Background - BioPeak

Este guia explica como configurar o feedback de áudio durante hibernação do app (estilo Strava).

## 📋 O que foi implementado

1. **iOS**: Background Audio Mode para manter TTS funcionando durante hibernação
2. **Android**: Foreground Service para manter o serviço ativo
3. **Fallback**: Notificações locais para feedback quando o áudio falhar

## 🍎 Configuração iOS (Xcode)

### 1. Adicionar Background Audio no Xcode

Após fazer `git pull` e `npx cap sync ios`:

1. Abra o projeto iOS: `npx cap open ios`
2. Selecione o target **App** no navegador de projetos
3. Vá para a aba **Signing & Capabilities**
4. Clique no botão **+ Capability**
5. Adicione **Background Modes**
6. Marque as opções:
   - ✅ **Audio, AirPlay, and Picture in Picture**
   - ✅ **Location updates** (já deve estar marcado)
   - ✅ **Background fetch** (já deve estar marcado)
   - ✅ **Background processing** (já deve estar marcado)

### 2. Verificar Info.plist

O arquivo `ios/App/App/Info.plist` já foi atualizado com:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
    <string>processing</string>
    <string>fetch</string>
    <string>audio</string> <!-- ADICIONADO -->
</array>
```

### 3. Permissões de Notificações

O app já solicita permissão de notificações automaticamente quando você inicia um treino.

## 🤖 Android - Já Configurado

O Android já estava usando o Foreground Service para manter o rastreamento ativo. Agora ele também:
- Mantém o serviço ativo durante todo o treino
- Para automaticamente ao completar ou pausar
- Mostra notificação persistente com título e corpo personalizados

## 🧪 Como Testar

### Teste de Background Audio (iOS)

1. Inicie um treino
2. Aguarde até completar 1km (feedback será acionado)
3. Coloque o app em background (pressione Home ou mude de app)
4. Aguarde completar o próximo km
5. **Resultado esperado**: Você deve ouvir o feedback por áudio mesmo com o app em background

### Teste de Notificações (Fallback)

Se o TTS falhar no background (raro no iOS com background audio ativo):
1. O app enviará uma notificação local com o feedback
2. A notificação aparecerá na tela de bloqueio/central de notificações

## 🔧 Como Funciona

### iOS Background Audio

O hook `useBackgroundAudio` cria um loop de áudio silencioso (inaudível) que mantém a sessão de áudio ativa. Isso permite que:
- O TTS (Text-to-Speech) funcione mesmo em background
- O áudio do OpenAI seja reproduzido normalmente
- A sessão não seja suspensa pelo iOS

### Android Foreground Service

O serviço já existente foi integrado para:
- Iniciar automaticamente ao começar o treino
- Parar ao completar ou pausar
- Manter o processo ativo para GPS e notificações

### Notificações Locais

Como fallback universal:
- Se o app detecta que está em background (`document.visibilityState === 'hidden'`)
- Envia notificação local além do TTS
- Garante que o usuário receba o feedback de alguma forma

## 📊 Estados do Sistema

| Estado | iOS Behavior | Android Behavior |
|--------|-------------|------------------|
| Foreground | TTS normal | TTS normal |
| Background | TTS via Background Audio + Notificação | TTS via Foreground Service + Notificação |
| Locked Screen | TTS via Background Audio + Notificação | TTS via Foreground Service + Notificação |
| App Killed | ❌ Não funciona (comportamento esperado) | ❌ Não funciona (comportamento esperado) |

## 🐛 Troubleshooting

### iOS: TTS não funciona em background

1. Verifique se a capability **Audio, AirPlay, and Picture in Picture** está ativada no Xcode
2. Verifique os logs do console: `console.log('Background audio started')`
3. Teste com fones de ouvido conectados (às vezes ajuda)
4. Verifique se o modo "Não Perturbar" não está bloqueando o áudio

### Android: Serviço não inicia

1. Verifique se as permissões de notificação foram concedidas
2. Verifique os logs: `console.log('Android Foreground Service started')`
3. Verifique se o app não está em modo de economia de bateria agressiva

### Notificações não aparecem

1. Verifique as permissões de notificação nas configurações do sistema
2. Verifique os logs: `console.log('Requesting notification permission')`
3. Tente reiniciar o app e aceitar as permissões novamente

## 🎯 Próximos Passos (Opcional)

- [ ] Adicionar controles de mídia na tela de bloqueio (iOS)
- [ ] Permitir controlar o treino pelos controles de mídia
- [ ] Vibração ao receber feedback
- [ ] Sons customizados para diferentes tipos de feedback

## 📚 Referências

- [Capacitor Background Audio](https://capacitorjs.com/docs/apis/geolocation#background-mode)
- [iOS Background Modes](https://developer.apple.com/documentation/avfoundation/media_playback_and_selection/creating_a_basic_video_player_ios_and_tvos/enabling_background_audio)
- [Android Foreground Services](https://developer.android.com/guide/components/foreground-services)
- [Capacitor Local Notifications](https://capacitorjs.com/docs/apis/local-notifications)
