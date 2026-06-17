import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Search, FolderOpen, Trash2, Copy, Pencil,
  Eye, Filter, Calendar, BookOpen, PlusCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePlannings, type SavedPlanning } from "@/hooks/use-plannings";
import { Link } from "wouter";

export default function Salvos() {
  const [, navigate] = useLocation();
  const { plannings, deletePlanning, duplicatePlanning } = usePlannings();
  const [search, setSearch] = useState("");
  const [filterDisciplina, setFilterDisciplina] = useState("todas");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const disciplinas = Array.from(new Set(plannings.map(p => p.disciplina))).sort();

  const filtered = plannings.filter(p => {
    const matchSearch =
      search === "" ||
      p.titulo.toLowerCase().includes(search.toLowerCase()) ||
      p.disciplina.toLowerCase().includes(search.toLowerCase()) ||
      p.anoSerie.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filterDisciplina === "todas" || p.disciplina === filterDisciplina;
    return matchSearch && matchFilter;
  });

  const handleView = (p: SavedPlanning) => {
    sessionStorage.setItem("planejapro_result", JSON.stringify(p.planning));
    sessionStorage.setItem("planejapro_input", JSON.stringify(p.input));
    navigate("/resultado");
  };

  const handleDelete = (id: string) => {
    deletePlanning(id);
    toast.success("Planejamento excluído");
  };

  const handleDuplicate = (id: string) => {
    duplicatePlanning(id);
    toast.success("Planejamento duplicado!");
  };

  if (plannings.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto text-center py-24"
      >
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold font-serif text-foreground mb-2">
          Nenhum planejamento salvo
        </h2>
        <p className="text-muted-foreground mb-6">
          Crie seu primeiro planejamento e salve-o para acessar sempre que precisar.
        </p>
        <Button asChild className="gap-2">
          <Link href="/novo">
            <PlusCircle className="h-4 w-4" />
            Criar planejamento
          </Link>
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl mx-auto"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-serif text-foreground mb-1">Meus Planejamentos</h1>
        <p className="text-muted-foreground">
          {plannings.length} planejamento{plannings.length !== 1 ? "s" : ""} salvos
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, disciplina ou série..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {disciplinas.length > 1 && (
          <Select value={filterDisciplina} onValueChange={setFilterDisciplina}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as disciplinas</SelectItem>
              {disciplinas.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Lista */}
      <AnimatePresence>
        {filtered.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center text-muted-foreground py-12"
          >
            Nenhum resultado para "{search}"
          </motion.p>
        ) : (
          <div className="space-y-3">
            {filtered.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card
                  className={`transition-shadow hover:shadow-md ${selectedId === p.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate mb-1">{p.titulo}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5" />
                            <span>{p.disciplina}</span>
                          </div>
                          <span>·</span>
                          <span>{p.anoSerie}</span>
                          <span>·</span>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{new Date(p.createdAt).toLocaleDateString("pt-BR")}</span>
                          </div>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2">
                        {p.input.quantidadeAulas && (
                          <Badge variant="secondary" className="text-xs">
                            {p.input.quantidadeAulas} aula{p.input.quantidadeAulas !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleView(p)}
                          title="Visualizar"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDuplicate(p.id)}
                          title="Duplicar"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir planejamento?</AlertDialogTitle>
                              <AlertDialogDescription>
                                "{p.titulo}" será excluído permanentemente. Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive hover:bg-destructive/90"
                                onClick={() => handleDelete(p.id)}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {plannings.length > 0 && (
        <div className="mt-8 text-center">
          <Button asChild className="gap-2">
            <Link href="/novo">
              <PlusCircle className="h-4 w-4" />
              Novo planejamento
            </Link>
          </Button>
        </div>
      )}
    </motion.div>
  );
}
