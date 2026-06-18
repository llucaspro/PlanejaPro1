import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Send, Loader2, MessageSquare, RotateCcw, Lightbulb, Lock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useAssistantChat } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  "Crie uma atividade prática sobre fotossíntese para o 7º ano",
  "Como adaptar esta aula para alunos com TDAH?",
  "Sugira uma avaliação diagnóstica para início de ano",
  "Transforme esta aula expositiva em sala de aula invertida",
  "Como engajar uma turma desmotivada?",
  "Explique o conceito de aprendizagem por projetos",
];

const PREMIUM_BENEFITS = [
  "Assistente pedagógico ilimitado",
  "Apoio para planejamento",
  "Sugestões metodológicas",
  "Estratégias de recuperação",
  "Atividades personalizadas",
  "Auxílio para adaptação de conteúdo",
];

function PremiumOverlay() {
  const waLink = "https://wa.me/5514997966714?text=Ol%C3%A1!%20Gostaria%20de%20liberar%20meu%20acesso%20Premium%20ao%20PlanejaPro.";

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-card border border-border shadow-2xl rounded-2xl p-8 max-w-md w-full text-center"
      >
        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold font-serif text-foreground mb-2">
          🔒 Assistente Pedagógico Premium
        </h2>
        <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
          Utilize inteligência artificial especializada para auxiliar na criação de aulas, atividades, avaliações, intervenções pedagógicas e estratégias de ensino.
        </p>

        <div className="grid grid-cols-1 gap-2 mb-6 text-left">
          {PREMIUM_BENEFITS.map((benefit) => (
            <div key={benefit} className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span className="text-sm text-foreground">{benefit}</span>
            </div>
          ))}
        </div>

        <Button
          asChild
          size="lg"
          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-2"
        >
          <a href={waLink} target="_blank" rel="noopener noreferrer">
            Solicitar Acesso Premium
          </a>
        </Button>

        <p className="text-xs text-muted-foreground mt-3">
          Atendimento via WhatsApp · Acesso imediato após confirmação
        </p>
      </motion.div>
    </div>
  );
}

function RenderMarkdown({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, li) => {
        const parts = line.split(/\*\*([^*]+)\*\*/g);
        return (
          <span key={li}>
            {li > 0 && "\n"}
            {parts.map((part, i) =>
              i % 2 === 1 ? <strong key={i}>{part}</strong> : part
            )}
          </span>
        );
      })}
    </>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border border-border text-foreground rounded-bl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap">
          {isUser ? message.content : <RenderMarkdown text={message.content} />}
        </p>
        <p className={`text-xs mt-1.5 ${isUser ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </motion.div>
  );
}

export default function Assistente() {
  const { user } = useAuth();
  const isPremium = user?.isPremium ?? false;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { mutate: sendMessage, isPending } = useAssistantChat({
    mutation: {
      onSuccess: (data) => {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.message,
          timestamp: new Date(),
        }]);
      },
      onError: () => {
        toast.error("Erro ao enviar mensagem. Tente novamente.");
      },
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isPending || !isPremium) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const planningContext = sessionStorage.getItem("planejapro_result")
      ? `Planejamento atual: ${sessionStorage.getItem("planejapro_result")?.slice(0, 500)}...`
      : undefined;

    sendMessage({ data: { message: text, history, planningContext } });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (suggestion: string) => {
    if (!isPremium) return;
    setInput(suggestion);
    textareaRef.current?.focus();
  };

  const handleClear = () => {
    setMessages([]);
    toast.success("Conversa reiniciada");
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)] relative">
      {!isPremium && <PremiumOverlay />}

      <div className={`flex flex-col h-full ${!isPremium ? "blur-sm pointer-events-none select-none" : ""}`}>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-4"
        >
          <div>
            <h1 className="text-2xl font-bold font-serif text-foreground">Assistente Pedagógico</h1>
            <p className="text-sm text-muted-foreground">Especialista em didática, metodologias e educação inclusiva</p>
          </div>
          {messages.length > 0 && isPremium && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1.5">
              <RotateCcw className="h-4 w-4" />
              Limpar
            </Button>
          )}
        </motion.div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-8"
            >
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="h-7 w-7 text-primary" />
                </div>
                <h2 className="font-semibold text-foreground mb-1">Como posso ajudar?</h2>
                <p className="text-sm text-muted-foreground">
                  Pergunte sobre metodologias, adaptações, atividades, avaliações e muito mais.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground font-medium">Sugestões para começar</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSuggestion(suggestion)}
                      className="text-sm px-3 py-1.5 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition-colors text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map(message => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </AnimatePresence>

          {isPending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Pensando...</span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="pt-4 border-t mt-4">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              placeholder="Digite sua pergunta (Enter para enviar, Shift+Enter para nova linha)..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              className="resize-none flex-1"
              disabled={isPending || !isPremium}
            />
            <Button
              onClick={handleSend}
              disabled={isPending || !input.trim() || !isPremium}
              className="self-end h-10"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            As respostas são sugestões pedagógicas. Sempre adapte ao contexto da sua turma.
          </p>
        </div>
      </div>
    </div>
  );
}
