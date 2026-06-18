import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Download, Save, Copy, ArrowLeft, Shield, CheckCircle,
  FileText, ChevronDown, ChevronUp, Loader2, FileQuestion,
  Sparkles, X, Clock, BookOpen, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { usePlannings } from "@/hooks/use-plannings";
import { useAuth } from "@/contexts/auth-context";
import type { GeneratedPlanning, PlanningInput } from "@workspace/api-client-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function toStr(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(toStr).join("\n");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${toStr(v)}`)
      .join(" | ");
  }
  return String(value);
}

function toArr(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(toStr);
  if (typeof value === "string") return value.split("\n").filter(Boolean);
  return [toStr(value)].filter(Boolean);
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1");
}

function renderFrac(num: string, den: string, key: number | string) {
  return (
    <span
      key={key}
      className="inline-flex flex-col items-center mx-0.5"
      style={{ verticalAlign: "middle", fontSize: "0.82em", lineHeight: 1 }}
    >
      <span style={{ borderBottom: "1.5px solid currentColor", paddingInline: "2px", display: "block", textAlign: "center" }}>{num}</span>
      <span style={{ paddingInline: "2px", display: "block", textAlign: "center" }}>{den}</span>
    </span>
  );
}

function withFracs(str: string) {
  const reg = /\b(\d+)\/(\d+)\b/g;
  const nodes: (string | JSX.Element)[] = [];
  let last = 0;
  let ki = 0;
  let m: RegExpExecArray | null;
  while ((m = reg.exec(str)) !== null) {
    if (m.index > last) nodes.push(str.slice(last, m.index));
    nodes.push(renderFrac(m[1], m[2], ki++));
    last = m.index + m[0].length;
  }
  if (last < str.length) nodes.push(str.slice(last));
  if (nodes.length === 0) return str;
  if (nodes.length === 1 && typeof nodes[0] === "string") return nodes[0];
  return <>{nodes}</>;
}

function RenderText({ text, className }: { text: unknown; className?: string }) {
  const safe = typeof text === 'string' ? text : text == null ? '' : String(text);
  const parts = safe.split(/\*\*([^*]+)\*\*/g);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        i % 2 === 1
          ? <strong key={i}>{withFracs(p)}</strong>
          : <span key={i}>{withFracs(p)}</span>
      )}
    </span>
  );
}

// ── UI Components ─────────────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
      >
        <h3 className="font-semibold text-foreground">{title}</h3>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <CardContent className="pt-0 pb-4 px-4">
          <Separator className="mb-4" />
          {children}
        </CardContent>
      )}
    </Card>
  );
}

function StringList({ items }: { items: unknown[] }) {
  const strs = toArr(items);
  return (
    <ul className="space-y-1.5">
      {strs.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-foreground">
          <span className="text-primary mt-0.5">•</span>
          <RenderText text={item} />
        </li>
      ))}
    </ul>
  );
}

function TextBlock({ text }: { text: unknown }) {
  const str = toStr(text);
  const lines = str.split("\n");
  return (
    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
      {lines.map((line, li) => (
        <span key={li}>
          {li > 0 && "\n"}
          <RenderText text={line} />
        </span>
      ))}
    </p>
  );
}

// ── TXT Export ────────────────────────────────────────────────────────────────

