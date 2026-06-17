import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, FileQuestion, ChevronRight, ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useGenerateExam } from "@workspace/api-client-react";
import type { GeneratedExam, ExamInput } from "@workspace/api-client-react";

const ANOS = [
  "1º Ano EF", "2º Ano EF", "3º Ano EF", "4º Ano EF", "5º Ano EF",
  "6º Ano EF", "7º Ano EF", "8º Ano EF", "9º Ano EF",
  "1º Ano EM", "2º Ano EM", "3º Ano EM",
];

const BIMESTRES = [
  "1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre",
  "1º Trimestre", "2º Trimestre", "3º Trimestre",
  "Avaliação Final", "Recuperação",
];

const DIFICULDADES = [
  {
    value: "facil",
    label: "Fácil",
    emoji: "🟢",
    description: "Fixação, revisão e recuperação. Linguagem simples, questões diretas.",
    color: "border-green-400 bg-green-50 dark:bg-green-950/20 text-green-800 dark:text-green-300",
    selectedColor: "border-green-500 bg-green-100 dark:bg-green-900/40 ring-2 ring-green-400",
  },
  {
    value: "medio",
    label: "Médio",
    emoji: "🟡",
    description: "Padrão escolar tradicional. Exige compreensão e aplicação do conteúdo.",
    color: "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-300",
    selectedColor: "border-yellow-500 bg-yellow-100 dark:bg-yellow-900/40 ring-2 ring-yellow-400",
  },
  {
    value: "dificil",
    label: "Difícil",
    emoji: "🔴",
    description: "Padrão vestibular (ENEM, FUVEST, UNICAMP, VUNESP). Alta interpretação e raciocínio crítico.",
    color: "border-red-400 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300",
    selectedColor: "border-red-500 bg-red-100 dark:bg-red-900/40 ring-2 ring-red-400",
  },
];

const schema = z.object({
  nomeEscola: z.string().optional(),
  nomeProfessor: z.string().optional(),
  disciplina: z.string().min(2, "Informe a disciplina"),
  anoSerie: z.string().min(1, "Selecione o ano/série"),
  turma: z.string().optional(),
  bimestre: z.string().optional(),
  conteudo: z.string().min(5, "Descreva o conteúdo da prova"),
  dificuldade: z.enum(["facil", "medio", "dificil"]),
  questoesAlternativas: z.number().min(0).max(20),
  questoesDiscursivas: z.number().min(0).max(8),
  instrucoes: z.string().optional(),
  valorTotal: z.coerce.number().min(1).max(100).optional(),
}).refine(
  (d) => d.questoesAlternativas + d.questoesDiscursivas > 0,
  { message: "A prova deve ter ao menos uma questão", path: ["questoesAlternativas"] }
);

type FormData = z.infer<typeof schema>;

