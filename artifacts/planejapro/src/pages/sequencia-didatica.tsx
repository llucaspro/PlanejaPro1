import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2, BookMarked, ArrowLeft, ChevronRight, Download,
  Copy, CheckCircle, Target, BookOpen, Users, CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import jsPDF from "jspdf";

const ANOS = [
  "1º Ano EF", "2º Ano EF", "3º Ano EF", "4º Ano EF", "5º Ano EF",
  "6º Ano EF", "7º Ano EF", "8º Ano EF", "9º Ano EF",
  "1º Ano EM", "2º Ano EM", "3º Ano EM",
];

const schema = z.object({
  disciplina: z.string().min(2, "Informe a disciplina"),
  anoSerie: z.string().min(1, "Selecione o ano/série"),
  tema: z.string().min(3, "Descreva o tema"),
  numAulas: z.coerce.number().min(1).max(12).default(4),
  duracaoAula: z.coerce.number().min(30).max(240).default(50),
  objetivos: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Aula {
  numero: number;
  titulo: string;
  objetivo: string;
  conteudos: string[];
  metodologia: string;
  desenvolvimento: string;
  atividadeInicial: string;
  atividadePrincipal: string;
  encerramento: string;
  avaliacao: string;
  recursos: string[];
  tarefaCasa?: string;
}

interface Result {
  titulo: string;
  objetivoGeral: string;
  competencias: string[];
  habilidades: string[];
  recursosGerais: string[];
  aulas: Aula[];
  avaliacaoFinal: string;
  observacoesPedagogicas: string;
}

export default function SequenciaDidatica() {
  const [, navigate] = useLocation();
  const { token } = useAuth();
  const [result, setResult] = useState<Result | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [aulaAberta, setAulaAberta] = useState<number>(0);
  const [copied, setCopied] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { numAulas: 4, duracaoAula: 50 },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/sequences/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      const json = await res.json() as Result & { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao gerar sequência");
      setResult(json);
      setAulaAberta(0);
      toast.success("Sequência didática gerada com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar sequência");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text = result.aulas.map(a =>
      `AULA ${a.numero}: ${a.titulo}\nObjetivo: ${a.objetivo}\nDesenvolvimento: ${a.desenvolvimento}\nAvaliação: ${a.avaliacao}`
    ).join("\n\n---\n\n");
    navigator.clipboard.writeText(`${result.titulo}\n\n${text}`);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxW = pageW - margin * 2;
    let y = 20;

    const addText = (text: string, size = 11, bold = false) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, maxW);
      if (y + lines.length * (size * 0.4) > 280) { doc.addPage(); y = 20; }
      doc.text(lines, margin, y);
      y += lines.length * (size * 0.4) + 3;
    };

    addText(result.titulo, 16, true);
    y += 2;
    addText(`Objetivo Geral: ${result.objetivoGeral}`, 10);
    y += 4;

    result.aulas.forEach((a) => {
      if (y > 240) { doc.addPage(); y = 20; }
      addText(`Aula ${a.numero}: ${a.titulo}`, 13, true);
      addText(`Objetivo: ${a.objetivo}`, 10);
      addText(`Desenvolvimento: ${a.desenvolvimento}`, 10);
      if (a.avaliacao) addText(`Avaliação: ${a.avaliacao}`, 10);
      y += 4;
    });

    doc.save(`sequencia-didatica-${Date.now()}.pdf`);
    toast.success("PDF baixado!");
  };

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Button variant="ghost" size="sm" className="mb-4 gap-1 -ml-2" onClick={() => navigate(-1 as never)}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <BookMarked className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold font-serif text-foreground">Sequência Didática</h1>
          </div>
          <p className="text-muted-foreground">
            Gere uma sequência didática completa organizada por aulas, com objetivos, metodologias e avaliação.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Dados da sequência</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Disciplina *</Label>
                  <Input placeholder="Ex: Ciências, História..." {...register("disciplina")} />
                  {errors.disciplina && <p className="text-xs text-destructive">{errors.disciplina.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Ano/Série *</Label>
                  <Select onValueChange={(v) => setValue("anoSerie", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {ANOS.map((ano) => <SelectItem key={ano} value={ano}>{ano}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {errors.anoSerie && <p className="text-xs text-destructive">{errors.anoSerie.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Tema / Conteúdo *</Label>
                <Textarea placeholder="Ex: Sistema Solar, Revolução Industrial, Equações do 1º grau..." rows={2} {...register("tema")} />
                {errors.tema && <p className="text-xs text-destructive">{errors.tema.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Número de aulas</Label>
                  <Input type="number" min={1} max={12} {...register("numAulas")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Duração (min)</Label>
                  <Input type="number" min={30} max={240} {...register("duracaoAula")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Objetivos (opcional)</Label>
                <Textarea placeholder="O que você quer que os alunos aprendam ao final da sequência?" rows={2} {...register("objetivos")} />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full gap-2" disabled={isLoading}>
            {isLoading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Gerando sequência...</>
            ) : (
              <><BookMarked className="h-5 w-5" /> Gerar sequência didática <ChevronRight className="h-4 w-4" /></>
            )}
          </Button>
        </form>

        <AnimatePresence>
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-8 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}><CardContent className="p-5 space-y-2">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent></Card>
              ))}
            </motion.div>
          )}

          {result && !isLoading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold font-serif">{result.titulo}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{result.objetivoGeral}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                    {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    Copiar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePDF} className="gap-1.5">
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                </div>
              </div>

              {(result.competencias?.length > 0 || result.habilidades?.length > 0) && (
                <Card>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {result.competencias?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                            <Target className="h-3 w-3" /> Competências
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {result.competencias.map((c, i) => <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>)}
                          </div>
                        </div>
                      )}
                      {result.habilidades?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                            <CheckSquare className="h-3 w-3" /> Habilidades
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {result.habilidades.map((h, i) => <Badge key={i} variant="outline" className="text-xs">{h}</Badge>)}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                {result.aulas.map((aula, i) => (
                  <Card key={i} className={aulaAberta === i ? "border-primary/50" : ""}>
                    <button
                      className="w-full p-4 text-left flex items-center justify-between hover:bg-muted/50 transition-colors rounded-lg"
                      onClick={() => setAulaAberta(aulaAberta === i ? -1 : i)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {aula.numero}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{aula.titulo}</p>
                          <p className="text-xs text-muted-foreground">{aula.objetivo}</p>
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${aulaAberta === i ? "rotate-90" : ""}`} />
                    </button>

                    {aulaAberta === i && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="px-4 pb-4 space-y-4"
                      >
                        {aula.atividadeInicial && (
                          <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
                            <p className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1 flex items-center gap-1">
                              <BookOpen className="h-3 w-3" /> Abertura
                            </p>
                            <p className="text-sm text-foreground">{aula.atividadeInicial}</p>
                          </div>
                        )}

                        {aula.desenvolvimento && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1">
                              <Users className="h-3 w-3" /> Desenvolvimento
                            </p>
                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{aula.desenvolvimento}</p>
                          </div>
                        )}

                        {aula.encerramento && (
                          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
                            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Encerramento</p>
                            <p className="text-sm text-foreground">{aula.encerramento}</p>
                          </div>
                        )}

                        {aula.avaliacao && (
                          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3">
                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1 flex items-center gap-1">
                              <CheckSquare className="h-3 w-3" /> Avaliação
                            </p>
                            <p className="text-sm text-foreground">{aula.avaliacao}</p>
                          </div>
                        )}

                        {aula.recursos?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {aula.recursos.map((r, j) => (
                              <Badge key={j} variant="outline" className="text-xs">{r}</Badge>
                            ))}
                          </div>
                        )}

                        {aula.tarefaCasa && (
                          <p className="text-xs text-muted-foreground">🏠 Tarefa: {aula.tarefaCasa}</p>
                        )}
                      </motion.div>
                    )}
                  </Card>
                ))}
              </div>

              {result.avaliacaoFinal && (
                <Card className="border-primary/30">
                  <CardHeader><CardTitle className="text-base">Avaliação Final da Sequência</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground">{result.avaliacaoFinal}</p>
                  </CardContent>
                </Card>
              )}

              {result.observacoesPedagogicas && (
                <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">💡 Observações pedagógicas</p>
                    <p className="text-sm text-foreground">{result.observacoesPedagogicas}</p>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
