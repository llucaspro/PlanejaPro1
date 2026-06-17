import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SYSTEM_PROMPT = `Você é um especialista em pedagogia e didática brasileira, com profundo conhecimento em:
- BNCC (Base Nacional Comum Curricular)
- Metodologias ativas (PBL, sala de aula invertida, aprendizagem por projetos)
- Educação inclusiva e adaptações curriculares
- Ensino Fundamental e Médio
- Avaliação formativa e somativa
- Elaboração de sequências didáticas

Gere planejamentos pedagógicos PRÁTICOS, DETALHADOS e APLICÁVEIS para professores brasileiros.
Responda SEMPRE em JSON válido, sem markdown, sem blocos de código, apenas JSON puro.`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body;
  if (!body?.disciplina || !body?.conteudo) {
    return res.status(400).json({ error: "Campos obrigatórios: disciplina, conteudo" });
  }

  const perfis = body.perfilTurma?.join(", ") || "não especificado";
  const recursos = body.recursosDisponiveis?.join(", ") || "quadro";

  const userPrompt = `Crie um planejamento pedagógico COMPLETO com:
- Disciplina: ${body.disciplina}
- Ano/Série: ${body.anoSerie}
- Turma: ${body.turma || "não especificada"}
- Quantidade de aulas: ${body.quantidadeAulas}
- Duração: ${body.duracaoAula} minutos
- Perfil da turma: ${perfis}
- Conteúdo: ${body.conteudo}
- Objetivos: ${body.objetivos || "desenvolver os conteúdos de forma eficaz"}
- Recursos: ${recursos}
- Observações: ${body.observacoes || "nenhuma"}

Retorne JSON com exatamente estas chaves (sem markdown, apenas JSON puro):
tema, objetivoGeral, objetivosEspecificos (array), competencias (array), habilidades (array), metodologia, sequenciaDidatica (array), atividadeInicial, desenvolvimento, atividadePratica, encerramento, avaliacao, criteriosAvaliativos (array), estrategiasInclusivas, adaptacoesDificuldades, recursosNecessarios (array), tarefaCasa, observacoesPedagogicas, versaoResumida, sugestoesExtras (array)`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + userPrompt }] },
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

    if (!content) return res.status(500).json({ error: "IA não retornou conteúdo" });

    const planning = JSON.parse(content);

    const arrayFields = [
      "objetivosEspecificos", "competencias", "habilidades",
      "sequenciaDidatica", "criteriosAvaliativos", "recursosNecessarios", "sugestoesExtras"
    ];
    const stringFields = [
      "tema", "objetivoGeral", "metodologia", "atividadeInicial",
      "desenvolvimento", "atividadePratica", "encerramento", "avaliacao",
      "estrategiasInclusivas", "adaptacoesDificuldades", "tarefaCasa",
      "observacoesPedagogicas", "versaoResumida"
    ];

    function anyToString(v: unknown): string {
      if (typeof v === "string") return v;
      if (v === null || v === undefined) return "";
      if (Array.isArray(v)) return v.map(anyToString).join(" | ");
      if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, val]) => `${k}: ${anyToString(val)}`).join(" | ");
      return String(v);
    }

    for (const field of arrayFields) {
      if (!Array.isArray(planning[field])) {
        planning[field] = planning[field] ? [anyToString(planning[field])] : [];
      } else {
        planning[field] = (planning[field] as unknown[]).map(anyToString);
      }
    }
    for (const field of stringFields) {
      if (typeof planning[field] !== "string") {
        planning[field] = planning[field] != null ? anyToString(planning[field]) : "Não gerado";
      }
    }

    return res.status(200).json(planning);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return res.status(500).json({ error: "Falha ao gerar planejamento: " + msg });
  }
}