export default function CriarProva() {
  const [, navigate] = useLocation();

  const prefillStr = sessionStorage.getItem("planejapro_exam_prefill");
  const prefill = prefillStr ? JSON.parse(prefillStr) as { disciplina?: string; anoSerie?: string; turma?: string; conteudo?: string } : null;

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      disciplina: prefill?.disciplina ?? "",
      anoSerie: prefill?.anoSerie ?? "",
      turma: prefill?.turma ?? "",
      conteudo: prefill?.conteudo ?? "",
      dificuldade: "medio",
      questoesAlternativas: 10,
      questoesDiscursivas: 2,
      valorTotal: 10,
    },
  });

  const questoesAlternativas = watch("questoesAlternativas");
  const questoesDiscursivas = watch("questoesDiscursivas");
  const dificuldade = watch("dificuldade");

  const { mutate: generateExam, isPending } = useGenerateExam({
    mutation: {
      onSuccess: (data: GeneratedExam) => {
        const input: ExamInput = {
          nomeEscola: watch("nomeEscola"),
          nomeProfessor: watch("nomeProfessor"),
          disciplina: watch("disciplina"),
          anoSerie: watch("anoSerie"),
          turma: watch("turma"),
          bimestre: watch("bimestre"),
          conteudo: watch("conteudo"),
          questoesAlternativas: watch("questoesAlternativas"),
          questoesDiscursivas: watch("questoesDiscursivas"),
          instrucoes: watch("instrucoes"),
          valorTotal: watch("valorTotal"),
        };
        sessionStorage.setItem("planejapro_exam_result", JSON.stringify(data));
        sessionStorage.setItem("planejapro_exam_input", JSON.stringify(input));
        navigate("/prova-resultado");
      },
      onError: (error: unknown) => {
        const msg = error instanceof Error ? error.message : "Tente novamente em instantes.";
        toast.error("Erro ao gerar prova", { description: msg });
      },
    },
  });

  const onSubmit = (data: FormData) => {
    generateExam({ data: { ...data, dificuldade: data.dificuldade } });
  };

  const totalQuestoes = questoesAlternativas + questoesDiscursivas;

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Button variant="ghost" size="sm" className="mb-4 gap-1 -ml-2" onClick={() => navigate(-1 as never)}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileQuestion className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold font-serif text-foreground">Criar Prova</h1>
          </div>
          <p className="text-muted-foreground">
            Preencha os dados e a IA vai gerar uma prova completa pronta para imprimir em PDF.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identificação da escola</CardTitle>
              <CardDescription>Dados que aparecerão no cabeçalho da prova</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nomeEscola">Nome da escola</Label>
                  <Input id="nomeEscola" placeholder="Ex: E.E. Prof. João da Silva" {...register("nomeEscola")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nomeProfessor">Nome do professor</Label>
                  <Input id="nomeProfessor" placeholder="Seu nome completo" {...register("nomeProfessor")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados da prova *</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="disciplina">Disciplina *</Label>
                  <Input id="disciplina" placeholder="Ex: Matemática, Português..." {...register("disciplina")} />
                  {errors.disciplina && <p className="text-xs text-destructive">{errors.disciplina.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Ano/Série *</Label>
                  <Select onValueChange={(v) => setValue("anoSerie", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ANOS.map((ano) => (
                        <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.anoSerie && <p className="text-xs text-destructive">{errors.anoSerie.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="turma">Turma</Label>
                  <Input id="turma" placeholder="Ex: 7A, Turma 3..." {...register("turma")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Bimestre / Período</Label>
                  <Select onValueChange={(v) => setValue("bimestre", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {BIMESTRES.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="valorTotal">Valor total (pts)</Label>
                  <Input id="valorTotal" type="number" min={1} max={100} defaultValue={10} {...register("valorTotal")} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="conteudo">Conteúdo cobrado na prova *</Label>
                <Textarea
                  id="conteudo"
                  placeholder="Ex: Frações: conceito, operações de adição e subtração, comparação de frações..."
                  rows={3}
                  {...register("conteudo")}
                />
                {errors.conteudo && <p className="text-xs text-destructive">{errors.conteudo.message}</p>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nível de Dificuldade *</CardTitle>
              <CardDescription>Selecione o nível de dificuldade das questões</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {DIFICULDADES.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setValue("dificuldade", d.value as "facil" | "medio" | "dificil")}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                      dificuldade === d.value ? d.selectedColor : `${d.color} hover:opacity-80`
                    }`}
                  >
                    <div className="text-2xl mb-1">{d.emoji}</div>
                    <div className="font-semibold text-sm mb-1">{d.label}</div>
                    <div className="text-xs opacity-80 leading-snug">{d.description}</div>
                  </button>
                ))}
              </div>
              {errors.dificuldade && <p className="text-xs text-destructive mt-2">{errors.dificuldade.message}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estrutura da prova</CardTitle>
              <CardDescription>Defina quantas questões de cada tipo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Questões de múltipla escolha (A/B/C/D/E)</Label>
                  <span className="text-2xl font-bold text-primary w-10 text-center">{questoesAlternativas}</span>
                </div>
                <Slider
                  min={0}
                  max={20}
                  step={1}
                  value={[questoesAlternativas]}
                  onValueChange={([v]) => setValue("questoesAlternativas", v)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>Máx. 20 questões</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Questões discursivas</Label>
                  <span className="text-2xl font-bold text-primary w-10 text-center">{questoesDiscursivas}</span>
                </div>
                <Slider
                  min={0}
                  max={8}
                  step={1}
                  value={[questoesDiscursivas]}
                  onValueChange={([v]) => setValue("questoesDiscursivas", v)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>Máx. 8 questões</span>
                </div>
              </div>

              {totalQuestoes > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary flex-shrink-0" />
                  <p className="text-sm text-foreground">
                    Total: <strong>{totalQuestoes} questão{totalQuestoes !== 1 ? "ões" : ""}</strong>
                    {questoesAlternativas > 0 && ` · ${questoesAlternativas} alternativa${questoesAlternativas !== 1 ? "s" : ""}`}
                    {questoesDiscursivas > 0 && ` · ${questoesDiscursivas} discursiva${questoesDiscursivas !== 1 ? "s" : ""}`}
                    {dificuldade && ` · ${dificuldade === "facil" ? "🟢 Fácil" : dificuldade === "medio" ? "🟡 Médio" : "🔴 Difícil"}`}
                  </p>
                </div>
              )}

              {errors.questoesAlternativas && (
                <p className="text-xs text-destructive">{errors.questoesAlternativas.message}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Instruções para os alunos</CardTitle>
              <CardDescription>Opcional — o que aparecerá no início da prova</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Ex: Leia atentamente cada questão. Use caneta azul ou preta. É proibido o uso de calculadora..."
                rows={2}
                {...register("instrucoes")}
              />
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full gap-2" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Gerando prova com IA...
              </>
            ) : (
              <>
                <FileQuestion className="h-5 w-5" />
                Gerar prova com IA
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>

          {isPending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center space-y-2"
            >
              <p className="text-sm text-muted-foreground">
                A IA está elaborando as questões da prova. Isso pode levar até 60 segundos...
              </p>
              <p className="text-xs text-muted-foreground/70">
                Por favor, aguarde e não feche ou atualize a página.
              </p>
            </motion.div>
          )}
        </form>
      </motion.div>
    </div>
  );
}
