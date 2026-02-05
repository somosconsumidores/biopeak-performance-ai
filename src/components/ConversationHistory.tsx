import React from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, MessageSquare, Loader2 } from 'lucide-react';
import { ConversationSession } from '@/hooks/useConversationHistory';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConversationHistoryProps {
  sessions: ConversationSession[];
  loading: boolean;
  currentConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({
  sessions,
  loading,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-xs">
        Nenhuma conversa anterior
      </div>
    );
  }

  return (
    <ScrollArea className="h-[200px]">
      <div className="space-y-1 pr-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`group flex items-center gap-2 rounded-md p-2 cursor-pointer hover:bg-accent transition-colors ${
              currentConversationId === session.id ? 'bg-accent' : ''
            }`}
            onClick={() => onSelectConversation(session.id)}
          >
            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {session.title || 'Conversa sem título'}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {session.last_message_at && formatDistanceToNow(new Date(session.last_message_at), {
                  addSuffix: true,
                  locale: ptBR
                })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteConversation(session.id);
              }}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