function buildTxt(planning: GeneratedPlanning, input: PlanningInput | null): string {
  const pad = (s: string, n = 60) => s.padEnd(n, " ");
  const bar = (char: string, n = 60) => char.repeat(n);
  const section = (title: string) => [
    "",
    bar("─"),
    `  ${title.toUpperCase()}`,
    bar("─"),
  ];
  const bullet = (items: unknown[]) => toArr(items).map(s => `  • ${s}`);
  const numbered = (items: unknown[]) => toArr(items).map((s, i) => `  ${i + 1}. ${s}`);
  const indent = (text: unknown) =>
    toStr(text).split("\n").map(l => `  ${l}`);

  const meta = [
    input?.disciplina && `Disciplina: ${input.disciplina}`,
    input?.anoSerie && `Ano/Série: ${input.anoSerie}`,
    input?.turma && `Turma: ${input.turma}`,
    input?.quantidadeAulas && `Aulas: ${input.quantidadeAulas} x ${input?.duracaoAula ?? "?"}min`,
    `Data: ${new Date().toLocaleDateString("pt-BR")}`,
  ].filter(Boolean);

  const lines: string[] = [
    bar("═"),
    pad("  PLANEJAMENTO PEDAGÓGICO — PlanejaPro"),
    bar("═"),
    "",
    ...meta.map(m => `  ${m}`),
    "",
    `  TEMA: ${toStr(planning.tema)}`,
    "",
    bar("═"),

    ...section("Resumo Executivo"),
    "",
    ...indent(planning.versaoResumida),

    ...section("Objetivo Geral"),
    "",
    ...indent(planning.objetivoGeral),

    ...section("Objetivos Específicos"),
    "",
    ...bullet(planning.objetivosEspecificos ?? []),

    ...section("Competências (BNCC)"),
    "",
    ...bullet(planning.competencias ?? []),

    ...section("Habilidades (BNCC)"),
    "",
    ...bullet(planning.habilidades ?? []),

    ...section("Metodologia"),
    "",
    ...indent(planning.metodologia),

    ...section("Sequência Didática"),
    "",
    ...numbered(planning.sequenciaDidatica ?? []),

    ...section("Atividade Inicial"),
    "",
    ...indent(planning.atividadeInicial),

    ...section("Desenvolvimento Principal"),
    "",
    ...indent(planning.desenvolvimento),

    ...section("Atividade Prática"),
    "",
    ...indent(planning.atividadePratica),

    ...section("Encerramento"),
    "",
    ...indent(planning.encerramento),

    ...section("Avaliação"),
    "",
    ...indent(planning.avaliacao),

    ...section("Critérios Avaliativos"),
    "",
    ...bullet(planning.criteriosAvaliativos ?? []),

    ...section("Estratégias Inclusivas"),
    "",
    ...indent(planning.estrategiasInclusivas),

    ...section("Adaptações para Dificuldades"),
    "",
    ...indent(planning.adaptacoesDificuldades),

    ...section("Recursos Necessários"),
    "",
    ...bullet(planning.recursosNecessarios ?? []),

    ...section("Tarefa de Casa"),
    "",
    ...indent(planning.tarefaCasa),

    ...section("Observações Pedagógicas"),
    "",
    ...indent(planning.observacoesPedagogicas),

    ...section("Sugestões Extras"),
    "",
    ...bullet(planning.sugestoesExtras ?? []),

    "",
    bar("═"),
    "  Gerado por PlanejaPro — Revise e adapte conforme sua realidade.",
    "  O professor é o responsável final pelo conteúdo apresentado.",
    bar("═"),
  ];

  // BOM (byte order mark) garante que editores abram como UTF-8
  return "\uFEFF" + lines.join("\n");
}

// ── PDF Export ────────────────────────────────────────────────────────────────

