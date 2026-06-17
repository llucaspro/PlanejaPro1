import { motion } from "framer-motion";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";
import {
  Moon, Sun, Monitor, Trash2, Info, BookOpen, Github, Heart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { usePlannings } from "@/hooks/use-plannings";

const THEMES = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
];

export default function Configuracoes() {
  const { theme, setTheme } = useTheme();
  const { plannings, deletePlanning } = usePlannings();

  const handleClearAll = () => {
    const ids = plannings.map(p => p.id);
    ids.forEach(id => deletePlanning(id));
    toast.success(`${ids.length} planejamento${ids.length !== 1 ? "s" : ""} excluído${ids.length !== 1 ? "s" : ""}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-2xl mx-auto"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-serif text-foreground mb-2">Configurações</h1>
        <p className="text-muted-foreground">Preferências e informações sobre o PlanejaPro.</p>
      </div>

      {/* Aparência */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Aparência</CardTitle>
          <CardDescription>Escolha o tema da interface</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {THEMES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                    theme === t.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-sm font-medium">{t.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Dados */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Dados locais</CardTitle>
          <CardDescription>
            Seus planejamentos são armazenados apenas neste navegador, sem conta ou login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Planejamentos salvos</Label>
              <p className="text-sm text-muted-foreground">{plannings.length} planejamento{plannings.length !== 1 ? "s" : ""} no localStorage</p>
            </div>
            <Badge variant="secondary">{plannings.length}</Badge>
          </div>

          {plannings.length > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-destructive">Apagar tudo</Label>
                  <p className="text-sm text-muted-foreground">Remove todos os planejamentos salvos permanentemente</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="gap-1.5">
                      <Trash2 className="h-4 w-4" />
                      Apagar tudo
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Apagar todos os planejamentos?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso irá remover permanentemente todos os {plannings.length} planejamentos salvos.
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90"
                        onClick={handleClearAll}
                      >
                        Apagar tudo
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sobre */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex gap-2">
            <Info className="h-4 w-4" />
            Sobre o PlanejaPro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">PlanejaPro</p>
              <p className="text-sm text-muted-foreground">Versão 1.0.0</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Copiloto inteligente de planejamento pedagógico para professores brasileiros da Educação Básica.
            </p>
            <p>
              Sugestões geradas por IA (GPT-4o Mini / OpenAI). Todo conteúdo deve ser revisado pelo
              professor antes da utilização.
            </p>
            <p className="font-medium text-foreground">
              Este produto NÃO é afiliado ao Governo do Estado de São Paulo.
            </p>
          </div>

          <Separator />

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Heart className="h-3.5 w-3.5 text-red-500" />
            <span>Feito com carinho para professores que transformam vidas.</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
