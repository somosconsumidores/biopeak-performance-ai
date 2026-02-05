
# Plano: Substituir Menu "Nutrição" pelo "Chat" (AI Coach)

## Resumo
Substituir o item "Nutrição" no menu inferior dos apps nativos pelo "AI Coach" com o label "Chat", garantindo que apenas assinantes ativos tenham acesso à funcionalidade.

## Mudanças

### 1. MobileBottomBar.tsx
| O que muda | Detalhes |
|------------|----------|
| Item "Nutrição" → "Chat" | Path: `/ai-coach`, Icon: `MessageCircle`, Label: "Chat" |
| Importar `useSubscription` | Para verificar status de assinatura |
| Importar `useToast` | Para feedback ao usuário |
| Lógica de navegação | Se não-assinante, redirecionar para `/paywall2` com toast explicativo |

### 2. AICoach.tsx
| O que muda | Detalhes |
|------------|----------|
| Importar `useSubscription` | Hook já existente no projeto |
| Remover `hasAccess = true` | Substituir pela verificação real |
| Paywall inline | Seguir padrão do `Evolution.tsx` para não-assinantes |

## Detalhes Técnicos

### MobileBottomBar - Nova lógica de navegação
```tsx
// Novo import
import { MessageCircle } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/hooks/use-toast';

// Novo item no array
{ path: '/ai-coach', icon: MessageCircle, label: 'Chat', isCenter: false, requiresSubscription: true }

// Lógica no handleNavigation
if (item.requiresSubscription && !isSubscribed) {
  toast({ title: "Recurso Premium", description: "O Chat com Coach IA é exclusivo para assinantes." });
  navigate('/paywall2');
  return;
}
navigate(item.path);
```

### AICoach.tsx - Verificação de assinatura
Seguir o mesmo padrão do `Evolution.tsx`:
- Verificar `isSubscribed` do hook `useSubscription`
- Se não-assinante, mostrar paywall inline com benefícios do Chat IA
- Se assinante, renderizar o `AICoachChat` normalmente

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/MobileBottomBar.tsx` | Substituir item Nutrição por Chat + lógica de assinatura |
| `src/pages/AICoach.tsx` | Adicionar verificação de assinatura + paywall inline |

## Resultado Esperado
- Menu inferior mostra: Início, Treinos, Evolução (central), Plano, **Chat**
- Não-assinantes que clicam em "Chat" são redirecionados para paywall com toast
- A página `/ai-coach` exibe paywall inline para não-assinantes
- Assinantes têm acesso normal ao chat conversacional
