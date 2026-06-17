import type { VercelRequest, VercelResponse } from "@vercel/node";
import { eq } from "drizzle-orm";
import { getDb, usersTable, aiUsageTable } from "../_lib/db";
import { verifyToken, extractBearerToken } from "../_lib/auth";
import { generateWithFallback, isOverloadedError2 } from "../_lib/gemini";

const MAX_FIELD = 800;

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function parseJson(raw: string): Record<string, unknown> | null {
  raw = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1) raw = raw.slice(start, end + 1);
  raw = raw.replace(/,\s*([}\]])/g, "$1");
  try { return JSON.parse(raw); } catch { return null; }
}

function s(v: unknown, max = MAX_FIELD): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

async function handleActivities(body: Record<string, unknown>): Promise<{ prompt: string; requestType: string; config: object }> {
  if (!body?.disciplina || !body?.anoSerie || !body?.tema)
    throw new Error("Campos obrigatórios: disciplina, anoSerie, tema");

  const quantidade = Math.min(Math.max(Number(body.quantidade ?? 5), 1), 20);
  const dificuldade = ["facil", "medio", "dificil"].includes(s(body.dificuldade)) ? s(body.dificuldade) : "medio";
  const tipo = ["exercicios", "revisao", "recuperacao", "tarefa", "grupo"].includes(s(body.tipo)) ? s(body.tipo) : "exercicios";

  const tipoMap: Record<string, string> = {
    exercicios: "exercícios de fixação",
    revisao: "atividades de revisão",
    recuperacao: "atividades de recuperação para alunos com dificuldade",
    tarefa: "tarefas de casa",
    grupo: "atividades em grupo colaborativas",
  };
  const dificuldadeMap: Record<string, string> = {
    facil: "Fácil — linguagem simples, baixo nível de abstração, questões diretas.",
    medio: "Médio — exige compreensão do conteúdo, aplicação básica do conhecimento.",
    dificil: "Difícil — padrão vestibular (ETEC, ENEM, FUVEST, UNESP, UNICAMP). Alta interpretação, raciocínio crítico.",
  };

  const prompt = `Você é um professor especialista em pedagogia brasileira. Crie ${quantidade} ${tipoMap[tipo]} para:
- Disciplina: ${s(body.disciplina, 100)}
- Ano/Série: ${s(body.anoSerie, 50)}
- Tema: ${s(body.tema, 400)}
- Tipo: ${tipoMap[tipo]}
- Dificuldade: ${dificuldadeMap[dificuldade]}

Retorne APENAS JSON válido (sem markdown):
{
  "titulo": "Título do conjunto de atividades",
  "descricao": "Breve descrição pedagógica",
  "atividades": [
    {
      "numero": 1,
      "titulo": "Título da atividade",
      "tipo": "exercicio|grupo|projeto|reflexao",
      "enunciado": "Descrição completa",
      "instrucoes": "Passo a passo",
      "materiais": ["material 1"],
      "tempoEstimado": "20 minutos",
      "objetivoPedagogico": "O que o aluno vai aprender"
    }
  ]
}`;
  return { prompt, requestType: "activities_generate", config: { maxOutputTokens: 8192, temperature: 0.7 } };
}

async function handleAdapt(body: Record<string, unknown>): Promise<{ prompt: string; requestType: string; config: object }> {
  if (!body?.conteudo || !body?.tipo)
    throw new Error("Campos obrigatórios: conteudo, tipo");

  const tipoMap: Record<string, string> = {
    simplificar: "Reescreva com linguagem mais simples, acessível e direta. Use vocabulário básico, frases curtas e exemplos do cotidiano.",
    serie_inferior: "Adapte para uma série escolar menor. Simplifique conceitos, use exemplos mais concretos.",
    serie_superior: "Adapte para uma série escolar maior. Aprofunde os conceitos, utilize linguagem mais técnica.",
    resumo: "Crie um resumo didático e completo. Organize em tópicos principais.",
    revisao_rapida: "Transforme em um guia de revisão rápida. Organize em checklist ou tópicos numerados.",
  };

  const tipoKey = s(body.tipo, 30);

  const prompt = `Você é um especialista em pedagogia brasileira e adaptação de conteúdo educacional.

Tarefa: ${tipoMap[tipoKey] || tipoMap["simplificar"]}

Conteúdo original:
---
${s(body.conteudo, 2000)}
---
${body.serieAlvo ? `\nSérie alvo: ${s(body.serieAlvo, 50)}` : ""}

Retorne APENAS JSON válido (sem markdown):
{
  "titulo": "Título do conteúdo adaptado",
  "tipo": "${tipoKey}",
  "conteudoAdaptado": "Texto completo adaptado",
  "observacoesPedagogicas": "Dicas para o professor",
  "diferencas": ["Diferença 1", "Diferença 2"]
}`;
  return { prompt, requestType: "adapt_generate", config: { maxOutputTokens: 8192, temperature: 0.6 } };
}

