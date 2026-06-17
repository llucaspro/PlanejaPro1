import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Você é um especialista em pedagogia e didática brasileira, com profundo conhecimento em:
- BNCC (Base Nacional Comum Curricular)
- Metodologias ativas (PBL, sala de aula invertida, aprendizagem por projetos)
- Educação inclusiva e adaptações curriculares
- Ensino Fundamental e Médio
- Avaliação formativa e somativa
- Elaboração de sequências didáticas

Gere planejamentos pedagógicos PRÁTICOS, DETALHADOS e APLICÁVEIS para professores brasileiros.
Responda SEMPRE em JSON válido, sem markdown.`;

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

Retorne JSON com exatamente estas chaves:
tema, objetivoGeral, objetivosEspecificos (array), competencias (array), habilidades (array), metodologia, sequenciaDidatica (array), atividadeInicial, desenvolvimento, atividadePratica, encerramento, avaliacao, criteriosAvaliativos (array), estrategiasInclusivas, adaptacoesDificuldades, recursosNecessarios (array), tarefaCasa, observacoesPedagogicas, versaoResumida, sugestoesExtras (array)`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return res.status(500).json({ error: "IA não retornou conteúdo" });

    const planning = JSON.parse(content);
    return res.status(200).json(planning);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return res.status(500).json({ error: "Falha ao gerar planejamento: " + msg });
  }
}
