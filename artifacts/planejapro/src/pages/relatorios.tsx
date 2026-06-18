import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2, FileText, ArrowLeft, Copy, CheckCircle, Download, Lock,
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

async function generateRelatorioPdf(result: Result, formData: Partial<FormData>) {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const PW = 210;
  const PH = 297;
  const MARGIN = 18;
  const CW = PW - MARGIN * 2;
  const FOOTER_H = 10;
  const CONTENT_BOTTOM = PH - FOOTER_H - 6;

  const C_BLUE: [number, number, number] = [37, 99, 235];
  const C_BLUE_LIGHT: [number, number, number] = [219, 234, 254];
  const C_DARK: [number, number, number] = [17, 24, 39];
  const C_GRAY: [number, number, number] = [100, 116, 139];
  const C_WHITE: [number, number, number] = [255, 255, 255];
  const C_BG: [number, number, number] = [248, 250, 252];
  const C_GREEN: [number, number, number] = [22, 163, 74];
  const C_GREEN_BG: [number, number, number] = [240, 253, 244];
  const C_LINE: [number, number, number] = [203, 213, 225];

  let y = 0;
  let pageNum = 1;

  function drawFooter() {
    const fy = PH - FOOTER_H;
    doc.setFillColor(...C_BLUE);
    doc.rect(0, fy, PW, FOOTER_H, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...C_WHITE);
    doc.text("Gerado por PlanejaPro — Documento pedagógico", MARGIN, fy + 6.5);
    doc.text(`Página ${pageNum}`, PW - MARGIN, fy + 6.5, { align: "right" });
  }

  function newPage() {
    drawFooter();
    doc.addPage();
    pageNum++;
    y = MARGIN + 4;
  }

  function checkSpace(needed: number) {
    if (y + needed > CONTENT_BOTTOM) newPage();
  }

  function renderBlock(text: string, fontSize: number, bold: boolean, color: [number, number, number], x: number, maxW: number, lineH: number): number {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxW) as string[];
    for (const line of lines) {
      checkSpace(lineH + 1);
      doc.text(line, x, y);
      y += lineH;
    }
    return lines.length * lineH;
  }

  // ── Header ─────────────────────────────────────────────────────────────────
  const tipoObj = TIPOS.find(t => t.value === result.tipo);
  const tipoLabel = tipoObj ? tipoObj.label : "Relatório Pedagógico";
  const titleLines = doc.splitTextToSize(result.titulo, CW - 10) as string[];
  const headerH = 18 + titleLines.length * 7;

  doc.setFillColor(...C_BLUE);
  doc.rect(0, 0, PW, headerH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C_WHITE);
  doc.setFillColor(255, 255, 255, 0.15);
  doc.text("PlanejaPro", MARGIN, 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(dateStr, PW - MARGIN, 10, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...C_WHITE);
  for (let i = 0; i < titleLines.length; i++) {
    doc.text(titleLines[i], MARGIN, 18 + i * 7);
  }

  y = headerH + 4;

  // ── Tipo badge strip ────────────────────────────────────────────────────────
  doc.setFillColor(...C_BLUE_LIGHT);
  doc.rect(MARGIN, y, CW, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C_BLUE);
  doc.text(tipoLabel.toUpperCase(), MARGIN + 4, y + 6);
  y += 13;

  // ── Info Grid ───────────────────────────────────────────────────────────────
  const hasAluno = formData.nomeAluno || formData.anoSerie || formData.disciplina || formData.periodo;
  if (hasAluno) {
    const infoH = 26;
    doc.setFillColor(...C_BG);
    doc.rect(MARGIN, y, CW, infoH, "F");
    doc.setDrawColor(...C_BLUE_LIGHT);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, y, CW, infoH);

    const col1x = MARGIN + 4;
    const col2x = MARGIN + CW / 2 + 4;
    const halfW = CW / 2 - 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C_GRAY);

    if (formData.nomeAluno) {
      doc.text("ALUNO(A)", col1x, y + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...C_DARK);
      const nLines = doc.splitTextToSize(formData.nomeAluno, halfW) as string[];
      doc.text(nLines[0], col1x, y + 12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...C_GRAY);
    }

    if (formData.disciplina) {
      doc.text("DISCIPLINA", col2x, y + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...C_DARK);
      const dLines = doc.splitTextToSize(formData.disciplina, halfW) as string[];
      doc.text(dLines[0], col2x, y + 12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...C_GRAY);
    }

    if (formData.anoSerie) {
      doc.text("ANO/SÉRIE", col1x, y + 19);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...C_DARK);
      doc.text(formData.anoSerie, col1x, y + 25);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...C_GRAY);
    }

    if (formData.periodo) {
      doc.text("PERÍODO", col2x, y + 19);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...C_DARK);
      doc.text(formData.periodo, col2x, y + 25);
    }

    y += infoH + 8;
  }

  // ── Report Text ─────────────────────────────────────────────────────────────
  checkSpace(14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C_BLUE);
  doc.text("TEXTO DO RELATÓRIO", MARGIN, y);
  y += 5;

  doc.setDrawColor(...C_BLUE);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, MARGIN + CW, y);
  y += 5;

  const paragraphs = result.textoCompleto.split(/\n+/).filter(p => p.trim().length > 0);
  for (const para of paragraphs) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...C_DARK);
    const lines = doc.splitTextToSize(para.trim(), CW) as string[];
    for (const line of lines) {
      checkSpace(7);
      doc.text(line, MARGIN, y);
      y += 6;
    }
    y += 2;
  }

  y += 4;

  // ── Key Points ─────────────────────────────────────────────────────────────
  if (result.pontosPrincipais && result.pontosPrincipais.length > 0) {
    checkSpace(18);

    doc.setFillColor(...C_BLUE);
    doc.rect(MARGIN, y, CW, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C_WHITE);
    doc.text("PONTOS PRINCIPAIS", MARGIN + 5, y + 6.2);
    y += 12;

    for (const ponto of result.pontosPrincipais) {
      const lines = doc.splitTextToSize(ponto, CW - 12) as string[];
      const rowH = lines.length * 6 + 6;
      checkSpace(rowH + 2);

      doc.setFillColor(...C_BG);
      doc.rect(MARGIN, y, CW, rowH, "F");

      doc.setFillColor(...C_BLUE);
      doc.circle(MARGIN + 4, y + rowH / 2, 1.8, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...C_DARK);
      for (let li = 0; li < lines.length; li++) {
        doc.text(lines[li], MARGIN + 10, y + 5 + li * 6);
      }

      doc.setDrawColor(...C_LINE);
      doc.setLineWidth(0.15);
      doc.line(MARGIN, y + rowH, MARGIN + CW, y + rowH);
      y += rowH + 1;
    }

    y += 6;
  }

  // ── Recommendations ─────────────────────────────────────────────────────────
  if (result.recomendacoes && result.recomendacoes.length > 0) {
    checkSpace(18);

    doc.setFillColor(...C_GREEN);
    doc.rect(MARGIN, y, CW, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C_WHITE);
    doc.text("RECOMENDAÇÕES", MARGIN + 5, y + 6.2);
    y += 12;

    for (const rec of result.recomendacoes) {
      const lines = doc.splitTextToSize(rec, CW - 12) as string[];
      const rowH = lines.length * 6 + 6;
      checkSpace(rowH + 2);

      doc.setFillColor(...C_GREEN_BG);
      doc.rect(MARGIN, y, CW, rowH, "F");

      doc.setFillColor(...C_GREEN);
      doc.rect(MARGIN, y, 3, rowH, "F");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...C_DARK);
      for (let li = 0; li < lines.length; li++) {
        doc.text(lines[li], MARGIN + 7, y + 5 + li * 6);
      }

      doc.setDrawColor(187, 247, 208);
      doc.setLineWidth(0.15);
      doc.line(MARGIN, y + rowH, MARGIN + CW, y + rowH);
      y += rowH + 1;
    }
  }

  drawFooter();

  const slug = (result.tipo || "relatorio").toLowerCase().replace(/\s+/g, "-");
  const filename = `relatorio-${slug}-${Date.now()}.pdf`;
  doc.save(filename);
}

