import { Link, useLocation } from "wouter";
import {
  BookOpen, PlusCircle, FolderOpen, MessageSquare,
  Upload, Settings, Menu, X, LogOut, Shield, Sparkles,
  FileQuestion, ClipboardList, Wand2, Database,
  BookMarked, FileText, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { Badge } from "./ui/badge";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

const NAV_MAIN = [
  { href: "/", label: "Início", icon: BookOpen },
  { href: "/novo", label: "Novo Planejamento", icon: PlusCircle },
  { href: "/salvos", label: "Meus Planejamentos", icon: FolderOpen },
  { href: "/criar-prova", label: "Criar Prova", icon: FileQuestion },
  { href: "/assistente", label: "Assistente Pedagógico", icon: MessageSquare, premium: true },
];

const NAV_FERRAMENTAS = [
  { href: "/atividades", label: "Gerador de Atividades", icon: ClipboardList },
  { href: "/sequencia-didatica", label: "Sequência Didática", icon: BookMarked },
  { href: "/adaptar", label: "Adaptação de Conteúdo", icon: Wand2 },
  { href: "/relatorios", label: "Relatórios Pedagógicos", icon: FileText },
  { href: "/banco-questoes", label: "Banco de Questões", icon: Database },
  { href: "/importar", label: "Importar Documento", icon: Upload },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [ferramentasOpen, setFerramentasOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Você saiu da conta.");
    } catch {
      toast.error("Erro ao sair. Tente novamente.");
    }
  };

  const displayName = user?.name || user?.email?.split("@")[0] || "Professor";
  const initials = displayName.slice(0, 2).toUpperCase();

  const isFerramentaActive = NAV_FERRAMENTAS.some(item =>
    location === item.href || (item.href !== "/" && location.startsWith(item.href))
  );

  const NavLinks = () => (
    <div className="flex flex-col flex-1">
      <div className="space-y-1 py-4 flex-1">
        {NAV_MAIN.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.premium && (
                  <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">
                    PRO
                  </span>
                )}
              </div>
            </Link>
          );
        })}

        <div>
          <button
            onClick={() => setFerramentasOpen(!ferramentasOpen)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
              isFerramentaActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Sparkles className="h-5 w-5 flex-shrink-0" />
            <span className="flex-1 text-left">Ferramentas IA</span>
            {ferramentasOpen
              ? <ChevronUp className="h-4 w-4" />
              : <ChevronDown className="h-4 w-4" />}
          </button>

          {(ferramentasOpen || isFerramentaActive) && (
            <div className="mt-1 ml-3 pl-3 border-l-2 border-border space-y-0.5">
              {NAV_FERRAMENTAS.map((item) => {
                const isActive = location === item.href;
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors cursor-pointer text-sm ${
                        isActive
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {user?.isAdmin && (
          <Link href="/admin">
            <div
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
                location === "/admin"
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Shield className="h-5 w-5" />
              <span>Admin</span>
            </div>
          </Link>
        )}
      </div>

      <div className="py-4 space-y-1 border-t">
        {user && !user.isPremium && (
          <div className="px-3 py-2 mb-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Gerações gratuitas</span>
              <Badge variant={user.freeGenerationsRemaining > 0 ? "secondary" : "destructive"} className="text-xs">
                {user.freeGenerationsRemaining}/3
              </Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${(user.freeGenerationsRemaining / 3) * 100}%` }}
              />
            </div>
          </div>
        )}

        {user?.isPremium && (
          <div className="px-3 py-1.5 mb-1">
            <Badge className="bg-amber-100 text-amber-800 text-xs gap-1">
              <Sparkles className="h-3 w-3" /> Premium ativo
            </Badge>
          </div>
        )}

        <Link href="/configuracoes">
          <div
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors cursor-pointer ${
              location === "/configuracoes"
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Settings className="h-5 w-5" />
            <span>Configurações</span>
          </div>
        </Link>

        <div className="flex items-center gap-3 px-3 py-2 rounded-md">
          <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <span className="text-sm text-foreground truncate flex-1">{displayName}</span>
          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh] w-full bg-background">
      <aside className="hidden md:flex flex-col w-64 border-r bg-card px-4 py-6">
        <div className="flex items-center gap-2 px-2 mb-6">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold font-serif text-foreground">PlanejaPro</span>
        </div>
        <NavLinks />
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between border-b bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold font-serif">PlanejaPro</span>
          </div>
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xl font-bold font-serif">Menu</span>
                <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <NavLinks />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
