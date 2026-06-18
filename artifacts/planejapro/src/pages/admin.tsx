import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, Crown, Shield, BarChart3, Search, XCircle, RotateCcw, Ban,
  Unlock, Plus, Minus, ChevronDown, ChevronUp, Clock, FileQuestion,
  Sparkles, ClipboardList, BookMarked, FileText, Wand2, Zap, RefreshCw,
  CheckCircle, AlertTriangle, XOctagon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

interface GenerationsByType {
  [key: string]: number;
}

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  premiumUsers: number;
  freeUsers: number;
  blockedUsers: number;
  totalGenerations: number;
  estimatedTokens: number;
  topUsers: Array<{ userId: number; email: string; name: string | null; generations: number }>;
  generationsByType?: GenerationsByType;
}

interface AdminUser {
  id: number;
  name: string | null;
  email: string;
  isPremium: boolean;
  isActive: boolean;
  freeGenerationsRemaining: number;
  premiumGrantedAt: string | null;
  premiumExpiresAt: string | null;
  createdAt: string;
}

interface AuditLog {
  id: number;
  adminEmail: string;
  action: string;
  targetUserId: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface AIProviderStatus {
  configured: boolean;
  status: string;
}
interface AIStatus {
  providers: {
    gemini: AIProviderStatus;
    groq: AIProviderStatus;
    openrouter: AIProviderStatus;
  };
  hasDb: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  grant_premium: "Premium liberado",
  revoke_premium: "Premium revogado",
  add_days: "Dias adicionados",
  remove_days: "Dias removidos",
  restore_free: "Gerações restauradas",
  block_user: "Usuário bloqueado",
  unblock_user: "Usuário desbloqueado",
};

const TYPE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  exam_generate: { label: "Provas geradas", icon: FileQuestion, color: "text-blue-600" },
  planning_generate: { label: "Planejamentos gerados", icon: Sparkles, color: "text-purple-600" },
  activities_generate: { label: "Atividades geradas", icon: ClipboardList, color: "text-green-600" },
  sequence_generate: { label: "Sequências didáticas", icon: BookMarked, color: "text-indigo-600" },
  report_generate: { label: "Relatórios gerados", icon: FileText, color: "text-orange-600" },
  adapt_generate: { label: "Adaptações de conteúdo", icon: Wand2, color: "text-pink-600" },
  planning_improve: { label: "Sugestões de melhoria", icon: Sparkles, color: "text-amber-600" },
};

