import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Message } from '@/types';

interface ChatPanelProps {
  messages: Message[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
}

export function ChatPanel({ messages, currentUserId, onSendMessage }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="absolute md:relative bottom-0 right-0 z-20 w-full md:w-80 h-[60vh] md:h-full bg-neutral-900 border-t md:border-t-0 md:border-l border-neutral-800 flex flex-col shadow-2xl md:shadow-none">
      <div className="h-12 border-b border-neutral-800 flex items-center px-4">
        <h3 className="font-medium text-white">Chat</h3>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 min-h-0 p-4">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-8">
              No messages yet. Start the conversation!
            </p>
          ) : (
            messages.map((message) => {
              const isOwn = message.userId === currentUserId;

              return (
                <div key={message.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] ${isOwn ? 'bg-blue-600' : 'bg-neutral-800'} px-3 py-2`}>
                    {!isOwn && (
                      <span className="text-xs text-neutral-400 block mb-1">
                        {message.userName}
                      </span>
                    )}
                    <p className="text-sm text-white">{message.text}</p>
                  </div>
                  <span className="text-xs text-neutral-500 mt-1">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-neutral-800">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-neutral-800 border-neutral-700 rounded-none text-white placeholder:text-neutral-500"
          />
          <Button
            onClick={handleSend}
            size="icon"
            className="rounded-none bg-blue-600 hover:bg-blue-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