async function generateAndDownloadPdf(planning: GeneratedPlanning, input: PlanningInput | null) {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const PW = 210;
  const MARGIN = 14;
  const CW = PW - MARGIN * 2;
  const PH = 297;
  const FOOTER_H = 12;
  const CONTENT_BOTTOM = PH - FOOTER_H - 4;

  // Brand colours
  const C_BLUE: [number, number, number] = [37, 99, 235];
  const C_BLUE_LIGHT: [number, number, number] = [219, 234, 254];
  const C_DARK: [number, number, number] = [17, 24, 39];
  const C_GRAY: [number, number, number] = [107, 114, 128];
  const C_WHITE: [number, number, number] = [255, 255, 255];
  const C_BG: [number, number, number] = [249, 250, 251];

  let y = 0;
  let pageNum = 1;

  // ── footer ──────────────────────────────────────────────────────────────
  function drawFooter() {
    const fy = PH - FOOTER_H;
    doc.setFillColor(...C_BLUE);
    doc.rect(0, fy, PW, FOOTER_H, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C_WHITE);
    doc.text("PlanejaPro — Revise e adapte conforme sua realidade", MARGIN, fy + 7.5);
    doc.text(`Pág. ${pageNum}`, PW - MARGIN, fy + 7.5, { align: "right" });
  }

  // ── new page ─────────────────────────────────────────────────────────────
  function newPage() {
    drawFooter();
    doc.addPage();
    pageNum++;
    y = MARGIN + 4;
  }

  function checkSpace(needed: number) {
    if (y + needed > CONTENT_BOTTOM) newPage();
  }

  // ── cover / header ───────────────────────────────────────────────────────
  // Blue top bar
  doc.setFillColor(...C_BLUE);
  doc.rect(0, 0, PW, 26, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...C_WHITE);
  doc.text("PlanejaPro", MARGIN, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }), PW - MARGIN, 16, { align: "right" });

  y = 34;

  // Subject title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...C_DARK);
  const titleLines = doc.splitTextToSize(toStr(planning.tema).toUpperCase(), CW) as string[];
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 8 + 4;

  // Metadata badges (simulated as rounded boxes)
  const badges = [
    input?.disciplina,
    input?.anoSerie,
    input?.turma ? `Turma ${input.turma}` : null,
    input?.quantidadeAulas ? `${input.quantidadeAulas} aula${input.quantidadeAulas !== 1 ? "s" : ""} × ${input?.duracaoAula ?? "?"}min` : null,
  ].filter(Boolean) as string[];

  let bx = MARGIN;
  doc.setFontSize(8.5);
  for (const badge of badges) {
    const bw = doc.getTextWidth(badge) + 6;
    if (bx + bw > PW - MARGIN) { bx = MARGIN; y += 8; }
    doc.setFillColor(...C_BLUE_LIGHT);
    doc.roundedRect(bx, y - 4.5, bw, 6.5, 1.5, 1.5, "F");
    doc.setTextColor(...C_BLUE);
    doc.setFont("helvetica", "bold");
    doc.text(badge, bx + 3, y);
    bx += bw + 3;
  }
  y += 10;

  // Thin separator line
  doc.setDrawColor(...C_BLUE_LIGHT);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PW - MARGIN, y);
  y += 6;

  // ── section helper ───────────────────────────────────────────────────────
  function sectionHeader(title: string) {
    checkSpace(12);
    doc.setFillColor(...C_BLUE);
    doc.rect(MARGIN, y, CW, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C_WHITE);
    doc.text(title.toUpperCase(), MARGIN + 4, y + 5.5);
    y += 11;
  }

  function addParagraph(text: unknown, fontSize = 9.5) {
    const str = stripMarkdown(toStr(text));
    if (!str) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...C_DARK);
    const wrapped = doc.splitTextToSize(str, CW - 4) as string[];
    for (const line of wrapped) {
      checkSpace(5.5);
      doc.text(line, MARGIN + 2, y);
      y += 5.5;
    }
    y += 2;
  }

  function addBulletList(items: unknown[], numbered = false) {
    const arr = toArr(items).map(stripMarkdown);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...C_DARK);
    for (let i = 0; i < arr.length; i++) {
      const prefix = numbered ? `${i + 1}.` : "•";
      const indent = numbered ? 7 : 5;
      const wrapped = doc.splitTextToSize(arr[i], CW - indent - 4) as string[];
      checkSpace(5.5 * wrapped.length + 1);
      doc.setFont("helvetica", "bold");
      doc.text(prefix, MARGIN + 2, y);
      doc.setFont("helvetica", "normal");
      for (let j = 0; j < wrapped.length; j++) {
        doc.text(wrapped[j], MARGIN + 2 + indent, y);
        y += 5.5;
      }
      y += 1;
    }
    y += 1;
  }

  function subLabel(label: string) {
    checkSpace(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...C_GRAY);
    doc.text(label.toUpperCase(), MARGIN + 2, y);
    y += 5;
  }

  // ── Resumo Executivo ─────────────────────────────────────────────────────
  // Highlighted box
  checkSpace(20);
  const resumo = toStr(planning.versaoResumida);
  const resumoLines = doc.splitTextToSize(resumo, CW - 8) as string[];
  const resumoH = resumoLines.length * 5.5 + 8;
  doc.setFillColor(...C_BG);
  doc.rect(MARGIN, y, CW, resumoH, "F");
  doc.setDrawColor(...C_BLUE_LIGHT);
  doc.setLineWidth(0.6);
  doc.rect(MARGIN, y, 2.5, resumoH, "F");
  doc.setFillColor(...C_BLUE);
  doc.rect(MARGIN, y, 2.5, resumoH, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...C_DARK);
  y += 5;
  for (const line of resumoLines) {
    doc.text(line, MARGIN + 6, y);
    y += 5.5;
  }
  y += 6;

  // ── Objetivos ─────────────────────────────────────────────────────────────
  sectionHeader("Objetivos");
  subLabel("Objetivo Geral");
  addParagraph(planning.objetivoGeral);
  subLabel("Objetivos Específicos");
  addBulletList(planning.objetivosEspecificos ?? []);

  // ── Competências e Habilidades ────────────────────────────────────────────
  sectionHeader("Competências e Habilidades (BNCC)");
  subLabel("Competências");
  addBulletList(planning.competencias ?? []);
  subLabel("Habilidades");
  addBulletList(planning.habilidades ?? []);

  // ── Metodologia ───────────────────────────────────────────────────────────
  sectionHeader("Metodologia");
  addParagraph(planning.metodologia);

  // ── Sequência Didática ────────────────────────────────────────────────────
  sectionHeader("Sequência Didática");
  addBulletList(planning.sequenciaDidatica ?? [], true);

  // ── Desenvolvimento das Aulas ─────────────────────────────────────────────
  sectionHeader("Desenvolvimento das Aulas");
  subLabel("Atividade Inicial");
  addParagraph(planning.atividadeInicial);
  subLabel("Desenvolvimento Principal");
  addParagraph(planning.desenvolvimento);
  subLabel("Atividade Prática");
  addParagraph(planning.atividadePratica);
  subLabel("Encerramento");
  addParagraph(planning.encerramento);

  // ── Avaliação ─────────────────────────────────────────────────────────────
  sectionHeader("Avaliação");
  subLabel("Estratégia de Avaliação");
  addParagraph(planning.avaliacao);
  subLabel("Critérios Avaliativos");
  addBulletList(planning.criteriosAvaliativos ?? []);

  // ── Inclusão e Adaptações ─────────────────────────────────────────────────
  sectionHeader("Inclusão e Adaptações");
  subLabel("Estratégias Inclusivas");
  addParagraph(planning.estrategiasInclusivas);
  subLabel("Adaptações para Dificuldades");
  addParagraph(planning.adaptacoesDificuldades);

  // ── Recursos e Tarefa ────────────────────────────────────────────────────
  sectionHeader("Recursos e Tarefa de Casa");
  subLabel("Recursos Necessários");
  addBulletList(planning.recursosNecessarios ?? []);
  subLabel("Tarefa de Casa");
  addParagraph(planning.tarefaCasa);

  // ── Observações e Sugestões ──────────────────────────────────────────────
  sectionHeader("Observações e Sugestões Extras");
  subLabel("Observações Pedagógicas");
  addParagraph(planning.observacoesPedagogicas);
  subLabel("Sugestões Extras");
  addBulletList(planning.sugestoesExtras ?? []);

  drawFooter();

  const slug = toStr(planning.tema).slice(0, 40).replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "") || "planejamento";
  doc.save(`planejamento-${slug}.pdf`);
}

