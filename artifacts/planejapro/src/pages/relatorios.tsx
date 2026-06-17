import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2, FileText, ArrowLeft, Copy, CheckCircle, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";

const TIPOS = [
  {
    value: "parecer",
    label: "Parecer Descritivo",
    emoji: "📝",
    desc: "Relato individual do desenvolvimento do aluno, formal e positivo",
  },
  {
    value: "individual",
    label: "Relatório Individual",
    emoji: "👤",
    desc: "Desempenho, participação, pontos fortes e áreas de atenção",
  },
  {
    value: "turma",
    label: "Relatório de Turma",
    emoji: "👥",
    desc: "Perfil da turma, desafios coletivos e estratégias pedagógicas",
  },
  {
    value: "observacoes",
    label: "Observações Pedagógicas",
    emoji: "🔍",
    desc: "Registro de observações e encaminhamentos pedagógicos",
  },
];

const schema = z.object({
  tipo: z.enum(["parecer", "individual", "turma", "observacoes"]),
  informacoes: z.string().min(20, "Forneça mais informações para gerar o relatório"),
  nomeAluno: z.string().optional(),
  anoSerie: z.string().optional(),
  disciplina: z.string().optional(),
  periodo: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Result {
  tipo: string;
  titulo: string;
  textoCompleto: string;
  pontosPrincipais: string[];
  recomendacoes: string[];
}

export default function Relatorios() {
  const [, navigate] = useLocation();
  const { token } = useAuth();
  const [result, setResult] = useState<Result | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: "parecer" },
  });

  const tipo = watch("tipo");
  const tipoSelecionado = TIPOS.find(t => t.value === tipo);
  const showAluno = tipo === "parecer" || tipo === "individual" || tipo === "observacoes";

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      const json = await res.json() as Result & { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao gerar relatório");
      setResult(json);
      toast.success("Relatório gerado com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar relatório");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.textoCompleto);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const html = `<html><body><h1>${result.titulo}</h1><div style="white-space:pre-wrap;line-height:1.6">${result.textoCompleto}</div><h3>Recomendações</h3><ul>${result.recomendacoes.map(r => `<li>${r}</li>`).join("")}</ul></body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-${Date.now()}.doc`; a.click();
    URL.revokeObjectURL(url);
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
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold font-serif text-foreground">Relatórios Pedagógicos</h1>
          </div>
          <p className="text-muted-foreground">
            Forneça as informações e a IA organiza o texto de forma profissional e pedagógica.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tipo de documento *</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{t.emoji}</span>
                      <span className="font-medium text-sm">{t.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações complementares</CardTitle>
              <CardDescription>Dados que ajudam a personalizar o documento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {showAluno && (
                  <div className="space-y-1.5">
                    <Label>Nome do aluno/a</Label>
                    <Input placeholder="Nome completo" {...register("nomeAluno")} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label>Ano/Série</Label>
                  <Input placeholder="Ex: 7º Ano EF" {...register("anoSerie")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Disciplina</Label>
                  <Input placeholder="Ex: Matemática" {...register("disciplina")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Período</Label>
                  <Input placeholder="Ex: 1º Bimestre 2025" {...register("periodo")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {tipoSelecionado ? `${tipoSelecionado.emoji} ${tipoSelecionado.label}` : "Informações"} *
              </CardTitle>
              <CardDescription>
                Descreva livremente o que observou, como foi o desempenho, comportamento, dificuldades, destaques, etc. A IA organiza tudo profissionalmente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Ex: Lucas demonstra participação ativa nas aulas. Tem dificuldade com frações mas progrediu muito desde o início do bimestre. É solidário com os colegas. Precisa de mais atenção na leitura e interpretação de textos..."
                rows={8}
                {...register("informacoes")}
              />
              {errors.informacoes && <p className="text-xs text-destructive mt-1">{errors.informacoes.message}</p>}
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full gap-2" disabled={isLoading}>
            {isLoading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Gerando relatório...</>
            ) : (
              <><FileText className="h-5 w-5" /> Gerar relatório com IA</>
            )}
          </Button>
        </form>

        <AnimatePresence>
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-8">
              <Card><CardContent className="p-6 space-y-3">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent></Card>
            </motion.div>
          )}

          {result && !isLoading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{result.titulo}</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                    {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    Copiar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
                    <Download className="h-4 w-4" /> DOCX
                  </Button>
                </div>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-base">Texto do relatório</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {result.textoCompleto}
                  </p>
                </CardContent>
              </Card>

              {result.pontosPrincipais?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Pontos principais</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {result.pontosPrincipais.map((p, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="text-primary">•</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {result.recomendacoes?.length > 0 && (
                <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
                  <CardHeader><CardTitle className="text-base text-green-800 dark:text-green-300">✓ Recomendações</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {result.recomendacoes.map((r, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="text-green-500">→</span>
                          <span className="text-foreground">{r}</span>
                        </li>
                      ))}
                    </ul>
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
