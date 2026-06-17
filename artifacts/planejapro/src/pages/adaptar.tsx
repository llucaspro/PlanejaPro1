import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2, Wand2, ArrowLeft, Copy, CheckCircle, Download, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";

const TIPOS_ADAPTACAO = [
  {
    value: "simplificar",
    label: "Linguagem mais simples",
    emoji: "📖",
    desc: "Vocabulário acessível, frases curtas, exemplos do cotidiano",
  },
  {
    value: "serie_inferior",
    label: "Série inferior",
    emoji: "⬇️",
    desc: "Adaptar para alunos mais novos, conceitos mais concretos",
  },
  {
    value: "serie_superior",
    label: "Série superior",
    emoji: "⬆️",
    desc: "Aprofundar conceitos para alunos mais avançados",
  },
  {
    value: "resumo",
    label: "Resumo didático",
    emoji: "📋",
    desc: "Condensar o conteúdo mantendo os pontos essenciais",
  },
  {
    value: "revisao_rapida",
    label: "Revisão rápida",
    emoji: "⚡",
    desc: "Guia de revisão em tópicos, ideal para véspera de prova",
  },
];

const schema = z.object({
  conteudo: z.string().min(20, "Forneça pelo menos 20 caracteres de conteúdo"),
  tipo: z.enum(["simplificar", "serie_inferior", "serie_superior", "resumo", "revisao_rapida"]),
  serieAlvo: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Result {
  titulo: string;
  tipo: string;
  conteudoAdaptado: string;
  observacoesPedagogicas: string;
  diferencas: string[];
}

function SkeletonResult() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
    </div>
  );
}

const WA_LINK = "https://wa.me/5514997966714?text=Ol%C3%A1!%20Gostaria%20de%20liberar%20meu%20acesso%20Premium%20ao%20PlanejaPro.";

function PremiumOverlay({ tool }: { tool: string }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-card border border-border shadow-2xl rounded-2xl p-8 max-w-sm w-full text-center"
      >
        <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-xl font-bold font-serif text-foreground mb-2">🔒 {tool} Premium</h2>
        <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
          Esta ferramenta está disponível apenas para assinantes Premium. Libere o acesso para usar com IA ilimitada.
        </p>
        <Button asChild size="lg" className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-2">
          <a href={WA_LINK} target="_blank" rel="noopener noreferrer">Solicitar Acesso Premium</a>
        </Button>
        <p className="text-xs text-muted-foreground mt-3">Atendimento via WhatsApp · Acesso imediato após confirmação</p>
      </motion.div>
    </div>
  );
}

export default function Adaptar() {
  const [, navigate] = useLocation();
  const { token, user } = useAuth();
  const isPremium = user?.isPremium ?? false;
  const [result, setResult] = useState<Result | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: "simplificar" },
  });

  const tipo = watch("tipo");
  const tipoSelecionado = TIPOS_ADAPTACAO.find(t => t.value === tipo);

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/tools/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, type: "adapt" }),
      });
      const json = await res.json() as Result & { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao adaptar conteúdo");
      setResult(json);
      toast.success("Conteúdo adaptado com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao adaptar conteúdo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.conteudoAdaptado);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!result) return;
    const html = `<html><body><h1>${result.titulo}</h1><div style="white-space:pre-wrap">${result.conteudoAdaptado}</div><h3>Observações pedagógicas</h3><p>${result.observacoesPedagogicas}</p></body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `adaptacao-${Date.now()}.doc`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative">
      {!isPremium && <PremiumOverlay tool="Adaptação de Conteúdo" />}
      <div className={`max-w-2xl mx-auto ${!isPremium ? "blur-sm pointer-events-none select-none" : ""}`}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Button variant="ghost" size="sm" className="mb-4 gap-1 -ml-2" onClick={() => navigate(-1 as never)}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wand2 className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold font-serif text-foreground">Adaptação de Conteúdo</h1>
          </div>
          <p className="text-muted-foreground">
            Cole qualquer texto, planejamento ou atividade e a IA adapta para o que você precisar.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tipo de adaptação *</CardTitle>
              <CardDescription>Como você quer que a IA transforme o conteúdo?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {TIPOS_ADAPTACAO.map((t) => (
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

          {(tipo === "serie_inferior" || tipo === "serie_superior") && (
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-1.5">
                  <Label>Série/faixa etária alvo (opcional)</Label>
                  <Input placeholder="Ex: 5º Ano EF, 2º Ano EM..." {...register("serieAlvo")} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conteúdo original *</CardTitle>
              <CardDescription>
                Cole aqui o texto, planejamento, atividade ou conteúdo que deseja adaptar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Cole aqui seu texto, planejamento, atividade ou qualquer conteúdo pedagógico..."
                rows={8}
                {...register("conteudo")}
              />
              {errors.conteudo && <p className="text-xs text-destructive mt-1">{errors.conteudo.message}</p>}
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full gap-2" disabled={isLoading}>
            {isLoading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Adaptando conteúdo...</>
            ) : (
              <><Wand2 className="h-5 w-5" /> Adaptar com IA</>
            )}
          </Button>
        </form>

        <AnimatePresence>
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-8">
              <Card>
                <CardContent className="p-6">
                  <SkeletonResult />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {result && !isLoading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">{result.titulo}</h2>
                  {tipoSelecionado && (
                    <span className="text-sm text-muted-foreground">
                      {tipoSelecionado.emoji} {tipoSelecionado.label}
                    </span>
                  )}
                </div>
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
                <CardHeader><CardTitle className="text-base">Conteúdo adaptado</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {result.conteudoAdaptado}
                  </p>
                </CardContent>
              </Card>

              {result.observacoesPedagogicas && (
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                  <CardHeader><CardTitle className="text-base text-amber-800 dark:text-amber-300">💡 Observações para o professor</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-amber-900 dark:text-amber-200">{result.observacoesPedagogicas}</p>
                  </CardContent>
                </Card>
              )}

              {result.diferencas?.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">Principais mudanças</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {result.diferencas.map((d, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="text-primary">✓</span>
                          <span>{d}</span>
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
    </div>
  );
}
