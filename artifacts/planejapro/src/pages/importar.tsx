import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Upload, FileText, X, Loader2, CheckCircle,
  ArrowRight, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { parseFile } from "@/lib/file-parser";

const ACCEPTED = ".txt,.pdf,.doc,.docx";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

type StepStatus = "idle" | "loading" | "done" | "error";

interface ParsedResult {
  text: string;
  pageCount?: number;
  wordCount: number;
}

export default function Importar() {
  const [, navigate] = useLocation();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<StepStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ParsedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (f: File) => {
    if (f.size > MAX_SIZE) {
      toast.error("Arquivo muito grande", { description: "Máximo 10MB permitido." });
      return;
    }

    setFile(f);
    setStep("loading");
    setError(null);
    setProgress(10);

    try {
      setProgress(30);
      const parsed = await parseFile(f);
      setProgress(90);

      const wordCount = parsed.text.trim().split(/\s+/).filter(Boolean).length;
      setResult({ text: parsed.text, pageCount: parsed.pageCount, wordCount });
      setStep("done");
      setProgress(100);
      toast.success("Arquivo processado com sucesso!", {
        description: `${wordCount} palavras extraídas.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao processar arquivo";
      setError(msg);
      setStep("error");
      toast.error("Erro ao processar arquivo", { description: msg });
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, [processFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleReset = () => {
    setFile(null);
    setStep("idle");
    setProgress(0);
    setResult(null);
    setError(null);
  };

  const handleUseAsPlanning = () => {
    if (!result) return;
    // Store extracted text as context for the planning form
    sessionStorage.setItem("planejapro_import_text", result.text.slice(0, 3000));
    navigate("/novo");
    toast.success("Conteúdo importado!", {
      description: "Use o texto extraído como base para o seu planejamento.",
    });
  };

  const ext = file?.name.split(".").pop()?.toLowerCase();
  const isSupported = ["txt", "pdf", "docx", "doc"].includes(ext ?? "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-serif text-foreground mb-2">Importar Documento</h1>
        <p className="text-muted-foreground">
          Extraia o conteúdo de documentos existentes para usar como base no seu planejamento.
        </p>
      </div>

      {/* Drop Zone */}
      {step === "idle" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-14 text-center transition-all cursor-pointer ${
            dragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          }`}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <Upload className={`h-12 w-12 mx-auto mb-4 transition-colors ${dragging ? "text-primary" : "text-muted-foreground"}`} />
          <p className="text-lg font-medium text-foreground mb-1">
            Arraste o arquivo aqui ou clique para selecionar
          </p>
          <p className="text-sm text-muted-foreground mb-5">PDF, DOCX e TXT — ate 10MB</p>
          <div className="flex justify-center gap-2 flex-wrap">
            {["PDF", "DOCX", "DOC", "TXT"].map(e => (
              <Badge key={e} variant="secondary">{e}</Badge>
            ))}
          </div>
          <input
            id="file-input"
            type="file"
            accept={ACCEPTED}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {/* Loading state */}
      {step === "loading" && file && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
            <Progress value={progress} className="h-2 mb-2" />
            <p className="text-sm text-muted-foreground text-center">
              {progress < 50 ? "Lendo arquivo..." : "Extraindo texto..."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {step === "error" && (
        <div className="space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <ArrowRight className="h-4 w-4 rotate-180" />
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Success state */}
      {step === "done" && result && file && (
        <div className="space-y-4">
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{file.name}</CardTitle>
                    <CardDescription className="mt-0.5">
                      {result.wordCount.toLocaleString("pt-BR")} palavras extraídas
                      {result.pageCount ? ` · ${result.pageCount} páginas` : ""}
                      {" · "}
                      {ext?.toUpperCase()}
                    </CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleReset}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Separator className="mb-4" />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Preview do conteúdo
              </p>
              <div className="bg-muted rounded-lg p-3 text-sm text-foreground whitespace-pre-wrap font-mono max-h-48 overflow-y-auto leading-relaxed">
                {result.text.slice(0, 800)}
                {result.text.length > 800 && (
                  <span className="text-muted-foreground"> ... ({result.wordCount - result.text.slice(0, 800).split(/\s+/).length} palavras adicionais)</span>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              Importar outro arquivo
            </Button>
            <Button onClick={handleUseAsPlanning} className="flex-1 gap-2">
              Usar para criar planejamento
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              O texto extraído estará disponível como referência ao criar um novo planejamento.
              A IA irá estruturá-lo pedagogicamente com base nas informações que você fornecer.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Formats info */}
      {step === "idle" && (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { ext: "PDF", desc: "Planos de aula, apostilas, documentos digitalizados (texto selecionável)", ready: true },
            { ext: "DOCX / DOC", desc: "Documentos Word com formatação preservada", ready: true },
            { ext: "TXT", desc: "Texto simples, ideal para rascunhos e anotações", ready: true },
          ].map(fmt => (
            <Card key={fmt.ext}>
              <CardContent className="p-4 text-center">
                <Badge className="mb-2" variant="default">{fmt.ext}</Badge>
                <p className="text-xs text-muted-foreground">{fmt.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
