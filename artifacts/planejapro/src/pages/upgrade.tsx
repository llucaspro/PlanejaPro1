import { motion } from "framer-motion";
import { BookOpen, Check, MessageCircle, Mail, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

const WHATSAPP_NUMBER = "5514997966714";
const WHATSAPP_MSG = encodeURIComponent("Olá! Quero liberar meu acesso completo ao PlanejaPro.");
const CONTACT_EMAIL = "contato@planejapro.com.br";

const benefits = [
  "Planejamentos ilimitados",
  "Assistente pedagógico sem restrições",
  "Importação de documentos",
  "Exportação profissional",
  "Suporte prioritário",
];

export default function Upgrade() {
  const { logout, user } = useAuth();

  const handleLogout = async () => {
    try { await logout(); } catch { toast.error("Erro ao sair."); }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <BookOpen className="h-7 w-7 text-primary" />
          <span className="text-2xl font-bold font-serif text-foreground">PlanejaPro</span>
        </div>

        <Card className="border-primary/20 shadow-xl">
          <CardContent className="p-8 text-center space-y-6">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto"
            >
              <BookOpen className="h-8 w-8 text-primary" />
            </motion.div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Seu período gratuito terminou
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Você utilizou seus 3 planejamentos gratuitos. Entre em contato para liberar acesso completo ao PlanejaPro.
              </p>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 text-left space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                O que você terá acesso:
              </p>
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-sm text-foreground">{benefit}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <Button
                className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
                size="lg"
                onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`, "_blank")}
              >
                <MessageCircle className="h-5 w-5" />
                Falar no WhatsApp
              </Button>

              <Button
                variant="outline"
                className="w-full gap-2"
                size="lg"
                onClick={() => window.open(`mailto:${CONTACT_EMAIL}?subject=Acesso PlanejaPro&body=Olá, quero liberar meu acesso completo.`, "_blank")}
              >
                <Mail className="h-5 w-5" />
                Entrar em contato
              </Button>
            </div>

            {user && (
              <p className="text-xs text-muted-foreground">
                Conta: {user.email}
              </p>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair da conta
            </button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
