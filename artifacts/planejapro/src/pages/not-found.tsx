import { Link } from "wouter";
import { motion } from "framer-motion";
import { BookOpen, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4"
    >
      <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
        <BookOpen className="h-10 w-10 text-primary" />
      </div>

      <h1 className="text-7xl font-bold font-serif text-primary mb-2">404</h1>
      <h2 className="text-2xl font-semibold text-foreground mb-3">
        Pagina nao encontrada
      </h2>
      <p className="text-muted-foreground max-w-sm mb-8">
        Esta pagina saiu de ferias. Nao se preocupe — ainda ha muito para planejar!
      </p>

      <Button asChild className="gap-2">
        <Link href="/">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao inicio
        </Link>
      </Button>
    </motion.div>
  );
}
