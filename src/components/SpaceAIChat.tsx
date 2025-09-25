import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Bot, User, Sparkles } from 'lucide-react';
import { useGeminiChat } from '@/hooks/useGeminiChat';

interface SpaceAIChatProps {
  satelliteData?: any[];
  debrisData?: any[];
  meteorData?: any[];
  collisionRisks?: any[];
  conjunctions?: any[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const SpaceAIChat: React.FC<SpaceAIChatProps> = ({
  satelliteData = [],
  debrisData = [],
  meteorData = [],
  collisionRisks = [],
  conjunctions = []
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'مرحباً! أنا مساعد الذكي للفضاء. يمكنني تحليل وشرح جميع بيانات الأقمار الصناعية والمخلفات الفضائية والنيازك. كيف يمكنني مساعدتك؟',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { sendMessage, isLoading } = useGeminiChat();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      // Prepare context data for the AI
      const contextData = {
        satellites: satelliteData.length > 0 ? {
          count: satelliteData.length,
          types: satelliteData.reduce((acc, sat) => {
            acc[sat.orbitType] = (acc[sat.orbitType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          sample: satelliteData.slice(0, 3)
        } : null,
        debris: debrisData.length > 0 ? {
          count: debrisData.length,
          highRisk: debrisData.filter(d => d.collisionProbability > 0.1).length,
          sample: debrisData.slice(0, 3)
        } : null,
        meteors: meteorData.length > 0 ? {
          count: meteorData.length,
          approaching: meteorData.filter(m => m.daysToClosestApproach < 30).length,
          sample: meteorData.slice(0, 3)
        } : null,
        collisionRisks: collisionRisks.length > 0 ? {
          total: collisionRisks.length,
          critical: collisionRisks.filter(r => r.riskLevel === 'CRITICAL').length,
          high: collisionRisks.filter(r => r.riskLevel === 'HIGH').length
        } : null,
        conjunctions: conjunctions.length > 0 ? {
          total: conjunctions.length,
          upcoming: conjunctions.filter(c => new Date(c.time) > new Date()).length
        } : null
      };

      const response = await sendMessage(input, contextData);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isExpanded) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsExpanded(true)}
          className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300 group"
        >
          <div className="relative">
            <Bot className="h-6 w-6 text-white" />
            <Sparkles className="h-3 w-3 text-yellow-300 absolute -top-1 -right-1 animate-pulse" />
          </div>
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[600px]">
      <Card className="h-full bg-gradient-to-b from-slate-900/95 to-slate-800/95 border-slate-700 backdrop-blur-sm shadow-2xl">
        <CardHeader className="pb-3 bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <div className="relative">
                <Bot className="h-5 w-5 text-blue-400" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              </div>
              مساعد الفضاء الذكي
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="text-slate-400 hover:text-white hover:bg-slate-700/50"
            >
              ×
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 flex flex-col h-[calc(100%-4rem)]">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                        : 'bg-slate-700/80 text-slate-100 border border-slate-600'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString('ar-SA', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-slate-700/80 text-slate-100 border border-slate-600 px-4 py-2 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">جاري التحليل...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="p-4 border-t border-slate-700 bg-slate-900/50">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="اسأل عن البيانات الفضائية..."
                className="flex-1 bg-slate-800/80 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500"
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                'شرح بيانات الأقمار الصناعية',
                'تحليل المخاطر',
                'معلومات عن النيازك',
                'حالة المخلفات الفضائية'
              ].map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => setInput(suggestion)}
                  className="text-xs bg-slate-800/50 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
                  disabled={isLoading}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};