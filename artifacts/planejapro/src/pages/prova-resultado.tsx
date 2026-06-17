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
  const MARGIN = 14;
  const CW = PW - MARGIN * 2;
  const FOOTER_H = 10;
  const CONTENT_BOTTOM = PH - FOOTER_H - 4;

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
    y = MARGIN + 2;
  }

  function checkSpace(needed: number) {
    if (y + needed > CONTENT_BOTTOM) newPage();
  }

  function addText(text: string, fontSize: number, bold: boolean, color: [number,number,number], indent = 0, lineH = 5.2) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const wrapped = doc.splitTextToSize(text, CW - indent - 2) as string[];
    for (const line of wrapped) {
      checkSpace(lineH);
      doc.text(line, MARGIN + indent, y);
      y += lineH;
    }
  }

  // ── Cover Header ────────────────────────────────────────────────────────────
  doc.setFillColor(...C_BLUE);
  doc.rect(0, 0, PW, 28, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...C_WHITE);
  const schoolName = input?.nomeEscola || "Escola";
  doc.text(schoolName, MARGIN, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  doc.text(dateStr, PW - MARGIN, 12, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(exam.titulo, MARGIN, 22);

  y = 34;

  // ── Info Grid ───────────────────────────────────────────────────────────────
  doc.setFillColor(...C_BG);
  doc.rect(MARGIN, y, CW, 22, "F");
  doc.setDrawColor(...C_BLUE_LIGHT);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CW, 22);

  const col1x = MARGIN + 3;
  const col2x = MARGIN + CW / 2 + 2;
  const rowH = 5.5;
  const labelSize = 7.5;
  const valueSize = 9;

  // Row 1
  doc.setFont("helvetica", "bold");
  doc.setFontSize(labelSize);
  doc.setTextColor(...C_GRAY);
  doc.text("PROFESSOR(A)", col1x, y + 5);
  doc.text("DISCIPLINA", col2x, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(valueSize);
  doc.setTextColor(...C_DARK);
  doc.text(input?.nomeProfessor || "___________________________", col1x, y + 5 + rowH);
  doc.text(input?.disciplina || "___________________________", col2x, y + 5 + rowH);

  // Row 2
  doc.setFont("helvetica", "bold");
  doc.setFontSize(labelSize);
  doc.setTextColor(...C_GRAY);
  doc.text("ANO/SÉRIE", col1x, y + 5 + rowH * 2 + 1);
  doc.text("TURMA", col2x, y + 5 + rowH * 2 + 1);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(valueSize);
  doc.setTextColor(...C_DARK);
  doc.text(input?.anoSerie || "___________", col1x, y + 5 + rowH * 3 + 1);
  doc.text(input?.turma || "___________", col2x, y + 5 + rowH * 3 + 1);

  y += 28;

  // ── Student Header ──────────────────────────────────────────────────────────
  doc.setFillColor(...C_WHITE);
  doc.setDrawColor(...C_LINE);
  doc.setLineWidth(0.4);

  const nameBoxW = CW * 0.62;
  const dateBoxW = CW * 0.20;
  const scoreBoxW = CW * 0.16;
  const boxH = 10;
  const boxY = y;

  doc.rect(MARGIN, boxY, nameBoxW, boxH);
  doc.rect(MARGIN + nameBoxW + 1, boxY, dateBoxW, boxH);
  doc.rect(MARGIN + nameBoxW + dateBoxW + 2, boxY, scoreBoxW, boxH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C_GRAY);
  doc.text("NOME DO ALUNO(A)", MARGIN + 2, boxY + 3.5);
  doc.text("DATA", MARGIN + nameBoxW + 3, boxY + 3.5);
  doc.text("NOTA", MARGIN + nameBoxW + dateBoxW + 4, boxY + 3.5);

  if (input?.bimestre) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C_GRAY);
    doc.text(input.bimestre, PW - MARGIN, boxY + 8.5, { align: "right" });
  }

  y += 14;

  // ── Instructions ────────────────────────────────────────────────────────────
  const instrText = exam.instrucoes || "Leia atentamente cada questão antes de responder.";
  const instrLines = doc.splitTextToSize(instrText, CW - 8) as string[];
  const instrH = instrLines.length * 4.5 + 6;
  checkSpace(instrH);
  doc.setFillColor(254, 252, 232);
  doc.rect(MARGIN, y, CW, instrH, "F");
  doc.setDrawColor(253, 224, 71);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CW, instrH);
  doc.setFillColor(234, 179, 8);
  doc.rect(MARGIN, y, 2.5, instrH, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(113, 63, 18);
  doc.text("INSTRUÇÕES:", MARGIN + 5, y + 4.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(113, 63, 18);
  let iy = y + 4.5 + 4.5;
  for (const line of instrLines) {
    doc.text(line, MARGIN + 5, iy);
    iy += 4.5;
  }
  y += instrH + 4;

  // ── Multiple Choice Section ──────────────────────────────────────────────────
  if (exam.questoesAlternativas && exam.questoesAlternativas.length > 0) {
    checkSpace(10);
    doc.setFillColor(...C_BLUE);
    doc.rect(MARGIN, y, CW, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C_WHITE);
    const altLabel2 = exam.questoesAlternativas.length === 1 ? "QUESTÃO DE MÚLTIPLA ESCOLHA" : `QUESTÕES DE MÚLTIPLA ESCOLHA (${exam.questoesAlternativas.length} questões)`;
    doc.text(altLabel2, MARGIN + 4, y + 5.5);

    const totalAlt = exam.questoesAlternativas.reduce((s, q) => s + (q.valor ?? 0), 0);
    if (totalAlt > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(`Total: ${totalAlt.toFixed(1)} pts`, PW - MARGIN - 2, y + 5.5, { align: "right" });
    }
    y += 11;

    for (const q of exam.questoesAlternativas) {
      const enuncLines = doc.splitTextToSize(q.enunciado, CW - 10) as string[];
      const altLines = Object.values(q.alternativas).map(v =>
        doc.splitTextToSize(v as string, CW - 22) as string[]
      );
      const altHeight = altLines.reduce((s, ls) => s + ls.length * 4.5, 0) + 4;
      const qHeight = enuncLines.length * 5 + altHeight + 8;

      checkSpace(Math.min(qHeight, 50));

      doc.setFillColor(...C_BG);
      doc.rect(MARGIN, y, CW, 7, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...C_BLUE);
      doc.text(`${q.numero}.`, MARGIN + 2, y + 5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...C_DARK);
      const firstEnuncLine = enuncLines[0];
      doc.text(firstEnuncLine, MARGIN + 7, y + 5);
      y += 7;

      for (let li = 1; li < enuncLines.length; li++) {
        checkSpace(5);
        doc.text(enuncLines[li], MARGIN + 7, y);
        y += 5;
      }

      if (q.valor) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...C_GRAY);
        doc.text(`(${q.valor.toFixed(1)} pt${q.valor !== 1 ? "s" : ""})`, PW - MARGIN - 2, y - (enuncLines.length - 1) * 5 - 7 + 5, { align: "right" });
      }

      y += 2;

      const altKeys = ["a", "b", "c", "d", "e"] as const;
      for (let ai = 0; ai < altKeys.length; ai++) {
        const key = altKeys[ai];
        const altVal = q.alternativas[key];
        const lines = doc.splitTextToSize(altVal, CW - 22) as string[];
        const isCorrect = showGabarito && q.gabarito === key;

        checkSpace(lines.length * 4.5 + 2);

        const circleY = y + 0.5;
        doc.setDrawColor(...C_LINE);
        doc.setLineWidth(0.3);

        if (isCorrect) {
          doc.setFillColor(...C_GREEN);
          doc.circle(MARGIN + 8, circleY, 2.5, "F");
          doc.setTextColor(...C_WHITE);
        } else {
          doc.setFillColor(...C_WHITE);
          doc.circle(MARGIN + 8, circleY, 2.5, "FD");
          doc.setTextColor(...C_DARK);
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(altLabel(key), MARGIN + 8 - doc.getTextWidth(altLabel(key)) / 2, circleY + 1);

        doc.setFont("helvetica", isCorrect ? "bold" : "normal");
        doc.setFontSize(9);
        doc.setTextColor(isCorrect ? (C_GREEN as unknown as string) as unknown as number : C_DARK[0], isCorrect ? C_GREEN[1] : C_DARK[1], isCorrect ? C_GREEN[2] : C_DARK[2]);
        for (let li = 0; li < lines.length; li++) {
          checkSpace(4.5);
          doc.text(lines[li], MARGIN + 14, y + li * 4.5);
        }
        y += lines.length * 4.5 + 1.5;
      }

      doc.setDrawColor(...C_LINE);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + 1, PW - MARGIN, y + 1);
      y += 5;
    }
  }

  // ── Discursive Section ───────────────────────────────────────────────────────
  if (exam.questoesDiscursivas && exam.questoesDiscursivas.length > 0) {
    checkSpace(12);
    y += 2;
    doc.setFillColor(...C_BLUE);
    doc.rect(MARGIN, y, CW, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C_WHITE);
    const discLabel = exam.questoesDiscursivas.length === 1 ? "QUESTÃO DISCURSIVA" : `QUESTÕES DISCURSIVAS (${exam.questoesDiscursivas.length} questões)`;
    doc.text(discLabel, MARGIN + 4, y + 5.5);

    const totalDisc = exam.questoesDiscursivas.reduce((s, q) => s + (q.valor ?? 0), 0);
    if (totalDisc > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(`Total: ${totalDisc.toFixed(1)} pts`, PW - MARGIN - 2, y + 5.5, { align: "right" });
    }
    y += 11;

    for (const q of exam.questoesDiscursivas) {
      const enuncLines = doc.splitTextToSize(q.enunciado, CW - 10) as string[];
      checkSpace(enuncLines.length * 5 + 10);

      doc.setFillColor(...C_BG);
      doc.rect(MARGIN, y, CW, 7, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...C_BLUE);
      doc.text(`${q.numero}.`, MARGIN + 2, y + 5);

      if (q.valor) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(...C_GRAY);
        doc.text(`(${q.valor.toFixed(1)} pt${q.valor !== 1 ? "s" : ""})`, PW - MARGIN - 2, y + 5, { align: "right" });
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...C_DARK);
      doc.text(enuncLines[0], MARGIN + 7, y + 5);
      y += 7;

      for (let li = 1; li < enuncLines.length; li++) {
        checkSpace(5);
        doc.text(enuncLines[li], MARGIN + 7, y);
        y += 5;
      }

      if (showGabarito && q.criterios) {
        y += 2;
        const critLines = doc.splitTextToSize(`Critérios: ${q.criterios}`, CW - 8) as string[];
        checkSpace(critLines.length * 4.5 + 5);
        doc.setFillColor(220, 252, 231);
        doc.rect(MARGIN, y, CW, critLines.length * 4.5 + 4, "F");
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(...C_GREEN);
        let cy = y + 4;
        for (const line of critLines) {
          doc.text(line, MARGIN + 3, cy);
          cy += 4.5;
        }
        y += critLines.length * 4.5 + 6;
      } else {
        y += 3;
        const lines = q.linhasResposta ?? 6;
        for (let i = 0; i < lines; i++) {
          checkSpace(7);
          doc.setDrawColor(...C_LINE);
          doc.setLineWidth(0.25);
          doc.line(MARGIN, y + 6, PW - MARGIN, y + 6);
          y += 7;
        }
        y += 2;
      }

      doc.setDrawColor(...C_LINE);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + 1, PW - MARGIN, y + 1);
      y += 5;
    }
  }

  drawFooter();

  // ── Gabarito Page ────────────────────────────────────────────────────────────
  if (showGabarito && exam.questoesAlternativas && exam.questoesAlternativas.length > 0) {
    doc.addPage();
    pageNum++;

    doc.setFillColor(...C_BLUE);
    doc.rect(0, 0, PW, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...C_WHITE);
    doc.text("GABARITO — USO EXCLUSIVO DO PROFESSOR", MARGIN, 12);

    y = 24;

    const cols = 4;
    const cellW = CW / cols;
    const cellH = 9;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...C_GRAY);

    const altQs = exam.questoesAlternativas;
    for (let i = 0; i < altQs.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = MARGIN + col * cellW;
      const cy = y + row * cellH;

      if (cy + cellH > CONTENT_BOTTOM) {
        y = cy;
        newPage();
        y = MARGIN + 4;
      }

      const actualCy = y + row * cellH;
      doc.setFillColor(...C_BG);
      doc.rect(cx, actualCy, cellW - 1, cellH - 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...C_DARK);
      doc.text(`${altQs[i].numero}.`, cx + 3, actualCy + 6);
      doc.setFillColor(...C_GREEN);
      doc.circle(cx + cellW / 2 + 4, actualCy + 4.5, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...C_WHITE);
      doc.text(altLabel(altQs[i].gabarito), cx + cellW / 2 + 4 - doc.getTextWidth(altLabel(altQs[i].gabarito)) / 2, actualCy + 6);
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
