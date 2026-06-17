import { Link, useLocation } from "wouter";
import {
  BookOpen,
  PlusCircle,
  FolderOpen,
  MessageSquare,
  Upload,
  Settings,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

const NAV_ITEMS = [
  { href: "/", label: "Início", icon: BookOpen },
  { href: "/novo", label: "Novo Planejamento", icon: PlusCircle },
  { href: "/salvos", label: "Meus Planejamentos", icon: FolderOpen },
  { href: "/assistente", label: "Assistente Pedagógico", icon: MessageSquare },
  { href: "/importar", label: "Importar Documento", icon: Upload },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Você saiu da conta.");
    } catch {
      toast.error("Erro ao sair. Tente novamente.");
    }
  };

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Professor";
  const initials = displayName.slice(0, 2).toUpperCase();

  const NavLinks = () => (
    <div className="flex flex-col flex-1">
      <div className="space-y-1 py-4 flex-1">
        {NAV_ITEMS.map((item) => {
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
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="py-4 space-y-1 border-t">
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
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-card px-4 py-6">
        <div className="flex items-center gap-2 px-2 mb-6">
          <BookOpen className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold font-serif text-foreground">PlanejaPro</span>
        </div>
        <NavLinks />
      </aside>

      {/* Mobile Header & Content */}
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
