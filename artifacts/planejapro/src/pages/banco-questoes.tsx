import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Database, Search, Trash2, Star, StarOff, Copy, Filter,
  FileQuestion, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";

const STORAGE_KEY = "planejapro_banco_questoes";

export interface BancoQuestao {
  id: string;
  enunciado: string;
  tipo: "alternativa" | "discursiva";
  alternativas?: { a: string; b: string; c: string; d: string; e: string };
  gabarito?: string;
  criterios?: string;
  disciplina: string;
  anoSerie: string;
  dificuldade: "facil" | "medio" | "dificil";
  tema: string;
  favorita: boolean;
  criadoEm: string;
}

const DIFICULDADE_LABELS: Record<string, string> = {
  facil: "🟢 Fácil",
  medio: "🟡 Médio",
  dificil: "🔴 Difícil",
};

function getQuestoes(): BancoQuestao[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as BancoQuestao[];
  } catch {
    return [];
  }
}

function saveQuestoes(questoes: BancoQuestao[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(questoes));
}

export function salvarQuestaoNoBanco(q: Omit<BancoQuestao, "id" | "favorita" | "criadoEm">) {
  const questoes = getQuestoes();
  const nova: BancoQuestao = {
    ...q,
    id: crypto.randomUUID(),
    favorita: false,
    criadoEm: new Date().toISOString(),
  };
  saveQuestoes([nova, ...questoes]);
  return nova;
}