async function handleSequences(body: Record<string, unknown>): Promise<{ prompt: string; requestType: string; config: object }> {
  if (!body?.disciplina || !body?.anoSerie || !body?.tema)
    throw new Error("Campos obrigatórios: disciplina, anoSerie, tema");

  const numAulas = Math.min(Math.max(Number(body.numAulas ?? 4), 1), 12);
  const duracaoAula = Math.min(Math.max(Number(body.duracaoAula ?? 50), 20), 180);

  const prompt = `Você é um especialista em pedagogia brasileira e BNCC. Crie uma sequência didática para:
- Disciplina: ${s(body.disciplina, 100)}
- Ano/Série: ${s(body.anoSerie, 50)}
- Tema: ${s(body.tema, 400)}
- Número de aulas: ${numAulas}
- Duração de cada aula: ${duracaoAula} minutos
- Objetivos: ${s(body.objetivos, 400) || "Desenvolver os conteúdos de forma significativa"}

Retorne APENAS JSON válido (sem markdown):
{
  "titulo": "Título da sequência didática",
  "objetivoGeral": "Objetivo geral",
  "competencias": ["Competência 1 da BNCC"],
  "habilidades": ["Habilidade 1"],
  "recursosGerais": ["Recurso 1"],
  "aulas": [
    {
      "numero": 1,
      "titulo": "Título da Aula 1",
      "objetivo": "Objetivo específico",
      "conteudos": ["Conteúdo 1"],
      "metodologia": "Metodologia usada",
      "desenvolvimento": "Passo a passo detalhado",
      "atividadeInicial": "Atividade de abertura (10 min)",
      "atividadePrincipal": "Atividade central",
      "encerramento": "Atividade de fechamento",
      "avaliacao": "Como avaliar",
      "recursos": ["Recurso 1"],
      "tarefaCasa": "Tarefa opcional"
    }
  ],
  "avaliacaoFinal": "Avaliação final da sequência",
  "observacoesPedagogicas": "Dicas gerais"
}`;
  return { prompt, requestType: "sequence_generate", config: { maxOutputTokens: 8192, temperature: 0.7 } };
}

async function handleReports(body: Record<string, unknown>): Promise<{ prompt: string; requestType: string; config: object }> {
  if (!body?.tipo || !body?.informacoes)
    throw new Error("Campos obrigatórios: tipo, informacoes");

  const tipoKey = ["parecer", "individual", "turma", "observacoes"].includes(s(body.tipo, 20)) ? s(body.tipo, 20) : "parecer";
  const tipoPrompts: Record<string, string> = {
    parecer: "Crie um parecer descritivo individual profissional. Tom formal, objetivo e positivo.",
    individual: "Crie um relatório individual completo: desempenho acadêmico, desenvolvimento social, participação.",
    turma: "Crie um relatório de turma completo: perfil geral, pontos fortes, desafios, recomendações.",
    observacoes: "Crie observações pedagógicas profissionais em tópicos, com recomendações de intervenção.",
  };

  const prompt = `Você é um especialista em redação de documentos pedagógicos para a educação básica brasileira.

${tipoPrompts[tipoKey]}

Informações fornecidas pelo professor:
---
${s(body.informacoes, 1500)}
---
${body.nomeAluno ? `\nAluno/a: ${s(body.nomeAluno, 100)}` : ""}
${body.anoSerie ? `Ano/Série: ${s(body.anoSerie, 50)}` : ""}
${body.disciplina ? `Disciplina: ${s(body.disciplina, 100)}` : ""}
${body.periodo ? `Período: ${s(body.periodo, 50)}` : ""}

Retorne APENAS JSON válido (sem markdown):
{
  "tipo": "${tipoKey}",
  "titulo": "Título do documento",
  "textoCompleto": "Texto completo do relatório/parecer, bem redigido, com parágrafos estruturados",
  "pontosPrincipais": ["Ponto 1", "Ponto 2", "Ponto 3"],
  "recomendacoes": ["Recomendação 1", "Recomendação 2"]
}`;
  return { prompt, requestType: "report_generate", config: { maxOutputTokens: 4096, temperature: 0.6 } };
}

