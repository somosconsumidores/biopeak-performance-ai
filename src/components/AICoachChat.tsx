import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Send, MessageCircle, Trash2, Volume2, VolumeX, Plus } from 'lucide-react';
import { useEnhancedAICoachChat } from '@/hooks/useEnhancedAICoachChat';
import { useEnhancedTTS } from '@/hooks/useEnhancedTTS';
import { toast } from 'sonner';

export const AICoachChat = () => {
  const { messages, loading, error, sendMessage, clearMessages, startNewConversation } = useEnhancedAICoachChat();
  const { speak, stop, isEnabled, isSpeaking, toggle: toggleTTS } = useEnhancedTTS();
  const [inputMessage, setInputMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || loading) return;

    const messageToSend = inputMessage;
    setInputMessage('');
    
    try {
      await sendMessage(messageToSend);
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('Falha ao enviar mensagem');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSpeakMessage = (content: string) => {
    if (isSpeaking) {
      stop();
    } else {
      speak(content, { priority: 'high' });
    }
  };

  const formatMessageTime = (timestamp: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp);
  };

  return (
    <Card className="flex flex-col w-full h-[700px]">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">BioPeak AI Coach</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={startNewConversation}
              className="h-8 px-2 text-muted-foreground hover:text-primary"
              title="Nova conversa"
            >
              <Plus className="h-4 w-4 mr-1" />
              <span className="text-xs">Nova</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTTS}
              className={`h-8 w-8 p-0 ${isEnabled ? 'text-primary' : 'text-muted-foreground'}`}
              title={isEnabled ? 'Desativar áudio' : 'Ativar áudio'}
            >
              {isEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearMessages}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              title="Limpar conversa"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Separator />
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-4 gap-3 min-h-0">
        {/* Messages Area */}
        <ScrollArea className="flex-1 h-full" ref={scrollAreaRef}>
          <div className="space-y-4 pr-4 pb-2">
            {messages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">
                  Olá! Sou seu treinador IA pessoal. Posso analisar seus dados de treino e dar recomendações personalizadas.
                </p>
                <p className="text-xs mt-2 opacity-75">
                  Experimente perguntar: "Como está minha performance?" ou "O que devo treinar hoje?"
                </p>
              </div>
            )}
            
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 text-sm break-words ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {message.role === 'assistant' 
                      ? message.content
                          .replace(/[*_`~>#]/g, '')
                          .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
                          .replace(/\s{2,}/g, ' ')
                          .trim()
                      : message.content
                    }
                  </div>
                  <div className="flex items-center justify-between mt-2 gap-2">
                    <div
                      className={`text-xs opacity-70 ${
                        message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}
                    >
                      {formatMessageTime(message.timestamp)}
                    </div>
                    {message.role === 'assistant' && isEnabled && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-70 hover:opacity-100"
                        onClick={() => handleSpeakMessage(message.content)}
                        title={isSpeaking ? 'Parar áudio' : 'Ouvir mensagem'}
                      >
                        <Volume2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-xs text-muted-foreground">Analisando seus dados...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="flex-shrink-0 flex gap-2 pt-2">
          <Input
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua pergunta sobre treino..."
            disabled={loading}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={loading || !inputMessage.trim()}
            size="icon"
            className="flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div className="text-xs text-destructive text-center py-2">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
};