export default function Relatorios() {
  const [, navigate] = useLocation();
  const { token, user } = useAuth();
  const isPremium = user?.isPremium ?? false;
  const [result, setResult] = useState<Result | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formSnapshot, setFormSnapshot] = useState<Partial<FormData>>({});

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
    setFormSnapshot(data);
    try {
      const res = await fetch("/api/tools/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, type: "reports" }),
      });
      const text = await res.text();
      let json: Result & { error?: string };
      try {
        json = JSON.parse(text) as Result & { error?: string };
      } catch {
        throw new Error("Serviço temporariamente indisponível. Tente novamente em instantes.");
      }
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

  const handleDownloadDocx = () => {
    if (!result) return;
    const html = `<html><body><h1>${result.titulo}</h1><div style="white-space:pre-wrap;line-height:1.6">${result.textoCompleto}</div><h3>Recomendações</h3><ul>${result.recomendacoes.map(r => `<li>${r}</li>`).join("")}</ul></body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-${Date.now()}.doc`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo Word baixado!");
  };

  const handleDownloadPdf = async () => {
    if (!result) return;
    try {
      await generateRelatorioPdf(result, formSnapshot);
      toast.success("PDF baixado!");
    } catch {
      toast.error("Erro ao gerar PDF. Tente novamente.");
    }
  };

  return (
    <div className="relative">
      {!isPremium && <PremiumOverlay tool="Relatórios Pedagógicos" />}
      <div className={`max-w-2xl mx-auto ${!isPremium ? "blur-sm pointer-events-none select-none" : ""}`}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Button variant="ghost" size="sm" className="mb-4 gap-1 -ml-2" onClick={() => window.history.length > 2 ? window.history.back() : navigate("/")}>
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
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-bold">{result.titulo}</h2>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                    {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    Copiar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-1.5">
                    <Download className="h-4 w-4" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadDocx} className="gap-1.5">
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
    </div>
  );
}