async function handleImprove(body: Record<string, unknown>): Promise<{ prompt: string; requestType: string; config: object }> {
  if (!body?.planejamento)
    throw new Error("Campo obrigatório: planejamento");

  const focusMap: Record<string, string> = {
    dinamicas: "dinâmicas de grupo e atividades interativas",
    jogos: "jogos educativos e gamificação",
    praticas: "atividades práticas, experimentos ou projetos hands-on",
    metodologias: "metodologias ativas como PBL, sala de aula invertida",
    sala_invertida: "implementação da sala de aula invertida (Flipped Classroom)",
    colaborativa: "aprendizagem colaborativa e construção coletiva do conhecimento",
  };

  const focoKey = s(body.foco, 30);
  const foco = focusMap[focoKey] || "melhorias pedagógicas gerais";
  const planejamentoResumido = typeof body.planejamento === "string"
    ? body.planejamento.slice(0, 2000)
    : JSON.stringify(body.planejamento).slice(0, 2000);

  const prompt = `Você é um especialista em inovação pedagógica e metodologias ativas para a educação básica brasileira.

Com base neste planejamento, sugira melhorias com foco em: ${foco}

Planejamento atual:
---
${planejamentoResumido}
---

Retorne APENAS JSON válido (sem markdown):
{
  "foco": "${focoKey || "geral"}",
  "resumoMelhorias": "Resumo do que foi sugerido e por que melhora a aula",
  "sugestoes": [
    {
      "titulo": "Nome da sugestão",
      "descricao": "Como implementar",
      "tempo": "Quanto tempo ocupa",
      "materiais": ["Material 1"],
      "beneficios": ["Benefício 1"],
      "comoImplementar": "Passo a passo"
    }
  ],
  "dicasProfessor": ["Dica 1", "Dica 2", "Dica 3"]
}`;
  return { prompt, requestType: "planning_improve", config: { maxOutputTokens: 4096, temperature: 0.8 } };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = extractBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: "Não autenticado. Faça login novamente." });

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado. Faça login novamente." });
  }

  const db = getDb();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  if (!user.isActive) return res.status(403).json({ error: "Conta bloqueada" });
  if (!user.isPremium && user.freeGenerationsRemaining <= 0) {
    return res.status(403).json({ error: "Seu período gratuito terminou.", code: "FREE_LIMIT_REACHED" });
  }

  const body = req.body as Record<string, unknown>;
  const type = s(body?.type, 20);

  if (!type) return res.status(400).json({ error: "Campo obrigatório: type (activities|adapt|sequences|reports|improve)" });

  let promptData: { prompt: string; requestType: string; config: object };
  try {
    switch (type) {
      case "activities": promptData = await handleActivities(body); break;
      case "adapt": promptData = await handleAdapt(body); break;
      case "sequences": promptData = await handleSequences(body); break;
      case "reports": promptData = await handleReports(body); break;
      case "improve": promptData = await handleImprove(body); break;
      default: return res.status(400).json({ error: `Tipo inválido: ${type}` });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro de validação";
    return res.status(400).json({ error: msg });
  }

  try {
    const raw = await generateWithFallback(promptData.prompt, promptData.config);
    const result = parseJson(raw);
    if (!result) return res.status(500).json({ error: "IA retornou formato inválido. Tente novamente." });

    const estimatedTokens = Math.round((promptData.prompt.length + JSON.stringify(result).length) / 4);

    if (!user.isPremium) {
      await db.update(usersTable)
        .set({ freeGenerationsRemaining: user.freeGenerationsRemaining - 1, updatedAt: new Date() })
        .where(eq(usersTable.id, user.id));
    }

    await db.insert(aiUsageTable).values({ userId: user.id, requestType: promptData.requestType, estimatedTokens });

    return res.status(200).json({
      ...result,
      _meta: {
        freeGenerationsRemaining: user.isPremium ? null : user.freeGenerationsRemaining - 1,
        isPremium: user.isPremium,
      },
    });
  } catch (err) {
    const isOverloaded = isOverloadedError2(err);
    const status = isOverloaded ? 503 : 500;
    const message = isOverloaded
      ? "O serviço de IA está com alta demanda. Aguarde alguns segundos e tente novamente."
      : "Falha ao processar. Tente novamente.";
    return res.status(status).json({ error: message });
  }
}
