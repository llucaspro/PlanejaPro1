import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Download, ArrowLeft, Loader2, FileQuestion, Eye, EyeOff, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { GeneratedExam, ExamInput, ExamAlternativa, ExamDiscursiva } from "@workspace/api-client-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function altLabel(key: string) {
  return key.toUpperCase();
}

// ── PDF Generator ─────────────────────────────────────────────────────────────

async function generateExamPdf(exam: GeneratedExam, input: ExamInput | null, showGabarito: boolean) {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const PW = 210;
  const PH = 297;
  const MARGIN = 18;           // wider margins — was 14
  const CW = PW - MARGIN * 2; // 174mm usable width
  const FOOTER_H = 10;
  const CONTENT_BOTTOM = PH - FOOTER_H - 6;

  const C_BLUE: [number, number, number] = [37, 99, 235];
  const C_BLUE_LIGHT: [number, number, number] = [219, 234, 254];
  const C_DARK: [number, number, number] = [17, 24, 39];
  const C_GRAY: [number, number, number] = [100, 116, 139];
  const C_WHITE: [number, number, number] = [255, 255, 255];
  const C_BG: [number, number, number] = [248, 250, 252];
  const C_GREEN: [number, number, number] = [22, 163, 74];
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
    doc.text("Gerado por PlanejaPro — Revise antes de imprimir", MARGIN, fy + 6.5);
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

  // wrap + render text block, returns height used
  function renderLines(text: string, fontSize: number, bold: boolean, italic: boolean,
    color: [number,number,number], x: number, maxW: number, lineH: number): number {
    doc.setFont("helvetica", bold ? (italic ? "bolditalic" : "bold") : (italic ? "italic" : "normal"));
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

  // ── Cover Header ────────────────────────────────────────────────────────────
  const schoolName = input?.nomeEscola || "Escola";
  const titleLines = doc.splitTextToSize(exam.titulo, CW - 10) as string[];
  const headerH = 16 + titleLines.length * 7;

  doc.setFillColor(...C_BLUE);
  doc.rect(0, 0, PW, headerH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...C_WHITE);
  doc.text(schoolName, MARGIN, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(dateStr, PW - MARGIN, 12, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...C_WHITE);
  for (let i = 0; i < titleLines.length; i++) {
    doc.text(titleLines[i], MARGIN, 20 + i * 7);
  }

  y = headerH + 5;

  // ── Info Grid ───────────────────────────────────────────────────────────────
  const infoH = 24;
  doc.setFillColor(...C_BG);
  doc.rect(MARGIN, y, CW, infoH, "F");
  doc.setDrawColor(...C_BLUE_LIGHT);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CW, infoH);

  const col1x = MARGIN + 4;
  const col2x = MARGIN + CW / 2 + 4;
  const halfW = CW / 2 - 8;

  // labels
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C_GRAY);
  doc.text("PROFESSOR(A)", col1x, y + 6);
  doc.text("DISCIPLINA", col2x, y + 6);

  // values — clamp to half width
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C_DARK);
  const profLines = doc.splitTextToSize(input?.nomeProfessor || "—", halfW) as string[];
  const discLines = doc.splitTextToSize(input?.disciplina || "—", halfW) as string[];
  doc.text(profLines[0], col1x, y + 12);
  doc.text(discLines[0], col2x, y + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C_GRAY);
  doc.text("ANO/SÉRIE", col1x, y + 18);
  doc.text("TURMA", col2x, y + 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C_DARK);
  doc.text(input?.anoSerie || "—", col1x, y + 24);
  doc.text(input?.turma || "—", col2x, y + 24);

  y += infoH + 5;

  // ── Student Fields (Nome / Data / Nota) ─────────────────────────────────────
  doc.setDrawColor(...C_LINE);
  doc.setLineWidth(0.4);
  const nameW = CW * 0.58;
  const dateW = CW * 0.22;
  const notaW = CW - nameW - dateW - 4;
  const boxH = 12;

  doc.setFillColor(255, 255, 255);
  doc.rect(MARGIN, y, nameW, boxH);
  doc.rect(MARGIN + nameW + 2, y, dateW, boxH);
  doc.rect(MARGIN + nameW + dateW + 4, y, notaW, boxH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C_GRAY);
  doc.text("NOME DO ALUNO(A)", MARGIN + 3, y + 4);
  doc.text("DATA", MARGIN + nameW + 5, y + 4);
  doc.text("NOTA", MARGIN + nameW + dateW + 7, y + 4);

  if (input?.bimestre) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C_GRAY);
    doc.text(input.bimestre, PW - MARGIN, y + boxH - 2, { align: "right" });
  }

  y += boxH + 6;

  // ── Instructions ────────────────────────────────────────────────────────────
  const instrText = exam.instrucoes || "Leia atentamente cada questão antes de responder.";
  const instrMaxW = CW - 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const instrLines = doc.splitTextToSize(instrText, instrMaxW) as string[];
  const instrH = instrLines.length * 5.5 + 10;
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
  doc.text("INSTRUÇÕES:", MARGIN + 6, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let iy = y + 12;
  for (const line of instrLines) {
    doc.text(line, MARGIN + 6, iy);
    iy += 5.5;
  }
  y += instrH + 6;

  // ── Section Banner helper ────────────────────────────────────────────────────
  function drawSectionBanner(label: string, total: number) {
    checkSpace(12);
    doc.setFillColor(...C_BLUE);
    doc.rect(MARGIN, y, CW, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C_WHITE);
    doc.text(label, MARGIN + 5, y + 6.2);
    if (total > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Total: ${total.toFixed(1)} pts`, PW - MARGIN - 3, y + 6.2, { align: "right" });
    }
    y += 12;
  }

  // ── Multiple Choice ──────────────────────────────────────────────────────────
  if (exam.questoesAlternativas && exam.questoesAlternativas.length > 0) {
    const totalAlt = exam.questoesAlternativas.reduce((s, q) => s + (q.valor ?? 0), 0);
    const label = exam.questoesAlternativas.length === 1
      ? "QUESTÃO DE MÚLTIPLA ESCOLHA"
      : `QUESTÕES DE MÚLTIPLA ESCOLHA (${exam.questoesAlternativas.length} questões)`;
    drawSectionBanner(label, totalAlt);

    const ENUNC_X = MARGIN + 8;
    const ENUNC_W = CW - 8;    // enunciado text area
    const CIRC_X = MARGIN + 8; // circle center
    const ALT_X = MARGIN + 17; // alt text starts here
    const ALT_W = CW - 17;     // alt text max width

    for (const q of exam.questoesAlternativas) {
      const enuncLines = doc.splitTextToSize(q.enunciado, ENUNC_W - 6) as string[];
      const enuncH = enuncLines.length * 5.5;
      const altKeys = ["a", "b", "c", "d", "e"] as const;
      const altHeights = altKeys.map(k => {
        const ls = doc.splitTextToSize(q.alternativas[k] ?? "", ALT_W) as string[];
        return ls.length * 5.5;
      });
      const totalQH = 10 + enuncH + altHeights.reduce((a, b) => a + b, 0) + altKeys.length * 3 + 6;
      checkSpace(Math.min(totalQH, 60));

      // question number + enunciado
      doc.setFillColor(...C_BG);
      doc.rect(MARGIN, y, CW, enuncH + 8, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...C_BLUE);
      doc.text(`${q.numero}.`, MARGIN + 2, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...C_DARK);
      for (let li = 0; li < enuncLines.length; li++) {
        doc.text(enuncLines[li], ENUNC_X, y + 6 + li * 5.5);
      }

      if (q.valor) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...C_GRAY);
        doc.text(`(${q.valor.toFixed(1)} pts)`, PW - MARGIN - 2, y + 6, { align: "right" });
      }
      y += enuncH + 10;

      // alternatives
      for (let ai = 0; ai < altKeys.length; ai++) {
        const key = altKeys[ai];
        const altVal = q.alternativas[key] ?? "";
        const lines = doc.splitTextToSize(altVal, ALT_W) as string[];
        const rowH = lines.length * 5.5 + 4;
        const isCorrect = showGabarito && q.gabarito === key;

        checkSpace(rowH + 1);

        if (isCorrect) {
          doc.setFillColor(240, 253, 244);
          doc.rect(MARGIN, y - 1, CW, rowH, "F");
        }

        const cy = y + rowH / 2 - 1;
        doc.setDrawColor(...C_LINE);
        doc.setLineWidth(0.3);
        if (isCorrect) {
          doc.setFillColor(...C_GREEN);
          doc.circle(CIRC_X, cy, 3, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(...C_WHITE);
        } else {
          doc.setFillColor(...C_WHITE);
          doc.circle(CIRC_X, cy, 3, "FD");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8.5);
          doc.setTextColor(...C_DARK);
        }
        doc.text(key.toUpperCase(), CIRC_X - doc.getTextWidth(key.toUpperCase()) / 2, cy + 1.2);

        doc.setFont("helvetica", isCorrect ? "bold" : "normal");
        doc.setFontSize(10);
        doc.setTextColor(isCorrect ? C_GREEN[0] : C_DARK[0], isCorrect ? C_GREEN[1] : C_DARK[1], isCorrect ? C_GREEN[2] : C_DARK[2]);
        for (let li = 0; li < lines.length; li++) {
          doc.text(lines[li], ALT_X, y + 4.5 + li * 5.5);
        }
        y += rowH + 1;
      }

      // divider
      doc.setDrawColor(...C_LINE);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + 2, PW - MARGIN, y + 2);
      y += 7;
    }
  }

  // ── Discursive ───────────────────────────────────────────────────────────────
  if (exam.questoesDiscursivas && exam.questoesDiscursivas.length > 0) {
    y += 2;
    const totalDisc = exam.questoesDiscursivas.reduce((s, q) => s + (q.valor ?? 0), 0);
    const discLabel = exam.questoesDiscursivas.length === 1
      ? "QUESTÃO DISCURSIVA"
      : `QUESTÕES DISCURSIVAS (${exam.questoesDiscursivas.length} questões)`;
    drawSectionBanner(discLabel, totalDisc);

    const ENUNC_X = MARGIN + 8;
    const ENUNC_W = CW - 10;

    for (const q of exam.questoesDiscursivas) {
      const enuncLines = doc.splitTextToSize(q.enunciado, ENUNC_W) as string[];
      const enuncH = enuncLines.length * 5.5;
      checkSpace(enuncH + 20);

      doc.setFillColor(...C_BG);
      doc.rect(MARGIN, y, CW, enuncH + 8, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...C_BLUE);
      doc.text(`${q.numero}.`, MARGIN + 2, y + 6);

      if (q.valor) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...C_GRAY);
        doc.text(`(${q.valor.toFixed(1)} pts)`, PW - MARGIN - 2, y + 6, { align: "right" });
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...C_DARK);
      for (let li = 0; li < enuncLines.length; li++) {
        doc.text(enuncLines[li], ENUNC_X, y + 6 + li * 5.5);
      }
      y += enuncH + 10;

      if (showGabarito && q.criterios) {
        const critLines = doc.splitTextToSize(`Critérios: ${q.criterios}`, CW - 8) as string[];
        const critH = critLines.length * 5 + 6;
        checkSpace(critH);
        doc.setFillColor(220, 252, 231);
        doc.rect(MARGIN, y, CW, critH, "F");
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8.5);
        doc.setTextColor(...C_GREEN);
        for (let ci = 0; ci < critLines.length; ci++) {
          doc.text(critLines[ci], MARGIN + 4, y + 5 + ci * 5);
        }
        y += critH + 4;
      } else {
        const nLines = q.linhasResposta ?? 6;
        for (let i = 0; i < nLines; i++) {
          checkSpace(8);
          doc.setDrawColor(...C_LINE);
          doc.setLineWidth(0.25);
          doc.line(MARGIN, y + 7, PW - MARGIN, y + 7);
          y += 8;
        }
        y += 3;
      }

      doc.setDrawColor(...C_LINE);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + 1, PW - MARGIN, y + 1);
      y += 7;
    }
  }

  drawFooter();

  // ── Gabarito Page ────────────────────────────────────────────────────────────
  if (showGabarito && exam.questoesAlternativas && exam.questoesAlternativas.length > 0) {
    doc.addPage();
    pageNum++;

    doc.setFillColor(...C_BLUE);
    doc.rect(0, 0, PW, 20, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...C_WHITE);
    doc.text("GABARITO — USO EXCLUSIVO DO PROFESSOR", MARGIN, 13);

    y = 28;

    const cols = 5;
    const cellW = CW / cols;
    const cellH = 12;

    const altQs = exam.questoesAlternativas;
    for (let i = 0; i < altQs.length; i++) {
      const col = i % cols;
      if (col === 0 && i > 0) y += cellH + 2;
      const cx = MARGIN + col * cellW;
      checkSpace(cellH + 2);

      doc.setFillColor(...C_BG);
      doc.rect(cx, y, cellW - 2, cellH, "F");
      doc.setDrawColor(...C_LINE);
      doc.setLineWidth(0.2);
      doc.rect(cx, y, cellW - 2, cellH);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...C_DARK);
      doc.text(`${altQs[i].numero}.`, cx + 3, y + 8);

      doc.setFillColor(...C_GREEN);
      doc.circle(cx + cellW - 9, y + 6, 4, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...C_WHITE);
      const gl = altQs[i].gabarito.toUpperCase();
      doc.text(gl, cx + cellW - 9 - doc.getTextWidth(gl) / 2, y + 8);
    }

    drawFooter();
  }

  const slug = (input?.disciplina || "prova").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const filename = showGabarito ? `gabarito-${slug}.pdf` : `prova-${slug}.pdf`;
  doc.save(filename);
}

// ── Preview Components ────────────────────────────────────────────────────────

function AlternativaCard({ q }: { q: ExamAlternativa }) {
  const altKeys = ["a", "b", "c", "d", "e"] as const;
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 bg-muted/40">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Badge variant="default" className="text-xs mt-0.5 flex-shrink-0">{q.numero}</Badge>
            <p className="text-sm font-medium text-foreground leading-snug">{q.enunciado}</p>
          </div>
          {q.valor && <Badge variant="outline" className="text-xs flex-shrink-0">{q.valor.toFixed(1)} pt{q.valor !== 1 ? "s" : ""}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="pt-3 pb-3 space-y-1.5">
        {altKeys.map((key) => (
          <div key={key} className={`flex items-start gap-2 p-1.5 rounded text-sm ${key === q.gabarito ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800" : ""}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${key === q.gabarito ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}`}>
              {key.toUpperCase()}
            </span>
            <span className={key === q.gabarito ? "text-green-800 dark:text-green-300 font-medium" : "text-foreground"}>
              {q.alternativas[key]}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DiscursivaCard({ q }: { q: ExamDiscursiva }) {
  return (
    <Card>
      <CardHeader className="pb-2 bg-muted/40">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <Badge variant="default" className="text-xs mt-0.5 flex-shrink-0">{q.numero}</Badge>
            <p className="text-sm font-medium text-foreground leading-snug">{q.enunciado}</p>
          </div>
          <Badge variant="outline" className="text-xs flex-shrink-0">{q.valor.toFixed(1)} pt{q.valor !== 1 ? "s" : ""}</Badge>
        </div>
      </CardHeader>
      {q.criterios && (
        <CardContent className="pt-2 pb-3">
          <p className="text-xs text-muted-foreground italic">Critérios: {q.criterios}</p>
          <p className="text-xs text-muted-foreground mt-1">{q.linhasResposta ?? 6} linhas para resposta</p>
        </CardContent>
      )}
    </Card>
  );
}

// ── Page Component ─────────────────────────────────────────────────────────────

export default function ProvaResultado() {
  const [, navigate] = useLocation();
  const [exam, setExam] = useState<GeneratedExam | null>(null);
  const [input, setInput] = useState<ExamInput | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [gabaritoLoading, setGabaritoLoading] = useState(false);
  const [showGabarito, setShowGabarito] = useState(false);

  useEffect(() => {
    const examStr = sessionStorage.getItem("planejapro_exam_result");
    const inputStr = sessionStorage.getItem("planejapro_exam_input");
    if (!examStr) { navigate("/criar-prova"); return; }
    try {
      setExam(JSON.parse(examStr));
      if (inputStr) setInput(JSON.parse(inputStr));
    } catch {
      navigate("/criar-prova");
    }
  }, [navigate]);

  const handleDownloadProva = async () => {
    if (!exam) return;
    setPdfLoading(true);
    try {
      await generateExamPdf(exam, input, false);
      toast.success("PDF da prova baixado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF", { description: "Tente novamente." });
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadGabarito = async () => {
    if (!exam) return;
    setGabaritoLoading(true);
    try {
      await generateExamPdf(exam, input, true);
      toast.success("PDF com gabarito baixado!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF", { description: "Tente novamente." });
    } finally {
      setGabaritoLoading(false);
    }
  };

  if (!exam) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
      </div>
    );
  }

  const totalAlt = exam.questoesAlternativas?.length ?? 0;
  const totalDisc = exam.questoesDiscursivas?.length ?? 0;
  const totalPts = [
    ...( exam.questoesAlternativas ?? []).map(q => q.valor ?? 0),
    ...(exam.questoesDiscursivas ?? []).map(q => q.valor ?? 0),
  ].reduce((a, b) => a + b, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl mx-auto"
    >
      <Button variant="ghost" size="sm" className="mb-4 gap-1 -ml-2" onClick={() => navigate("/criar-prova")}>
        <ArrowLeft className="h-4 w-4" />
        Nova prova
      </Button>

      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileQuestion className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold font-serif text-foreground">{exam.titulo}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {input?.disciplina && <Badge variant="secondary">{input.disciplina}</Badge>}
              {input?.anoSerie && <Badge variant="secondary">{input.anoSerie}</Badge>}
              {input?.turma && <Badge variant="outline">Turma {input.turma}</Badge>}
              {input?.bimestre && <Badge variant="outline">{input.bimestre}</Badge>}
              {totalAlt > 0 && <Badge variant="outline">{totalAlt} alt.</Badge>}
              {totalDisc > 0 && <Badge variant="outline">{totalDisc} disc.</Badge>}
              {totalPts > 0 && <Badge className="bg-primary/10 text-primary border-primary/20">{totalPts.toFixed(1)} pts total</Badge>}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowGabarito(!showGabarito)}
            >
              {showGabarito ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showGabarito ? "Ocultar gabarito" : "Ver gabarito"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleDownloadGabarito}
              disabled={gabaritoLoading}
            >
              {gabaritoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
              PDF c/ gabarito
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleDownloadProva}
              disabled={pdfLoading}
            >
              {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Baixar PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-6">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Instruções da prova:</strong> {exam.instrucoes}
        </p>
      </div>

      {totalAlt > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-foreground">Questões de Múltipla Escolha</h2>
            <Badge variant="secondary">{totalAlt}</Badge>
          </div>
          <div className="space-y-3">
            {exam.questoesAlternativas.map((q) => (
              <AlternativaCard key={q.numero} q={showGabarito ? q : { ...q, gabarito: showGabarito ? q.gabarito : "__hidden__" }} />
            ))}
          </div>
        </div>
      )}

      {totalAlt > 0 && totalDisc > 0 && <Separator className="my-6" />}

      {totalDisc > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-foreground">Questões Discursivas</h2>
            <Badge variant="secondary">{totalDisc}</Badge>
          </div>
          <div className="space-y-3">
            {exam.questoesDiscursivas.map((q) => (
              <DiscursivaCard key={q.numero} q={q} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 pt-6 border-t flex flex-wrap gap-3 justify-center">
        <Button variant="outline" className="gap-2" onClick={handleDownloadGabarito} disabled={gabaritoLoading}>
          {gabaritoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
          Baixar PDF com gabarito
        </Button>
        <Button className="gap-2" onClick={handleDownloadProva} disabled={pdfLoading}>
          {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar PDF para alunos
        </Button>
      </div>
    </motion.div>
  );
}
