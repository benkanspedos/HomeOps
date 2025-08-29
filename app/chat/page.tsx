'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle, Mic, Command, HelpCircle, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChatInterface } from '@/components/nlp/ChatInterface';
import { VoiceInput } from '@/components/nlp/VoiceInput';
import { useNLPWebSocket } from '@/hooks/useNLPWebSocket';
import { useCommandSuggestions } from '@/hooks/useCommandSuggestions';
import { Toaster } from 'sonner';

export default function NaturalLanguagePage() {
  const [userId] = useState(() => {
    // Generate or get user ID from session/auth
    return localStorage.getItem('homeops_user_id') || 
           `user_${Math.random().toString(36).substr(2, 9)}`;
  });
  
  const [sessionId] = useState(() => {
    // Generate session ID
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  });

  const [activeTab, setActiveTab] = useState('chat');
  const [inputValue, setInputValue] = useState('');

  // Initialize WebSocket connection
  const {
    connected,
    messages,
    voiceStatus,
    pendingCommand,
    sendMessage,
    sendVoiceData,
    confirmCommand,
    stats
  } = useNLPWebSocket({
    userId,
    sessionId,
    autoConnect: true
  });

  // Command suggestions
  const {
    suggestions,
    quickCommands,
    addToHistory,
    getSuggestionsByCategory,
    allCommands
  } = useCommandSuggestions(inputValue);

  // Save user ID to localStorage
  useEffect(() => {
    localStorage.setItem('homeops_user_id', userId);
  }, [userId]);

  // Handle message sending
  const handleSendMessage = (message: string) => {
    sendMessage(message);
    addToHistory(message);
    setInputValue('');
  };

  // Handle voice data
  const handleVoiceData = (audioData: ArrayBuffer) => {
    sendVoiceData(audioData);
  };

  // Handle command confirmation
  const handleCommandConfirmation = (intent: any, confirmed: boolean) => {
    confirmCommand(intent, confirmed);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-6 w-6 text-blue-500" />
              <h1 className="text-2xl font-bold">Natural Language Interface</h1>
              <Badge variant={connected ? 'default' : 'destructive'}>
                {connected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
            
            {stats && (
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>Active Sessions: {stats.activeSessions}</span>
                <span>Messages: {stats.totalMessages}</span>
                <span>Users: {stats.connectedUsers}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Interface */}
          <div className="lg:col-span-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="chat" className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="voice" className="flex items-center gap-2">
                  <Mic className="h-4 w-4" />
                  Voice
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="mt-4">
                <div className="h-[600px]">
                  <ChatInterface
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    pendingCommand={pendingCommand}
                    onConfirmCommand={handleCommandConfirmation}
                    isConnected={connected}
                    suggestions={suggestions.map(s => s.command)}
                    onSuggestionClick={handleSuggestionClick}
                  />
                </div>
              </TabsContent>

              <TabsContent value="voice" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <VoiceInput
                    onVoiceData={handleVoiceData}
                    voiceStatus={voiceStatus}
                    isConnected={connected}
                  />
                  
                  <div className="h-[600px]">
                    <ChatInterface
                      messages={messages}
                      onSendMessage={handleSendMessage}
                      pendingCommand={pendingCommand}
                      onConfirmCommand={handleCommandConfirmation}
                      isConnected={connected}
                      suggestions={suggestions.map(s => s.command)}
                      onSuggestionClick={handleSuggestionClick}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Commands */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Command className="h-4 w-4 text-gray-500" />
                <h3 className="font-semibold">Quick Commands</h3>
              </div>
              <div className="space-y-2">
                {quickCommands.map((cmd, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleSendMessage(cmd)}
                    disabled={!connected}
                  >
                    {cmd}
                  </Button>
                ))}
              </div>
            </Card>

            {/* Command Categories */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircle className="h-4 w-4 text-gray-500" />
                <h3 className="font-semibold">Command Categories</h3>
              </div>
              <div className="space-y-3">
                {(['container', 'health', 'dns', 'system', 'alert'] as const).map(category => {
                  const categoryCommands = getSuggestionsByCategory(category);
                  return (
                    <div key={category}>
                      <h4 className="text-sm font-medium capitalize mb-1">
                        {category} ({categoryCommands.length})
                      </h4>
                      <div className="text-xs text-gray-600">
                        {categoryCommands.slice(0, 3).map(cmd => cmd.command).join(', ')}
                        {categoryCommands.length > 3 && '...'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Help & Tips */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="h-4 w-4 text-gray-500" />
                <h3 className="font-semibold">Tips</h3>
              </div>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Use natural language or specific commands</li>
                <li>• Voice commands are automatically transcribed</li>
                <li>• Destructive actions require confirmation</li>
                <li>• Type "help" for command list</li>
                <li>• Commands are case-insensitive</li>
              </ul>
            </Card>

            {/* Session Info */}
            <Alert>
              <AlertDescription>
                <div className="text-xs space-y-1">
                  <p><strong>Session ID:</strong></p>
                  <p className="font-mono break-all">{sessionId.slice(0, 20)}...</p>
                  <p className="mt-2"><strong>User ID:</strong></p>
                  <p className="font-mono">{userId}</p>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>

        {/* Command Reference (Hidden by default) */}
        <details className="mt-8">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
            View All Commands ({allCommands.length})
          </summary>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allCommands.map((cmd, index) => (
              <Card key={index} className="p-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-mono">{cmd.command}</code>
                    <Badge variant="outline" className="text-xs">
                      {cmd.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600">{cmd.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}