export default function BancoQuestoes() {
  const [, navigate] = useLocation();
  const [questoes, setQuestoes] = useState<BancoQuestao[]>([]);
  const [search, setSearch] = useState("");
  const [filtroDisc, setFiltroDisc] = useState("todas");
  const [filtroSerie, setFiltroSerie] = useState("todas");
  const [filtroDif, setFiltroDif] = useState("todas");
  const [expandida, setExpandida] = useState<string | null>(null);

  useEffect(() => {
    setQuestoes(getQuestoes());
  }, []);

  const handleToggleFavorita = (id: string) => {
    const atualizadas = questoes.map(q =>
      q.id === id ? { ...q, favorita: !q.favorita } : q
    );
    setQuestoes(atualizadas);
    saveQuestoes(atualizadas);
  };

  const handleExcluir = (id: string) => {
    const atualizadas = questoes.filter(q => q.id !== id);
    setQuestoes(atualizadas);
    saveQuestoes(atualizadas);
    toast.success("Questão excluída");
  };

  const handleCopiar = (q: BancoQuestao) => {
    const texto = q.tipo === "alternativa"
      ? `${q.enunciado}\n\na) ${q.alternativas?.a}\nb) ${q.alternativas?.b}\nc) ${q.alternativas?.c}\nd) ${q.alternativas?.d}\ne) ${q.alternativas?.e}\n\nGabarito: ${q.gabarito?.toUpperCase()}`
      : `${q.enunciado}\n\nCritérios: ${q.criterios || ""}`;
    navigator.clipboard.writeText(texto);
    toast.success("Questão copiada!");
  };

  const disciplinas = [...new Set(questoes.map(q => q.disciplina))];
  const series = [...new Set(questoes.map(q => q.anoSerie))];

  const filtradas = questoes.filter(q => {
    const matchSearch = !search ||
      q.enunciado.toLowerCase().includes(search.toLowerCase()) ||
      q.tema.toLowerCase().includes(search.toLowerCase()) ||
      q.disciplina.toLowerCase().includes(search.toLowerCase());
    const matchDisc = filtroDisc === "todas" || q.disciplina === filtroDisc;
    const matchSerie = filtroSerie === "todas" || q.anoSerie === filtroSerie;
    const matchDif = filtroDif === "todas" || q.dificuldade === filtroDif;
    return matchSearch && matchDisc && matchSerie && matchDif;
  });

  const favoritas = filtradas.filter(q => q.favorita);
  const outras = filtradas.filter(q => !q.favorita);
  const ordenadas = [...favoritas, ...outras];

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Button variant="ghost" size="sm" className="mb-4 gap-1 -ml-2" onClick={() => navigate(-1 as never)}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold font-serif text-foreground">Banco de Questões</h1>
          </div>
          <p className="text-muted-foreground">
            Questões salvas das suas provas. Filtre, favorite e reutilize quando quiser.
          </p>
        </div>

        {questoes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Database className="h-8 w-8 text-primary/50" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Banco vazio</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
              Suas questões salvas aparecerão aqui. Gere uma prova e salve questões individuais para reutilizá-las.
            </p>
            <Button onClick={() => navigate("/criar-prova")} className="gap-2">
              <FileQuestion className="h-4 w-4" /> Criar prova
            </Button>
          </motion.div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar questões..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filtroDisc} onValueChange={setFiltroDisc}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="Disciplina" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas disciplinas</SelectItem>
                    {disciplinas.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filtroSerie} onValueChange={setFiltroSerie}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Série" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas séries</SelectItem>
                    {series.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filtroDif} onValueChange={setFiltroDif}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Dificuldade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas dificuldades</SelectItem>
                    <SelectItem value="facil">🟢 Fácil</SelectItem>
                    <SelectItem value="medio">🟡 Médio</SelectItem>
                    <SelectItem value="dificil">🔴 Difícil</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground ml-auto">
                  {filtradas.length} de {questoes.length} questões
                </span>
              </div>
            </div>

            <AnimatePresence>
              <div className="space-y-2">
                {ordenadas.map((q) => (
                  <motion.div
                    key={q.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Card className={q.favorita ? "border-amber-300 dark:border-amber-700" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              <Badge variant="outline" className="text-xs">{q.disciplina}</Badge>
                              <Badge variant="outline" className="text-xs">{q.anoSerie}</Badge>
                              <Badge variant="secondary" className="text-xs">
                                {DIFICULDADE_LABELS[q.dificuldade]}
                              </Badge>
                              <Badge variant={q.tipo === "alternativa" ? "default" : "secondary"} className="text-xs">
                                {q.tipo === "alternativa" ? "Múltipla escolha" : "Discursiva"}
                              </Badge>
                              {q.favorita && <Badge className="text-xs bg-amber-100 text-amber-800">⭐ Favorita</Badge>}
                            </div>

                            <p
                              className={`text-sm text-foreground cursor-pointer leading-relaxed ${expandida === q.id ? "" : "line-clamp-2"}`}
                              onClick={() => setExpandida(expandida === q.id ? null : q.id)}
                            >
                              {q.enunciado}
                            </p>

                            {expandida === q.id && q.tipo === "alternativa" && q.alternativas && (
                              <div className="mt-3 space-y-1 pl-2 border-l-2 border-primary/30">
                                {Object.entries(q.alternativas).map(([letra, texto]) => (
                                  <p key={letra} className={`text-xs ${letra === q.gabarito ? "text-green-600 font-semibold" : "text-muted-foreground"}`}>
                                    {letra.toUpperCase()}) {texto} {letra === q.gabarito && "✓"}
                                  </p>
                                ))}
                              </div>
                            )}

                            {expandida === q.id && q.tipo === "discursiva" && q.criterios && (
                              <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                                <strong>Critérios:</strong> {q.criterios}
                              </div>
                            )}

                            <p className="text-xs text-muted-foreground mt-2">
                              {q.tema} · {new Date(q.criadoEm).toLocaleDateString("pt-BR")}
                            </p>
                          </div>

                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => handleToggleFavorita(q.id)}
                              title={q.favorita ? "Remover favorito" : "Favoritar"}
                            >
                              {q.favorita
                                ? <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                : <StarOff className="h-4 w-4 text-muted-foreground" />}
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => handleCopiar(q)}
                              title="Copiar questão"
                            >
                              <Copy className="h-4 w-4 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleExcluir(q.id)}
                              title="Excluir questão"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}

                {filtradas.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Nenhuma questão encontrada com os filtros selecionados.
                  </div>
                )}
              </div>
            </AnimatePresence>
          </>
        )}
      </motion.div>
    </div>
  );
}
