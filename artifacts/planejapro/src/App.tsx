import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { Layout } from "@/components/layout";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { Skeleton } from "@/components/ui/skeleton";

import Home from "@/pages/home";
import NovoPlanejamento from "@/pages/novo-planejamento";
import Resultado from "@/pages/resultado";
import Salvos from "@/pages/salvos";
import Assistente from "@/pages/assistente";
import Importar from "@/pages/importar";
import Configuracoes from "@/pages/configuracoes";
import Login from "@/pages/login";
import Cadastro from "@/pages/cadastro";
import Upgrade from "@/pages/upgrade";
import Admin from "@/pages/admin";
import CriarProva from "@/pages/criar-prova";
import ProvaResultado from "@/pages/prova-resultado";
import Atividades from "@/pages/atividades";
import Adaptar from "@/pages/adaptar";
import BancoQuestoes from "@/pages/banco-questoes";
import SequenciaDidatica from "@/pages/sequencia-didatica";
import Relatorios from "@/pages/relatorios";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
    mutations: { retry: 0 },
  },
});

function LoadingScreen() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background">
      <div className="space-y-3 w-48">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/cadastro" component={Cadastro} />
        <Route>
          <Redirect to="/login" />
        </Route>
      </Switch>
    );
  }

  const isBlocked = !user.isPremium && user.freeGenerationsRemaining <= 0;

  if (isBlocked) {
    return (
      <Switch>
        <Route path="/upgrade" component={Upgrade} />
        <Route path="/login">
          <Redirect to="/upgrade" />
        </Route>
        <Route>
          <Redirect to="/upgrade" />
        </Route>
      </Switch>
    );
  }

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/novo" component={NovoPlanejamento} />
          <Route path="/resultado" component={Resultado} />
          <Route path="/salvos" component={Salvos} />
          <Route path="/assistente" component={Assistente} />
          <Route path="/importar" component={Importar} />
          <Route path="/configuracoes" component={Configuracoes} />
          <Route path="/criar-prova" component={CriarProva} />
          <Route path="/prova-resultado" component={ProvaResultado} />
          <Route path="/atividades" component={Atividades} />
          <Route path="/adaptar" component={Adaptar} />
          <Route path="/banco-questoes" component={BancoQuestoes} />
          <Route path="/sequencia-didatica" component={SequenciaDidatica} />
          <Route path="/relatorios" component={Relatorios} />
          {user.isAdmin && <Route path="/admin" component={Admin} />}
          <Route path="/login">
            <Redirect to="/" />
          </Route>
          <Route path="/cadastro">
            <Redirect to="/" />
          </Route>
          <Route path="/upgrade">
            <Redirect to="/" />
          </Route>
          <Route component={NotFound} />
        </Switch>
      </AnimatePresence>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="planejapro-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRoutes />
            </WouterRouter>
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
