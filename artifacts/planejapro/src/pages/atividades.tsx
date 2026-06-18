import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Loader2, ClipboardList, ChevronRight, ArrowLeft, Download,
  Copy, CheckCircle, Clock, BookOpen, Users, Lightbulb, Lock,
  LayoutList, Sparkles,
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

// ── Markdown helpers ──────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .trim();
}

function RenderText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <strong key={i}>{part}</strong>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

// ── PDF — Simples ─────────────────────────────────────────────────────────────

function handlePDFSimples(result: Result) {
  import("jspdf").then(({ default: jsPDF }) => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxW = pageW - margin * 2;
    let y = 20;

    const addText = (text: string, size = 11, bold = false) => {
      const clean = stripMarkdown(text);
      doc.setFontSize(size);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(clean, maxW);
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
  });
}

// ── PDF — Decorado ─────────────────────────────────────────────────────────────

async function handlePDFDecorado(result: Result, formData: Partial<FormData>) {
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
    doc.text("Gerado por PlanejaPro", MARGIN, fy + 6.5);
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

  function renderLines(text: string, fontSize: number, bold: boolean,
    color: [number, number, number], x: number, maxW: number, lineH: number) {
    const clean = stripMarkdown(text);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(clean, maxW) as string[];
    for (const line of lines) {
      checkSpace(lineH + 1);
      doc.text(line, x, y);
      y += lineH;
    }
    return lines.length * lineH;
  }

  // ── Header ──────────────────────────────────────────────────────────────────
  const titleLines = doc.splitTextToSize(stripMarkdown(result.titulo), CW - 10) as string[];
  const headerH = 18 + titleLines.length * 7;

  doc.setFillColor(...C_BLUE);
  doc.rect(0, 0, PW, headerH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C_WHITE);
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

  // ── Info grid ───────────────────────────────────────────────────────────────
  const infoH = 16;
  doc.setFillColor(...C_BG);
  doc.rect(MARGIN, y, CW, infoH, "F");
  doc.setDrawColor(...C_BLUE_LIGHT);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CW, infoH);

  const col1x = MARGIN + 4;
  const col2x = MARGIN + CW / 3 + 4;
  const col3x = MARGIN + (CW / 3) * 2 + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C_GRAY);
  doc.text("DISCIPLINA", col1x, y + 5);
  doc.text("ANO/SÉRIE", col2x, y + 5);
  doc.text("TIPO", col3x, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C_DARK);
  doc.text(formData.disciplina || "—", col1x, y + 12);
  doc.text(formData.anoSerie || "—", col2x, y + 12);
  const tipoLabel = TIPOS.find(t => t.value === formData.tipo)?.label || "—";
  doc.text(tipoLabel, col3x, y + 12);

  y += infoH + 6;

  // ── Description ─────────────────────────────────────────────────────────────
  {
    const clean = stripMarkdown(result.descricao);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(...C_GRAY);
    const lines = doc.splitTextToSize(clean, CW) as string[];
    for (const line of lines) {
      checkSpace(6);
      doc.text(line, MARGIN, y);
      y += 5.5;
    }
    y += 4;
  }

  // ── Activities ──────────────────────────────────────────────────────────────
  for (const a of result.atividades) {
    checkSpace(20);

    // Section banner
    doc.setFillColor(...C_BLUE);
    doc.rect(MARGIN, y, CW, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C_WHITE);
    doc.text(`ATIVIDADE ${a.numero}: ${stripMarkdown(a.titulo).toUpperCase()}`, MARGIN + 5, y + 6.2);
    y += 12;

    // Enunciado
    {
      const clean = stripMarkdown(a.enunciado);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(clean, CW - 10) as string[];
      const enuncH = lines.length * 6 + 10;
      checkSpace(enuncH);
      doc.setFillColor(...C_BG);
      doc.rect(MARGIN, y, CW, enuncH, "F");
      doc.setTextColor(...C_DARK);
      for (let li = 0; li < lines.length; li++) {
        doc.text(lines[li], MARGIN + 5, y + 7 + li * 6);
      }
      y += enuncH + 4;
    }

    // Instructions box (yellow)
    if (a.instrucoes) {
      const clean = stripMarkdown(a.instrucoes);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(clean, CW - 16) as string[];
      const instrH = lines.length * 5.5 + 10;
      checkSpace(instrH);
      doc.setFillColor(254, 252, 232);
      doc.rect(MARGIN, y, CW, instrH, "F");
      doc.setDrawColor(253, 224, 71);
      doc.setLineWidth(0.3);
      doc.rect(MARGIN, y, CW, instrH);
      doc.setFillColor(234, 179, 8);
      doc.rect(MARGIN, y, 3, instrH, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(113, 63, 18);
      doc.text("INSTRUÇÕES:", MARGIN + 7, y + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      for (let li = 0; li < lines.length; li++) {
        doc.text(lines[li], MARGIN + 7, y + 11 + li * 5.5);
      }
      y += instrH + 3;
    }

    // Meta row (time, materials, objective)
    const metaItems: string[] = [];
    if (a.tempoEstimado) metaItems.push(`⏱ ${stripMarkdown(a.tempoEstimado)}`);
    if (a.materiais?.length) metaItems.push(`📚 ${a.materiais.map(m => stripMarkdown(m)).join(", ")}`);
    if (a.objetivoPedagogico) metaItems.push(`🎯 ${stripMarkdown(a.objetivoPedagogico)}`);

    if (metaItems.length > 0) {
      checkSpace(8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...C_GRAY);
      const metaText = metaItems.join("   ·   ");
      const metaLines = doc.splitTextToSize(metaText, CW) as string[];
      for (const ml of metaLines) {
        checkSpace(6);
        doc.text(ml, MARGIN, y);
        y += 5.5;
      }
    }

    // Divider
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y + 3, PW - MARGIN, y + 3);
    y += 10;
  }

  drawFooter();

  doc.save(`atividades-decorado-${Date.now()}.pdf`);
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Atividades() {
  const [, navigate] = useLocation();
  const { token, user } = useAuth();
  const isPremium = user?.isPremium ?? false;
  const [result, setResult] = useState<Result | null>(null);
  const [formSnapshot, setFormSnapshot] = useState<Partial<FormData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfEstilo, setPdfEstilo] = useState<"simples" | "decorado">("decorado");

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { quantidade: 5, dificuldade: "medio", tipo: "exercicios" },
  });

  const dificuldade = watch("dificuldade");
  const tipo = watch("tipo");

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setResult(null);
    setFormSnapshot(data);
    try {
      const res = await fetch("/api/tools/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, type: "activities" }),
      });
      const text = await res.text();
      let json: Result & { error?: string };
      try {
        json = JSON.parse(text) as Result & { error?: string };
      } catch {
        throw new Error("Serviço temporariamente indisponível. Tente novamente em instantes.");
      }
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
      `Atividade ${i + 1}: ${stripMarkdown(a.titulo)}\n${stripMarkdown(a.enunciado)}\n\nInstruções: ${stripMarkdown(a.instrucoes)}\nTempo: ${a.tempoEstimado}\n`
    ).join("\n---\n");
    navigator.clipboard.writeText(`${stripMarkdown(result.titulo)}\n\n${text}`);
    setCopied(true);
    toast.success("Copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePDF = async () => {
    if (!result) return;
    if (pdfEstilo === "decorado") {
      try {
        await handlePDFDecorado(result, formSnapshot);
        toast.success("PDF decorado baixado!");
      } catch {
        toast.error("Erro ao gerar PDF. Tente novamente.");
      }
    } else {
      handlePDFSimples(result);
    }
  };

  const handleDOCX = () => {
    if (!result) return;
    const content = result.atividades.map((a, i) =>
      `<h3>Atividade ${i + 1}: ${stripMarkdown(a.titulo)}</h3><p>${stripMarkdown(a.enunciado)}</p><p><b>Instruções:</b> ${stripMarkdown(a.instrucoes)}</p><p><b>Tempo:</b> ${a.tempoEstimado}</p>${a.materiais?.length ? `<p><b>Materiais:</b> ${a.materiais.map(m => stripMarkdown(m)).join(", ")}</p>` : ""}<hr/>`
    ).join("");
    const html = `<html><body><h1>${stripMarkdown(result.titulo)}</h1><p>${stripMarkdown(result.descricao)}</p>${content}</body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `atividades-${Date.now()}.doc`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo Word baixado!");
  };

  return (
    <div className="relative">
      {!isPremium && <PremiumOverlay tool="Gerador de Atividades" />}
      <div className={`max-w-2xl mx-auto ${!isPremium ? "blur-sm pointer-events-none select-none" : ""}`}>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Button variant="ghost" size="sm" className="mb-4 gap-1 -ml-2" onClick={() => window.history.length > 2 ? window.history.back() : navigate("/")}>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Formato do PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPdfEstilo("simples")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    pdfEstilo === "simples"
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <LayoutList className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold text-sm">Simples</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Texto limpo, sem cores. Ideal para imprimir e economizar tinta.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfEstilo("decorado")}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    pdfEstilo === "decorado"
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    <span className="font-semibold text-sm">Decorado</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Com cabeçalho, cores e seções destacadas. Estilo profissional.
                  </p>
                </button>
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
                  <h2 className="text-xl font-bold font-serif">
                    <RenderText text={result.titulo} />
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    <RenderText text={result.descricao} />
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                    {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    Copiar
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePDF} className="gap-1.5">
                    <Download className="h-4 w-4" />
                    PDF {pdfEstilo === "decorado" ? "✨" : ""}
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
                            <h3 className="font-semibold text-foreground mb-2">
                              <RenderText text={a.titulo} />
                            </h3>
                            <p className="text-sm text-foreground leading-relaxed mb-3">
                              <RenderText text={a.enunciado} />
                            </p>

                            {a.instrucoes && (
                              <div className="bg-muted/50 rounded-lg p-3 mb-3">
                                <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                                  <Lightbulb className="h-3 w-3" /> Instruções
                                </p>
                                <p className="text-sm text-foreground">
                                  <RenderText text={a.instrucoes} />
                                </p>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2 text-xs">
                              {a.tempoEstimado && (
                                <Badge variant="secondary" className="gap-1">
                                  <Clock className="h-3 w-3" /> {stripMarkdown(a.tempoEstimado)}
                                </Badge>
                              )}
                              {a.tipo && (
                                <Badge variant="secondary" className="gap-1">
                                  <Users className="h-3 w-3" /> {stripMarkdown(a.tipo)}
                                </Badge>
                              )}
                              {a.materiais?.map((m) => (
                                <Badge key={m} variant="outline" className="gap-1">
                                  <BookOpen className="h-3 w-3" /> {stripMarkdown(m)}
                                </Badge>
                              ))}
                            </div>

                            {a.objetivoPedagogico && (
                              <p className="text-xs text-muted-foreground mt-2 italic">
                                🎯 <RenderText text={a.objetivoPedagogico} />
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
    </div>
  );
}
