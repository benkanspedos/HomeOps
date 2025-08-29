'use client';

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Loader2, Bot, User, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChatMessage, CommandIntent } from '@/hooks/useNLPWebSocket';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  pendingCommand?: CommandIntent | null;
  onConfirmCommand?: (intent: CommandIntent, confirmed: boolean) => void;
  isConnected: boolean;
  isProcessing?: boolean;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
}

export function ChatInterface({
  messages,
  onSendMessage,
  pendingCommand,
  onConfirmCommand,
  isConnected,
  isProcessing = false,
  suggestions = [],
  onSuggestionClick
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = () => {
    if (!inputValue.trim() || !isConnected || isProcessing) return;
    
    onSendMessage(inputValue.trim());
    setInputValue('');
    setShowSuggestions(false);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
    
    if (onSuggestionClick) {
      onSuggestionClick(suggestion);
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    return (
      <motion.div
        key={message.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
      >
        {!isUser && (
          <Avatar className="h-8 w-8">
            <AvatarFallback className={isSystem ? 'bg-yellow-100' : 'bg-blue-100'}>
              {isSystem ? 'S' : <Bot className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
        )}
        
        <div className={`max-w-[70%] ${isUser ? 'order-first' : ''}`}>
          <Card className={`p-3 ${
            isUser 
              ? 'bg-blue-500 text-white' 
              : isSystem 
                ? 'bg-yellow-50 border-yellow-200' 
                : 'bg-gray-50'
          }`}>
            <div className="space-y-2">
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              
              {message.commandExecuted && (
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {message.commandExecuted.action} {message.commandExecuted.target}
                    </Badge>
                    <span className="text-xs opacity-70">
                      {Math.round(message.commandExecuted.confidence * 100)}% confidence
                    </span>
                  </div>
                </div>
              )}
              
              {message.executionResult && (
                <div className="pt-2">
                  <div className={`flex items-center gap-1 text-xs ${
                    message.executionResult.success ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {message.executionResult.success ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    <span>{message.executionResult.message}</span>
                  </div>
                </div>
              )}
              
              <div className="text-xs opacity-50 mt-1">
                {format(new Date(message.timestamp), 'HH:mm:ss')}
              </div>
            </div>
          </Card>
        </div>
        
        {isUser && (
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-blue-100">
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        )}
      </motion.div>
    );
  };

  return (
    <Card className="flex flex-col h-full">
      {/* Connection Status Bar */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            } animate-pulse`} />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {isProcessing && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <AnimatePresence>
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-sm">Start a conversation by typing a message or command</p>
                <p className="text-xs mt-2">Try "Show system health" or "List running containers"</p>
              </div>
            ) : (
              messages.map(renderMessage)
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Command Confirmation */}
      {pendingCommand && onConfirmCommand && (
        <Alert className="mx-4 mb-4 border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">Command requires confirmation:</p>
              <p className="text-sm">{pendingCommand.description}</p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => onConfirmCommand(pendingCommand, true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onConfirmCommand(pendingCommand, false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 5).map((suggestion, index) => (
              <Badge
                key={index}
                variant="outline"
                className="cursor-pointer hover:bg-gray-100"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(e.target.value.length > 0 && suggestions.length > 0);
            }}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "Type a message or command..." : "Connecting..."}
            disabled={!isConnected || isProcessing}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || !isConnected || isProcessing}
            size="icon"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* Quick Commands */}
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-xs text-gray-500">Quick commands:</span>
          {['System status', 'List containers', 'Show alerts', 'DNS status'].map((cmd) => (
            <Badge
              key={cmd}
              variant="outline"
              className="text-xs cursor-pointer hover:bg-gray-100"
              onClick={() => {
                setInputValue(cmd);
                inputRef.current?.focus();
              }}
            >
              {cmd}
            </Badge>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default ChatInterface;