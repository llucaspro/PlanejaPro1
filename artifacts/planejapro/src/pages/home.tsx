import { Link } from "wouter";
import { motion } from "framer-motion";
import { PlusCircle, FolderOpen, Upload, MessageSquare, BookOpen, Clock, Sparkles, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePlannings } from "@/hooks/use-plannings";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" },
  }),
};

const features = [
  {
    icon: Clock,
    title: "Planejamento em minutos",
    description: "Preencha os dados da aula e receba um planejamento completo em menos de 60 segundos.",
  },
  {
    icon: Sparkles,
    title: "Inteligência pedagógica",
    description: "Sugestões alinhadas à BNCC, metodologias ativas e estratégias inclusivas.",
  },
  {
    icon: Shield,
    title: "Você no controle",
    description: "Todo conteúdo gerado é uma sugestão. O professor revisa, adapta e decide.",
  },
  {
    icon: MessageSquare,
    title: "Assistente especialista",
    description: "Tire dúvidas pedagógicas, adapte atividades e explore novas metodologias.",
  },
];

export default function Home() {
  const { plannings } = usePlannings();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero */}
      <motion.div
        initial="hidden"
        animate="visible"
        className="text-center py-12 md:py-16"
      >
        <motion.div custom={0} variants={fadeUp} className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium">
            <BookOpen className="h-4 w-4" />
            Copiloto pedagógico para professores
          </div>
        </motion.div>

        <motion.h1
          custom={1}
          variants={fadeUp}
          className="text-4xl md:text-5xl font-bold font-serif text-foreground leading-tight mb-4"
        >
          Planeje suas aulas<br />em minutos.
        </motion.h1>

        <motion.p
          custom={2}
          variants={fadeUp}
          className="text-lg text-muted-foreground max-w-xl mx-auto mb-10"
        >
          Seu copiloto inteligente para o planejamento pedagógico.
          Menos burocracia, mais tempo para ensinar.
        </motion.p>

        <motion.div
          custom={3}
          variants={fadeUp}
          className="flex flex-col sm:flex-row gap-3 justify-center"
        >
          <Button asChild size="lg" className="gap-2 text-base px-8">
            <Link href="/novo">
              <PlusCircle className="h-5 w-5" />
              Criar planejamento
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2 text-base">
            <Link href="/importar">
              <Upload className="h-5 w-5" />
              Importar documento
            </Link>
          </Button>
          {plannings.length > 0 && (
            <Button asChild size="lg" variant="ghost" className="gap-2 text-base">
              <Link href="/salvos">
                <FolderOpen className="h-5 w-5" />
                Planejamentos salvos
                <Badge variant="secondary">{plannings.length}</Badge>
              </Link>
            </Button>
          )}
        </motion.div>
      </motion.div>

      {/* Aviso importante */}
      <motion.div
        custom={4}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-12 flex gap-3"
      >
        <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          <strong>Importante:</strong> Este copiloto gera sugestões pedagógicas. Todo conteúdo deve ser revisado
          pelo professor antes da utilização. O professor é sempre o responsável final pelo planejamento.
          Esta ferramenta não é afiliada ao Governo do Estado de São Paulo.
        </p>
      </motion.div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
        {features.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              custom={i + 5}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
            >
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Planejamentos recentes */}
      {plannings.length > 0 && (
        <motion.div
          custom={10}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mb-12"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold font-serif text-foreground">Planejamentos recentes</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/salvos">Ver todos</Link>
            </Button>
          </div>
          <div className="space-y-2">
            {plannings.slice(0, 3).map((p) => (
              <Card key={p.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-foreground">{p.titulo}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.disciplina} · {p.anoSerie} ·{" "}
                      {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/salvos?id=${p.id}`}>Abrir</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
