import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { GeneratePlanningBody } from "@workspace/api-zod";
import type { z } from "zod";

const router = Router();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SYSTEM_PROMPT = `Você é um especialista em pedagogia e didática brasileira, com profundo conhecimento em:
- BNCC (Base Nacional Comum Curricular)
- Metodologias ativas (PBL, sala de aula invertida, aprendizagem por projetos)
- Educação inclusiva e adaptações curriculares
- Ensino Fundamental e Médio
- Avaliação formativa e somativa
- Elaboração de sequências didáticas

Sua missão é criar planejamentos pedagógicos PRÁTICOS, DETALHADOS e APLICÁVEIS para professores brasileiros.

IMPORTANTE:
- Gere conteúdo prático, não genérico
- Use linguagem clara e acessível
- Evite alucinações: se não souber algo específico, use boas práticas gerais
- Sempre forneça exemplos concretos nas atividades
- Respeite a realidade das escolas públicas brasileiras
- O professor deve revisar e adaptar o planejamento à sua realidade

Responda SEMPRE em JSON válido, sem markdown, sem blocos de código, apenas JSON puro.`;

function buildPlanningPrompt(input: z.infer<typeof GeneratePlanningBody>): string {
  const perfis = input.perfilTurma?.join(", ") || "não especificado";
  const recursos = input.recursosDisponiveis?.join(", ") || "quadro, giz/caneta";

  return `Crie um planejamento pedagógico COMPLETO e DETALHADO com as seguintes informações:

DADOS DA AULA:
- Disciplina: ${input.disciplina}
- Ano/Série: ${input.anoSerie}
- Turma: ${input.turma || "não especificada"}
- Quantidade de aulas: ${input.quantidadeAulas}
- Duração de cada aula: ${input.duracaoAula} minutos
- Perfil da turma: ${perfis}
- Conteúdo: ${input.conteudo}
- Objetivos do professor: ${input.objetivos || "desenvolver os conteúdos de forma eficaz"}
- Recursos disponíveis: ${recursos}
- Observações: ${input.observacoes || "nenhuma"}

Retorne um JSON com EXATAMENTE esta estrutura (sem markdown, apenas JSON puro):
{
  "tema": "título temático e atrativo para o planejamento",
  "objetivoGeral": "objetivo geral da sequência de aulas",
  "objetivosEspecificos": ["objetivo 1", "objetivo 2", "objetivo 3"],
  "competencias": ["competência BNCC 1", "competência BNCC 2"],
  "habilidades": ["habilidade BNCC com código ex: EF06MA01", "habilidade 2"],
  "metodologia": "descrição detalhada da metodologia principal a ser utilizada",
  "sequenciaDidatica": ["Aula 1: descrição detalhada", "Aula 2: descrição detalhada"],
  "atividadeInicial": "descrição detalhada da atividade de abertura/engajamento (15-20 min)",
  "desenvolvimento": "descrição detalhada do desenvolvimento principal das aulas",
  "atividadePratica": "descrição de atividade prática, investigativa ou de aplicação",
  "encerramento": "descrição da atividade de síntese e encerramento",
  "avaliacao": "estratégia de avaliação detalhada",
  "criteriosAvaliativos": ["critério 1", "critério 2", "critério 3"],
  "estrategiasInclusivas": "estratégias para garantir participação de todos os alunos",
  "adaptacoesDificuldades": "adaptações específicas para alunos com dificuldades de aprendizagem",
  "recursosNecessarios": ["recurso 1", "recurso 2"],
  "tarefaCasa": "descrição da tarefa de casa (se aplicável) ou 'Sem tarefa de casa nesta sequência'",
  "observacoesPedagogicas": "dicas e observações importantes para o professor",
  "versaoResumida": "resumo executivo do planejamento em 3-4 frases",
  "sugestoesExtras": ["sugestão de ampliação 1", "sugestão 2", "sugestão 3"]
}`;
}

router.post("/planning/generate", async (req, res) => {
  const parsed = GeneratePlanningBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos: " + parsed.error.message });
    return;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT + "\n\n" + buildPlanningPrompt(parsed.data) }],
        },
      ],
      config: {
        maxOutputTokens: 8192,
        temperature: 0.7,
      },
    });

    let content = response.text ?? "";
    content = content.trim();

    // Remove markdown code fences if present
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    if (!content) {
      res.status(500).json({ error: "A IA não retornou conteúdo" });
      return;
    }

    const planning = JSON.parse(content);

    const required = [
      "tema", "objetivoGeral", "objetivosEspecificos", "competencias",
      "habilidades", "metodologia", "sequenciaDidatica", "atividadeInicial",
      "desenvolvimento", "atividadePratica", "encerramento", "avaliacao",
      "criteriosAvaliativos", "estrategiasInclusivas", "adaptacoesDificuldades",
      "recursosNecessarios", "tarefaCasa", "observacoesPedagogicas",
      "versaoResumida", "sugestoesExtras"
    ];

    for (const field of required) {
      if (!(field in planning)) {
        planning[field] = Array.isArray(planning[field]) ? [] : "Não gerado";
      }
    }

    res.json(planning);
  } catch (err: unknown) {
    req.log.error({ err }, "Erro ao gerar planejamento");
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    res.status(500).json({ error: "Falha ao gerar planejamento: " + message });
  }
});

export default router;
