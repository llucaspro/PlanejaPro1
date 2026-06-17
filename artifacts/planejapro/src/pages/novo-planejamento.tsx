import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGeneratePlanning } from "@workspace/api-client-react";
import type { GeneratedPlanning } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";

const PERFIS_TURMA = [
  { id: "participativa", label: "Participativa" },
  { id: "agitada", label: "Agitada" },
  { id: "dificuldades-leitura", label: "Dificuldades de leitura" },
  { id: "heterogenea", label: "Heterogênea" },
  { id: "desmotivada", label: "Desmotivada" },
  { id: "outro", label: "Outro" },
];

const RECURSOS = [
  { id: "projetor", label: "Projetor / Datashow" },
  { id: "internet", label: "Internet" },
  { id: "laboratorio", label: "Laboratório" },
  { id: "celular", label: "Celulares dos alunos" },
  { id: "quadro", label: "Quadro negro / branco" },
  { id: "material-impresso", label: "Material impresso" },
];

const ANOS = [
  "1º Ano EF", "2º Ano EF", "3º Ano EF", "4º Ano EF", "5º Ano EF",
  "6º Ano EF", "7º Ano EF", "8º Ano EF", "9º Ano EF",
  "1º Ano EM", "2º Ano EM", "3º Ano EM",
];

const schema = z.object({
  disciplina: z.string().min(2, "Informe a disciplina"),
  anoSerie: z.string().min(1, "Selecione o ano/série"),
  turma: z.string().optional(),
  quantidadeAulas: z.coerce.number().min(1).max(50),
  duracaoAula: z.coerce.number().min(30).max(240),
  perfilTurma: z.array(z.string()).optional(),
  objetivos: z.string().optional(),
  conteudo: z.string().min(5, "Descreva o conteúdo a ser trabalhado"),
  recursosDisponiveis: z.array(z.string()).optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NovoPlanejamento() {
  const [, navigate] = useLocation();
  const { refreshUser } = useAuth();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      quantidadeAulas: 2,
      duracaoAula: 50,
      perfilTurma: [],
      recursosDisponiveis: ["quadro"],
    },
  });

  const perfilTurma = watch("perfilTurma") || [];
  const recursosDisponiveis = watch("recursosDisponiveis") || [];

  const { mutate: generatePlanning, isPending } = useGeneratePlanning({
    mutation: {
      onSuccess: (data: GeneratedPlanning) => {
        sessionStorage.setItem("planejapro_result", JSON.stringify(data));
        sessionStorage.setItem("planejapro_input", JSON.stringify(watch()));
        refreshUser();
        navigate("/resultado");
      },
      onError: (error: unknown) => {
        const apiError = error as { status?: number; data?: { code?: string; error?: string } };
        if (apiError?.status === 403) {
          if (apiError?.data?.code === "FREE_LIMIT_REACHED") {
            navigate("/upgrade");
            return;
          }
          toast.error("Acesso negado", { description: apiError?.data?.error || "Tente novamente." });
          return;
        }
        if (apiError?.status === 401) {
          toast.error("Sessão expirada", { description: "Faça login novamente." });
          return;
        }
        const msg = error instanceof Error ? error.message : "Tente novamente em instantes.";
        toast.error("Erro ao gerar planejamento", { description: msg });
      },
    },
  });

  const onSubmit = (data: FormData) => {
    generatePlanning({ data });
  };

  const toggleArray = (arr: string[], value: string, setter: (val: string[]) => void) => {
    setter(arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-serif text-foreground mb-2">Novo Planejamento</h1>
          <p className="text-muted-foreground">
            Preencha os dados abaixo e a IA irá gerar um planejamento pedagógico completo para você.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados da aula</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="disciplina">Disciplina *</Label>
                  <Input
                    id="disciplina"
                    placeholder="Ex: Matemática, Português..."
                    {...register("disciplina")}
                  />
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
                  <Label htmlFor="quantidadeAulas">Nº de aulas *</Label>
                  <Input id="quantidadeAulas" type="number" min={1} max={50} {...register("quantidadeAulas")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="duracaoAula">Duração (min) *</Label>
                  <Input id="duracaoAula" type="number" min={30} max={240} {...register("duracaoAula")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conteúdo e objetivos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="conteudo">Conteúdo a ser trabalhado *</Label>
                <Textarea
                  id="conteudo"
                  placeholder="Ex: Frações: conceito, tipos e operações básicas..."
                  rows={3}
                  {...register("conteudo")}
                />
                {errors.conteudo && <p className="text-xs text-destructive">{errors.conteudo.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="objetivos">Objetivos do professor (opcional)</Label>
                <Textarea
                  id="objetivos"
                  placeholder="O que você quer que os alunos aprendam ao final das aulas?"
                  rows={2}
                  {...register("objetivos")}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Perfil da turma</CardTitle>
              <CardDescription>Selecione as características que melhor descrevem sua turma</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {PERFIS_TURMA.map((perfil) => (
                  <div key={perfil.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`perfil-${perfil.id}`}
                      checked={perfilTurma.includes(perfil.id)}
                      onCheckedChange={() => toggleArray(perfilTurma, perfil.id, (v) => setValue("perfilTurma", v))}
                    />
                    <Label htmlFor={`perfil-${perfil.id}`} className="font-normal cursor-pointer">
                      {perfil.label}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recursos disponíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {RECURSOS.map((recurso) => (
                  <div key={recurso.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`recurso-${recurso.id}`}
                      checked={recursosDisponiveis.includes(recurso.id)}
                      onCheckedChange={() => toggleArray(recursosDisponiveis, recurso.id, (v) => setValue("recursosDisponiveis", v))}
                    />
                    <Label htmlFor={`recurso-${recurso.id}`} className="font-normal cursor-pointer">
                      {recurso.label}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Observações adicionais</CardTitle>
              <CardDescription>Qualquer informação que possa ajudar a personalizar o planejamento</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Ex: Semana de provas, aluno com TEA na turma, tema do projeto integrador..."
                rows={2}
                {...register("observacoes")}
              />
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full gap-2" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Gerando planejamento...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Gerar planejamento com IA
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
                A IA está criando seu planejamento completo. Isso pode levar até 60 segundos...
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