// ── Page Component ────────────────────────────────────────────────────────────

const MELHORIA_FOCOS = [
  { value: "dinamicas", label: "Dinâmicas de grupo", emoji: "🎯" },
  { value: "jogos", label: "Gamificação e jogos", emoji: "🎮" },
  { value: "praticas", label: "Atividades práticas", emoji: "🔬" },
  { value: "metodologias", label: "Metodologias ativas", emoji: "💡" },
  { value: "sala_invertida", label: "Sala de aula invertida", emoji: "🔄" },
  { value: "colaborativa", label: "Aprendizagem colaborativa", emoji: "🤝" },
];

interface MelhoriaResult {
  foco: string;
  resumoMelhorias: string;
  sugestoes: Array<{
    titulo: string;
    descricao: string;
    tempo: string;
    materiais: string[];
    beneficios: string[];
    comoImplementar: string;
  }>;
  dicasProfessor: string[];
}

export default function Resultado() {
  const [, navigate] = useLocation();
  const [planning, setPlanning] = useState<GeneratedPlanning | null>(null);
  const [input, setInput] = useState<PlanningInput | null>(null);
  const [saved, setSaved] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showMelhoria, setShowMelhoria] = useState(false);
  const [melhoriaFoco, setMelhoriaFoco] = useState("dinamicas");
  const [melhoriaLoading, setMelhoriaLoading] = useState(false);
  const [melhoriaResult, setMelhoriaResult] = useState<MelhoriaResult | null>(null);
  const { savePlanning } = usePlannings();
  const { token, user } = useAuth();

  useEffect(() => {
    const resultStr = sessionStorage.getItem("planejapro_result");
    const inputStr = sessionStorage.getItem("planejapro_input");
    if (!resultStr) { navigate("/novo"); return; }
    try {
      setPlanning(JSON.parse(resultStr));
      if (inputStr) setInput(JSON.parse(inputStr));
    } catch {
      navigate("/novo");
    }
  }, [navigate]);

  const handleSave = () => {
    if (!planning || !input) return;
    const titulo = toStr(planning.tema) || `${input.disciplina} - ${input.anoSerie}`;
    savePlanning({
      id: crypto.randomUUID(),
      titulo,
      disciplina: input.disciplina,
      anoSerie: input.anoSerie,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      input,
      planning,
    });
    setSaved(true);
    toast.success("Planejamento salvo!", { description: `"${titulo}" foi salvo em Meus Planejamentos.` });
  };

  const handleExportTxt = () => {
    if (!planning) return;
    const content = buildTxt(planning, input);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planejamento-${toStr(planning.tema).slice(0, 30).replace(/\s+/g, "-") || "aula"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo TXT baixado!");
  };

  const handleExportPdf = async () => {
    if (!planning) return;
    setPdfLoading(true);
    try {
      await generateAndDownloadPdf(planning, input);
      toast.success("PDF baixado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF", { description: "Tente novamente." });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleCopyResumo = () => {
    if (!planning) return;
    navigator.clipboard.writeText(toStr(planning.versaoResumida));
    toast.success("Resumo copiado para a área de transferência!");
  };

  const handleMelhorar = async () => {
    if (!planning) return;
    setMelhoriaLoading(true);
    setMelhoriaResult(null);
    try {
      const res = await fetch("/api/tools/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: "improve",
          foco: melhoriaFoco,
          planejamento: JSON.stringify(planning).slice(0, 2000),
        }),
      });
      const json = await res.json() as MelhoriaResult & { error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao gerar sugestões");
      setMelhoriaResult(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar sugestões");
    } finally {
      setMelhoriaLoading(false);
    }
  };

  if (!planning) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl mx-auto"
    >
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="mb-4 gap-1 -ml-2" onClick={() => navigate("/novo")}>
          <ArrowLeft className="h-4 w-4" />
          Novo planejamento
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold font-serif text-foreground leading-tight mb-2">
              {toStr(planning.tema)}
            </h1>
            {input && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{input.disciplina}</Badge>
                <Badge variant="secondary">{input.anoSerie}</Badge>
                <Badge variant="secondary">{input.quantidadeAulas} aula{input.quantidadeAulas !== 1 ? "s" : ""}</Badge>
                {input.turma && <Badge variant="outline">Turma {input.turma}</Badge>}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyResumo}>
              <Copy className="h-4 w-4" />
              Copiar resumo
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportTxt}>
              <FileText className="h-4 w-4" />
              TXT
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportPdf} disabled={pdfLoading}>
              {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              PDF
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saved}>
              {saved ? <><CheckCircle className="h-4 w-4" /> Salvo</> : <><Save className="h-4 w-4" /> Salvar</>}
            </Button>
            <Button
              size="sm"
              variant="default"
              className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => {
                if (input) {
                  sessionStorage.setItem("planejapro_exam_prefill", JSON.stringify({
                    disciplina: input.disciplina,
                    anoSerie: input.anoSerie,
                    turma: input.turma,
                    conteudo: toStr(planning?.tema) + " — " + toStr(planning?.versaoResumida),
                  }));
                }
                navigate("/criar-prova");
              }}
            >
              <FileQuestion className="h-4 w-4" />
              Criar Prova
            </Button>
            <Button
              size="sm"
              variant="default"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => { setShowMelhoria(!showMelhoria); setMelhoriaResult(null); }}
            >
              <Sparkles className="h-4 w-4" />
              Melhorar Aula
              {!user?.isPremium && <Lock className="h-3 w-3 opacity-70" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Painel Melhorar Aula */}
      <AnimatePresence>
        {showMelhoria && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6"
          >
            <Card className="border-emerald-200 dark:border-emerald-800 relative overflow-hidden">

              {/* PRO overlay for non-premium users */}
              {!user?.isPremium && (
                <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm rounded-xl">
                  <div className="bg-card border border-border shadow-xl rounded-2xl p-6 max-w-xs w-full text-center">
                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Lock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h3 className="font-bold text-foreground mb-1">Recurso Premium</h3>
                    <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                      Melhore sua aula com sugestões de IA: dinâmicas, gamificação, metodologias ativas e muito mais.
                    </p>
                    <Button asChild size="sm" className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-2">
                      <a
                        href="https://wa.me/5514997966714?text=Ol%C3%A1!%20Gostaria%20de%20liberar%20meu%20acesso%20Premium%20ao%20PlanejaPro."
                        target="_blank" rel="noopener noreferrer"
                      >
                        Solicitar Acesso Premium
                      </a>
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">Atendimento via WhatsApp · Acesso imediato</p>
                  </div>
                </div>
              )}

              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Melhorar Aula com IA
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowMelhoria(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Escolha um foco e a IA vai sugerir melhorias práticas para esta aula</p>
              </CardHeader>
              <CardContent className={`space-y-4 ${!user?.isPremium ? "blur-sm pointer-events-none select-none" : ""}`}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MELHORIA_FOCOS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setMelhoriaFoco(f.value)}
                      className={`p-2.5 rounded-lg border-2 text-left text-sm transition-all ${
                        melhoriaFoco === f.value
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-300"
                          : "border-border hover:border-emerald-300"
                      }`}
                    >
                      <span className="mr-1">{f.emoji}</span> {f.label}
                    </button>
                  ))}
                </div>
                <Button
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleMelhorar}
                  disabled={melhoriaLoading}
                >
                  {melhoriaLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Gerando sugestões...</>
                  ) : (
                    <><Sparkles className="h-4 w-4" /> Gerar sugestões de melhoria</>
                  )}
                </Button>

                {melhoriaResult && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 pt-2">
                    <p className="text-sm text-emerald-800 dark:text-emerald-200 font-medium">
                      <RenderText text={melhoriaResult.resumoMelhorias} />
                    </p>
                    {melhoriaResult.sugestoes.map((s, i) => (
                      <div key={i} className="bg-muted/50 rounded-lg p-3 space-y-2">
                        <p className="font-semibold text-sm"><RenderText text={s.titulo} /></p>
                        <p className="text-sm text-muted-foreground"><RenderText text={s.descricao} /></p>
                        {s.comoImplementar && (
                          <div className="bg-background rounded p-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <BookOpen className="h-3 w-3" /> Como implementar
                            </p>
                            <p className="text-xs text-foreground"><RenderText text={s.comoImplementar} /></p>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {s.tempo && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Clock className="h-3 w-3" /> {s.tempo}
                            </Badge>
                          )}
                          {s.materiais?.map((m) => (
                            <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                          ))}
                        </div>
                        {s.beneficios?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {s.beneficios.map((b) => (
                              <span key={b} className="text-xs text-emerald-700 dark:text-emerald-400">✓ {b}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {melhoriaResult.dicasProfessor?.length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3">
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">💡 Dicas para o professor</p>
                        <ul className="space-y-1">
                          {melhoriaResult.dicasProfessor.map((d, i) => (
                            <li key={i} className="text-xs text-foreground flex gap-1.5">
                              <span className="text-amber-500">•</span> <RenderText text={d} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aviso */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-6 flex gap-2">
        <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-300">
          Revise e adapte este planejamento à sua realidade. O professor é o responsável final pelo conteúdo.
        </p>
      </div>

      {/* Versão resumida */}
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-primary flex gap-2">
            <FileText className="h-4 w-4" />
            Resumo executivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground leading-relaxed"><RenderText text={toStr(planning.versaoResumida)} /></p>
        </CardContent>
      </Card>

      {/* Seções */}
      <div className="space-y-3">
        <Section title="Objetivos">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Objetivo geral</p>
              <TextBlock text={planning.objetivoGeral} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Objetivos específicos</p>
              <StringList items={planning.objetivosEspecificos ?? []} />
            </div>
          </div>
        </Section>

        <Section title="Competências e Habilidades (BNCC)">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Competências</p>
              <StringList items={planning.competencias ?? []} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Habilidades</p>
              <StringList items={planning.habilidades ?? []} />
            </div>
          </div>
        </Section>

        <Section title="Metodologia">
          <TextBlock text={planning.metodologia} />
        </Section>

        <Section title="Sequência Didática">
          <div className="space-y-2">
            {toArr(planning.sequenciaDidatica ?? []).map((step, i) => (
              <div key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm text-foreground leading-relaxed"><RenderText text={step} /></p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Desenvolvimento das Aulas">
          <div className="space-y-4">
            {[
              { label: "Atividade inicial", val: planning.atividadeInicial },
              { label: "Desenvolvimento principal", val: planning.desenvolvimento },
              { label: "Atividade prática", val: planning.atividadePratica },
              { label: "Encerramento", val: planning.encerramento },
            ].map(({ label, val }) => (
              <div key={label}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{label}</p>
                <TextBlock text={val} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Avaliação">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Estratégia de avaliação</p>
              <TextBlock text={planning.avaliacao} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Critérios avaliativos</p>
              <StringList items={planning.criteriosAvaliativos ?? []} />
            </div>
          </div>
        </Section>

        <Section title="Inclusão e Adaptações">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Estratégias inclusivas</p>
              <TextBlock text={planning.estrategiasInclusivas} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Adaptações para dificuldades</p>
              <TextBlock text={planning.adaptacoesDificuldades} />
            </div>
          </div>
        </Section>

        <Section title="Recursos e Tarefa de Casa" defaultOpen={false}>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Recursos necessários</p>
              <StringList items={planning.recursosNecessarios ?? []} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Tarefa de casa</p>
              <TextBlock text={planning.tarefaCasa} />
            </div>
          </div>
        </Section>

        <Section title="Observações e Sugestões" defaultOpen={false}>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Observações pedagógicas</p>
              <TextBlock text={planning.observacoesPedagogicas} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Sugestões extras</p>
              <StringList items={planning.sugestoesExtras ?? []} />
            </div>
          </div>
        </Section>
      </div>

      {/* Footer actions */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3 pb-8">
        <Button variant="outline" onClick={handleExportTxt} className="gap-2 flex-1">
          <FileText className="h-4 w-4" />
          Baixar TXT
        </Button>
        <Button variant="outline" onClick={handleExportPdf} disabled={pdfLoading} className="gap-2 flex-1">
          {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar PDF
        </Button>
        <Button onClick={handleSave} disabled={saved} className="gap-2 flex-1">
          {saved ? <><CheckCircle className="h-4 w-4" /> Salvo</> : <><Save className="h-4 w-4" /> Salvar planejamento</>}
        </Button>
      </div>
    </motion.div>
  );
}
