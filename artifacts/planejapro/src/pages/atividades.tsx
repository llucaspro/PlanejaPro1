import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2, ClipboardList, ChevronRight, ArrowLeft, Download,
  Copy, CheckCircle, Clock, BookOpen, Users, Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

const TIPOS = [
  { value: "exercicios", label: "Exercícios", icon: "📝" },
  { value: "revisao", label: "Revisão", icon: "🔄" },
  { value: "recuperacao", label: "Recuperação", icon: "🆙" },
  { value: "tarefa", label: "Tarefa de Casa", icon: "🏠" },
  { value: "grupo", label: "Atividade em Grupo", icon: "👥" },
];

const DIFICULDADES = [
  { value: "facil", label: "🟢 Fácil", desc: "Fixação e revisão" },
  { value: "medio", label: "🟡 Médio", desc: "Padrão escolar" },
  { value: "dificil", label: "🔴 Difícil", desc: "Padrão vestibular" },
];

const schema = z.object({
  disciplina: z.string().min(2, "Informe a disciplina"),
  anoSerie: z.string().min(1, "Selecione o ano/série"),
  tema: z.string().min(3, "Descreva o tema"),
  quantidade: z.coerce.number().min(1).max(20).default(5),
  dificuldade: z.enum(["facil", "medio", "dificil"]),
  tipo: z.enum(["exercicios", "revisao", "recuperacao", "tarefa", "grupo"]),
});

type FormData = z.infer<typeof schema>;

interface Atividade {
  numero: number;
  titulo: string;
  tipo: string;
  enunciado: string;
  instrucoes: string;
  materiais: string[];
  tempoEstimado: string;
  objetivoPedagogico: string;
}

interface Result {
  titulo: string;
  descricao: string;
  atividades: Atividade[];
  _meta: { dificuldade: string; tipo: string };
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  );
}

export default function Atividades() {
  const [, navigate] = useLocation();
  const { token } = useAuth();
  const [result, setResult] = useState<Result | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantidade: 5, dificuldade: "medio", tipo: "exercicios" },
  });

  const dificuldade = watch("dificuldade");
  const tipo = watch("tipo");

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/activities/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      const json = await res.json() as Result & { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao gerar atividades");
      setResult(json);
      toast.success("Atividades geradas com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar atividades");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text = result.atividades.map((a, i) =>
      `Atividade ${i + 1}: ${a.titulo}\n${a.enunciado}\n\nInstruções: ${a.instrucoes}\nTempo: ${a.tempoEstimado}\n`
    ).join("\n---\n");
    navigator.clipboard.writeText(`${result.titulo}\n\n${text}`);
    setCopied(true);
    toast.success("Copiado para a área de transferência!");
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
    addText(result.descricao, 10);
    y += 4;

    result.atividades.forEach((a, i) => {
      if (y > 240) { doc.addPage(); y = 20; }
      addText(`Atividade ${i + 1}: ${a.titulo}`, 13, true);
      addText(a.enunciado, 10);
      if (a.instrucoes) addText(`Instruções: ${a.instrucoes}`, 10);
      if (a.tempoEstimado) addText(`Tempo estimado: ${a.tempoEstimado}`, 10);
      if (a.materiais?.length) addText(`Materiais: ${a.materiais.join(", ")}`, 10);
      y += 4;
    });

    doc.save(`atividades-${Date.now()}.pdf`);
    toast.success("PDF baixado!");
  };

  const handleDOCX = () => {
    if (!result) return;
    const content = result.atividades.map((a, i) =>
      `<h3>Atividade ${i + 1}: ${a.titulo}</h3><p>${a.enunciado}</p><p><b>Instruções:</b> ${a.instrucoes}</p><p><b>Tempo:</b> ${a.tempoEstimado}</p>${a.materiais?.length ? `<p><b>Materiais:</b> ${a.materiais.join(", ")}</p>` : ""}<hr/>`
    ).join("");
    const html = `<html><body><h1>${result.titulo}</h1><p>${result.descricao}</p>${content}</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `atividades-${Date.now()}.doc`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo Word baixado!");
  };

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Button variant="ghost" size="sm" className="mb-4 gap-1 -ml-2" onClick={() => navigate(-1 as never)}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold font-serif text-foreground">Gerador de Atividades</h1>
          </div>
          <p className="text-muted-foreground">
            Gere atividades prontas para sala de aula em segundos com auxílio da IA.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Dados da atividade</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Disciplina *</Label>
                  <Input placeholder="Ex: Matemática, Português..." {...register("disciplina")} />
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
                <Textarea placeholder="Ex: Frações, Revolução Industrial, Fotossíntese..." rows={2} {...register("tema")} />
                {errors.tema && <p className="text-xs text-destructive">{errors.tema.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade de atividades</Label>
                <Input type="number" min={1} max={20} {...register("quantidade")} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tipo de atividade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TIPOS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setValue("tipo", t.value as FormData["tipo"])}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      tipo === t.value
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="text-xl mb-1">{t.icon}</div>
                    <div className="text-xs font-medium">{t.label}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Nível de dificuldade *</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {DIFICULDADES.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setValue("dificuldade", d.value as FormData["dificuldade"])}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                      dificuldade === d.value
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="font-semibold text-sm">{d.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{d.desc}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full gap-2" disabled={isLoading}>
            {isLoading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Gerando atividades...</>
            ) : (
              <><ClipboardList className="h-5 w-5" /> Gerar atividades com IA <ChevronRight className="h-4 w-4" /></>
            )}
          </Button>
        </form>

        <AnimatePresence>
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-8 space-y-3">
              {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
            </motion.div>
          )}

          {result && !isLoading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold font-serif">{result.titulo}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{result.descricao}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                    {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    Copiar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePDF} className="gap-1.5">
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDOCX} className="gap-1.5">
                    <Download className="h-4 w-4" /> DOCX
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {result.atividades.map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card>
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground mb-2">{a.titulo}</h3>
                            <p className="text-sm text-foreground leading-relaxed mb-3">{a.enunciado}</p>

                            {a.instrucoes && (
                              <div className="bg-muted/50 rounded-lg p-3 mb-3">
                                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                  <Lightbulb className="h-3 w-3" /> Instruções
                                </p>
                                <p className="text-sm text-foreground">{a.instrucoes}</p>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2 text-xs">
                              {a.tempoEstimado && (
                                <Badge variant="secondary" className="gap-1">
                                  <Clock className="h-3 w-3" /> {a.tempoEstimado}
                                </Badge>
                              )}
                              {a.tipo && (
                                <Badge variant="secondary" className="gap-1">
                                  <Users className="h-3 w-3" /> {a.tipo}
                                </Badge>
                              )}
                              {a.materiais?.map((m) => (
                                <Badge key={m} variant="outline" className="gap-1">
                                  <BookOpen className="h-3 w-3" /> {m}
                                </Badge>
                              ))}
                            </div>

                            {a.objetivoPedagogico && (
                              <p className="text-xs text-muted-foreground mt-2 italic">
                                🎯 {a.objetivoPedagogico}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
