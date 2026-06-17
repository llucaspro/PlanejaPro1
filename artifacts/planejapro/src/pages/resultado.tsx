import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Download, Save, Copy, ArrowLeft, Shield, CheckCircle,
  FileText, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { usePlannings } from "@/hooks/use-plannings";
import type { GeneratedPlanning, PlanningInput } from "@workspace/api-client-react";

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

function toDisplayString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(toDisplayString).join("\n");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${toDisplayString(v)}`)
      .join(" | ");
  }
  return String(value);
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(toDisplayString);
  if (typeof value === "string") return value.split("\n").filter(Boolean);
  return [toDisplayString(value)].filter(Boolean);
}

function StringList({ items }: { items: unknown[] }) {
  const strs = toStringArray(items);
  return (
    <ul className="space-y-1.5">
      {strs.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-foreground">
          <span className="text-primary mt-0.5">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function TextBlock({ text }: { text: unknown }) {
  return <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{toDisplayString(text)}</p>;
}

export default function Resultado() {
  const [, navigate] = useLocation();
  const [planning, setPlanning] = useState<GeneratedPlanning | null>(null);
  const [input, setInput] = useState<PlanningInput | null>(null);
  const [saved, setSaved] = useState(false);
  const { savePlanning } = usePlannings();

  useEffect(() => {
    const resultStr = sessionStorage.getItem("planejapro_result");
    const inputStr = sessionStorage.getItem("planejapro_input");
    if (!resultStr) {
      navigate("/novo");
      return;
    }
    try {
      setPlanning(JSON.parse(resultStr));
      if (inputStr) setInput(JSON.parse(inputStr));
    } catch {
      navigate("/novo");
    }
  }, [navigate]);

  const handleSave = () => {
    if (!planning || !input) return;
    const titulo = planning.tema || `${input.disciplina} - ${input.anoSerie}`;
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
    const lines: string[] = [
      "PLANEJAMENTO PEDAGÓGICO — PlanejaPro",
      "=".repeat(50),
      "",
      `TEMA: ${toDisplayString(planning.tema)}`,
      "",
      "OBJETIVO GERAL",
      toDisplayString(planning.objetivoGeral),
      "",
      "OBJETIVOS ESPECÍFICOS",
      ...toStringArray(planning.objetivosEspecificos).map(o => `• ${o}`),
      "",
      "COMPETÊNCIAS",
      ...toStringArray(planning.competencias).map(c => `• ${c}`),
      "",
      "HABILIDADES",
      ...toStringArray(planning.habilidades).map(h => `• ${h}`),
      "",
      "METODOLOGIA",
      toDisplayString(planning.metodologia),
      "",
      "SEQUÊNCIA DIDÁTICA",
      ...toStringArray(planning.sequenciaDidatica).map((s, i) => `${i + 1}. ${s}`),
      "",
      "ATIVIDADE INICIAL",
      toDisplayString(planning.atividadeInicial),
      "",
      "DESENVOLVIMENTO",
      toDisplayString(planning.desenvolvimento),
      "",
      "ATIVIDADE PRÁTICA",
      toDisplayString(planning.atividadePratica),
      "",
      "ENCERRAMENTO",
      toDisplayString(planning.encerramento),
      "",
      "AVALIAÇÃO",
      toDisplayString(planning.avaliacao),
      "",
      "CRITÉRIOS AVALIATIVOS",
      ...toStringArray(planning.criteriosAvaliativos).map(c => `• ${c}`),
      "",
      "ESTRATÉGIAS INCLUSIVAS",
      toDisplayString(planning.estrategiasInclusivas),
      "",
      "ADAPTAÇÕES PARA DIFICULDADES",
      toDisplayString(planning.adaptacoesDificuldades),
      "",
      "RECURSOS NECESSÁRIOS",
      ...toStringArray(planning.recursosNecessarios).map(r => `• ${r}`),
      "",
      "TAREFA DE CASA",
      toDisplayString(planning.tarefaCasa),
      "",
      "OBSERVAÇÕES PEDAGÓGICAS",
      toDisplayString(planning.observacoesPedagogicas),
      "",
      "VERSÃO RESUMIDA",
      toDisplayString(planning.versaoResumida),
      "",
      "SUGESTÕES EXTRAS",
      ...toStringArray(planning.sugestoesExtras).map(s => `• ${s}`),
      "",
      "-".repeat(50),
      "Gerado por PlanejaPro — Revise e adapte conforme sua realidade.",
      `Data: ${new Date().toLocaleDateString("pt-BR")}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planejamento-${planning.tema?.slice(0, 30).replace(/\s+/g, "-") || "aula"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Arquivo TXT baixado!");
  };

  const handleCopyResumo = () => {
    if (!planning) return;
    navigator.clipboard.writeText(toDisplayString(planning.versaoResumida));
    toast.success("Resumo copiado para a área de transferência!");
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
              {toDisplayString(planning.tema)}
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
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleCopyResumo}
            >
              <Copy className="h-4 w-4" />
              Copiar resumo
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleExportTxt}
            >
              <Download className="h-4 w-4" />
              Exportar TXT
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleSave}
              disabled={saved}
            >
              {saved ? (
                <><CheckCircle className="h-4 w-4" /> Salvo</>
              ) : (
                <><Save className="h-4 w-4" /> Salvar</>
              )}
            </Button>
          </div>
        </div>
      </div>

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
          <p className="text-sm text-foreground leading-relaxed">{toDisplayString(planning.versaoResumida)}</p>
        </CardContent>
      </Card>

      {/* Seções do planejamento */}
      <div className="space-y-3">
        <Section title="Objetivos">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Objetivo geral</p>
              <TextBlock text={planning.objetivoGeral} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Objetivos específicos</p>
              <StringList items={planning.objetivosEspecificos} />
            </div>
          </div>
        </Section>

        <Section title="Competências e Habilidades (BNCC)">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Competências</p>
              <StringList items={planning.competencias} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Habilidades</p>
              <StringList items={planning.habilidades} />
            </div>
          </div>
        </Section>

        <Section title="Metodologia">
          <TextBlock text={planning.metodologia} />
        </Section>

        <Section title="Sequência Didática">
          <div className="space-y-2">
            {toStringArray(planning.sequenciaDidatica).map((step, i) => (
              <div key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full text-xs font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm text-foreground leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Desenvolvimento das Aulas">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Atividade inicial</p>
              <TextBlock text={planning.atividadeInicial} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Desenvolvimento principal</p>
              <TextBlock text={planning.desenvolvimento} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Atividade prática</p>
              <TextBlock text={planning.atividadePratica} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Encerramento</p>
              <TextBlock text={planning.encerramento} />
            </div>
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
              <StringList items={planning.criteriosAvaliativos} />
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
              <StringList items={planning.recursosNecessarios} />
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
              <StringList items={planning.sugestoesExtras} />
            </div>
          </div>
        </Section>
      </div>

      {/* Footer actions */}
      <div className="mt-8 flex flex-col sm:flex-row gap-3 pb-8">
        <Button variant="outline" onClick={handleExportTxt} className="gap-2 flex-1">
          <Download className="h-4 w-4" />
          Exportar TXT
        </Button>
        <Button
          variant="outline"
          className="gap-2 flex-1"
          onClick={() => toast.info("PDF em breve", { description: "Exportação em PDF será disponibilizada em breve." })}
        >
          <FileText className="h-4 w-4" />
          Exportar PDF (em breve)
        </Button>
        <Button onClick={handleSave} disabled={saved} className="gap-2 flex-1">
          {saved ? <><CheckCircle className="h-4 w-4" /> Salvo</> : <><Save className="h-4 w-4" /> Salvar planejamento</>}
        </Button>
      </div>
    </motion.div>
  );
}