export default function Admin() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [loadingAction, setLoadingAction] = useState<number | null>(null);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [daysInput, setDaysInput] = useState<Record<number, string>>({});
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const apiFetch = async (path: string, options?: RequestInit) => {
    const res = await fetch(path, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options?.headers },
    });
    if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e?.error || "Erro"); }
    return res.json();
  };

  const loadStats = async () => {
    try { setStats(await apiFetch("/api/admin/dashboard") as DashboardStats); } catch { toast.error("Erro ao carregar estatísticas"); }
  };

  const loadUsers = async (q?: string) => {
    try {
      const url = q ? `/api/admin/users?search=${encodeURIComponent(q)}` : "/api/admin/users";
      setUsers(await apiFetch(url) as AdminUser[]);
    } catch { toast.error("Erro ao carregar usuários"); }
  };

  const loadLogs = async () => {
    try { setLogs(await apiFetch("/api/admin/audit-logs") as AuditLog[]); } catch {}
  };

  useEffect(() => { if (token) { loadStats(); loadUsers(); loadLogs(); loadAiStatus(); } }, [token]);

  useEffect(() => {
    const t = setTimeout(() => { if (token) loadUsers(search); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadAiStatus = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/healthz/gemini', { headers: { Authorization: `Bearer ${token}` } });
      setAiStatus(await res.json() as AIStatus);
    } catch { toast.error('Erro ao verificar status das IAs'); }
    finally { setAiLoading(false); }
  };

  const doAction = async (userId: number, action: string, extra?: Record<string, unknown>) => {
    setLoadingAction(userId);
    try {
      const res = await apiFetch("/api/admin/user-action", {
        method: "POST",
        body: JSON.stringify({ action, userId, ...extra }),
      }) as { message?: string };
      toast.success(res.message || "Ação realizada");
      await Promise.all([loadUsers(search), loadStats(), loadLogs()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoadingAction(null);
    }
  };

  if (!user?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Acesso negado.</p>
      </div>
    );
  }

  const totalByType = stats?.generationsByType
    ? Object.values(stats.generationsByType).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> Painel Administrativo
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Gerenciamento de usuários e métricas da plataforma</p>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="ia" className="gap-1"><Zap className="h-3.5 w-3.5" />IA</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          {stats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Total de usuários", value: stats.totalUsers, icon: Users, color: "text-blue-600" },
                  { label: "Premium", value: stats.premiumUsers, icon: Crown, color: "text-amber-600" },
                  { label: "Gratuitos ativos", value: stats.freeUsers, icon: BarChart3, color: "text-green-600" },
                  { label: "Bloqueados", value: stats.blockedUsers, icon: Ban, color: "text-red-600" },
                ].map((s) => (
                  <Card key={s.label}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <s.icon className={`h-4 w-4 ${s.color}`} />
                        <span className="text-xs text-muted-foreground">{s.label}</span>
                      </div>
                      <span className="text-2xl font-bold">{s.value}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader><CardTitle className="text-base">Uso da IA por funcionalidade</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b">
                      <span className="text-sm font-medium text-muted-foreground">Total de gerações</span>
                      <span className="font-bold text-lg">{stats.totalGenerations}</span>
                    </div>
                    {Object.entries(TYPE_LABELS).map(([key, info]) => {
                      const count = stats.generationsByType?.[key] ?? 0;
                      const pct = totalByType > 0 ? Math.round((count / totalByType) * 100) : 0;
                      const Icon = info.icon;
                      return (
                        <div key={key}>
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-1.5">
                              <Icon className={`h-3.5 w-3.5 ${info.color}`} />
                              <span className="text-sm text-muted-foreground">{info.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{pct}%</span>
                              <span className="font-semibold text-sm">{count}</span>
                            </div>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Custo estimado</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Tokens estimados</span>
                        <span className="font-semibold">{stats.estimatedTokens.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Custo estimado (~$0.003/1k)</span>
                        <span className="font-semibold text-green-600">
                          ${((stats.estimatedTokens / 1000) * 0.003).toFixed(4)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-base">Mais ativos</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {stats.topUsers.length === 0 && <p className="text-sm text-muted-foreground">Nenhum uso ainda</p>}
                      {stats.topUsers.map((u, i) => (
                        <div key={u.userId} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                            <span className="text-sm truncate max-w-[160px]">{u.name || u.email}</span>
                          </div>
                          <Badge variant="secondary">{u.generations} gerações</Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome ou email..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            {users.map((u) => {
              const isExpanded = expandedUser === u.id;
              const isLoading = loadingAction === u.id;
              return (
                <Card key={u.id} className={!u.isActive ? "opacity-60 border-destructive/30" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{u.name || u.email}</span>
                          {u.isPremium && <Badge className="bg-amber-100 text-amber-800 text-xs">Premium</Badge>}
                          {!u.isActive && <Badge variant="destructive" className="text-xs">Bloqueado</Badge>}
                          {!u.isPremium && u.isActive && (
                            <Badge variant="secondary" className="text-xs">{u.freeGenerationsRemaining} gratuitas</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Cadastro: {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setExpandedUser(isExpanded ? null : u.id)}>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>

                    {isExpanded && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 pt-4 border-t grid grid-cols-2 gap-2">
                        {!u.isPremium ? (
                          <Button size="sm" variant="outline" className="gap-1.5 text-amber-700 border-amber-300" disabled={isLoading} onClick={() => doAction(u.id, "grant_premium")}>
                            <Crown className="h-3.5 w-3.5" /> Liberar premium
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="gap-1.5 text-muted-foreground" disabled={isLoading} onClick={() => doAction(u.id, "revoke_premium")}>
                            <XCircle className="h-3.5 w-3.5" /> Revogar premium
                          </Button>
                        )}

                        <Button size="sm" variant="outline" className="gap-1.5 text-blue-700 border-blue-300" disabled={isLoading} onClick={() => doAction(u.id, "restore_free")}>
                          <RotateCcw className="h-3.5 w-3.5" /> Restaurar testes
                        </Button>

                        {u.isActive ? (
                          <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30" disabled={isLoading} onClick={() => doAction(u.id, "block")}>
                            <Ban className="h-3.5 w-3.5" /> Bloquear
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="gap-1.5 text-green-700 border-green-300" disabled={isLoading} onClick={() => doAction(u.id, "unblock")}>
                            <Unlock className="h-3.5 w-3.5" /> Desbloquear
                          </Button>
                        )}

                        <div className="col-span-2 flex gap-2 items-center">
                          <Input
                            type="number"
                            placeholder="Dias"
                            className="h-8 w-20 text-sm"
                            value={daysInput[u.id] || ""}
                            onChange={(e) => setDaysInput((p) => ({ ...p, [u.id]: e.target.value }))}
                          />
                          <Button size="sm" variant="outline" className="gap-1 h-8" disabled={isLoading || !daysInput[u.id]} onClick={() => doAction(u.id, "add_days", { days: daysInput[u.id] })}>
                            <Plus className="h-3.5 w-3.5" /> Dias
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1 h-8" disabled={isLoading || !daysInput[u.id]} onClick={() => doAction(u.id, "remove_days", { days: daysInput[u.id] })}>
                            <Minus className="h-3.5 w-3.5" /> Dias
                          </Button>
                        </div>

                        {u.premiumExpiresAt && (
                          <p className="col-span-2 text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expira: {new Date(u.premiumExpiresAt).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            {users.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhum usuário encontrado</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-4 space-y-2">
          {logs.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">Nenhum log ainda</p>}
          {logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{ACTION_LABELS[log.action] || log.action}</Badge>
                    {log.metadata && (
                      <span className="text-xs text-muted-foreground">
                        {JSON.stringify(log.metadata)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Por: {log.adminEmail} · Usuário ID: {log.targetUserId}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                  {new Date(log.createdAt).toLocaleString("pt-BR")}
                </span>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="ia" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground">Status dos Provedores de IA</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Rodízio automático: Gemini → Groq → NVIDIA/DeepSeek → Mistral → OpenRouter. Quando um esgota, o próximo é ativado.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={loadAiStatus} disabled={aiLoading} className="gap-1.5">
              <RefreshCw className={"h-3.5 w-3.5" + (aiLoading ? " animate-spin" : "")} />
              Atualizar
            </Button>
          </div>

          {!aiStatus && !aiLoading && (
            <p className="text-center text-muted-foreground py-8 text-sm">Clique em Atualizar para verificar</p>
          )}

          {aiLoading && (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <Card key={i}><CardContent className="p-4"><div className="h-16 bg-muted animate-pulse rounded" /></CardContent></Card>
              ))}
            </div>
          )}

          {aiStatus && !aiLoading && (
            <div className="space-y-3">
              {(Object.entries(aiStatus.providers) as Array<[string, AIProviderStatus]>).map(([name, info]) => {
                const isOk = info.status.startsWith('✅');
                const isWarn = info.status.startsWith('⚠️');
                const isErr = info.status.startsWith('❌') || info.status === 'not tested';
                const notConfigured = !info.configured;

                const NAMES: Record<string, { label: string; desc: string; reset: string; link: string }> = {
                  gemini:     { label: 'Google Gemini',    desc: 'gemini-2.5-flash · free tier · 20 req/min',               reset: '🔄 Renova a cada 1 minuto',                           link: 'https://aistudio.google.com/apikey' },
                  groq:       { label: 'Groq',             desc: 'llama-3.3-70b · free tier · 14.400 req/dia',              reset: '🔄 Renova todo dia à meia-noite (UTC)',               link: 'https://console.groq.com' },
                  nvidia:     { label: 'NVIDIA / DeepSeek',desc: 'deepseek-r1 · créditos grátis iniciais',                  reset: '🔄 Créditos mensais (ver painel NVIDIA)',              link: 'https://build.nvidia.com' },
                  mistral:    { label: 'Mistral AI',       desc: 'mistral-small-latest · free tier',                        reset: '🔄 Rate limit por minuto (free tier)',                 link: 'https://console.mistral.ai' },
                  openrouter: { label: 'OpenRouter',       desc: 'modelos :free · sem limite diário fixo',                  reset: '🔄 Rate limit por modelo · geralmente por minuto',    link: 'https://openrouter.ai' },
                };
                const meta = NAMES[name] ?? { label: name, desc: '', link: '' };

                // Parse retry-in seconds from status when quota exceeded
                const retryMatch = info.status.match(/retry in ([\d.]+)s/i);
                const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
                const formatRetry = (s: number) => s < 60 ? `${s}s` : `${Math.ceil(s/60)}min`;

                return (
                  <Card key={name} className={isOk ? 'border-green-200 dark:border-green-900' : isWarn ? 'border-amber-200 dark:border-amber-900' : notConfigured ? 'border-dashed opacity-70' : 'border-red-200 dark:border-red-900'}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={"mt-0.5 flex-shrink-0 " + (isOk ? 'text-green-600' : isWarn ? 'text-amber-500' : 'text-muted-foreground')}>
                          {isOk ? <CheckCircle className="h-5 w-5" /> : isWarn ? <AlertTriangle className="h-5 w-5" /> : <XOctagon className="h-5 w-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm">{meta.label}</span>
                            {info.configured
                              ? <Badge variant="outline" className="text-xs border-green-300 text-green-700">Configurado</Badge>
                              : <Badge variant="outline" className="text-xs border-dashed text-muted-foreground">Sem chave</Badge>
                            }
                            {isOk && <Badge className="text-xs bg-green-100 text-green-800">Online</Badge>}
                            {isWarn && <Badge className="text-xs bg-amber-100 text-amber-800">Cota esgotada</Badge>}
                            {isWarn && retrySeconds && (
                              <Badge className="text-xs bg-orange-100 text-orange-800 gap-1">
                                <Clock className="h-3 w-3" /> Renova em {formatRetry(retrySeconds)}
                              </Badge>
                            )}
                            {isErr && info.configured && <Badge variant="destructive" className="text-xs">Erro</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{meta.desc}</p>
                          <p className="text-xs text-muted-foreground">{meta.reset}</p>
                          {info.configured && (
                            <p className="text-xs mt-1.5 font-mono bg-muted rounded px-2 py-1 break-all">{info.status.slice(0, 120)}</p>
                          )}
                          {!info.configured && (
                            <a href={meta.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mt-1 inline-block">
                              Obter chave grátis →
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              <Card className="bg-muted/30">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">
                    🗄️ Banco de dados: {aiStatus.hasDb ? <span className="text-green-600 font-medium">Conectado</span> : <span className="text-red-600 font-medium">Não configurado</span>}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
