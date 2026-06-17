import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import { GenerateExamBody } from "@workspace/api-zod";

const router = Router();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const SYSTEM_PROMPT = `Você é um especialista em elaboração de avaliações escolares brasileiras.
Você cria provas de alta qualidade, pedagogicamente adequadas, com questões claras e bem formuladas.

REGRAS:
- Questões de múltipla escolha: 5 alternativas (a, b, c, d, e), apenas uma correta
- Questões discursivas: enunciados claros que exigem reflexão e desenvolvimento
- Linguagem adequada para o nível de ensino indicado
- Conteúdo fiel ao tema solicitado
- Gabarito correto e justo
- Responda APENAS com JSON válido, sem markdown, sem blocos de código`;

router.post("/exam/generate", async (req, res) => {
  const parsed = GenerateExamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos: " + parsed.error.message });
    return;
  }

  const input = parsed.data;
  const totalQuestoes = (input.questoesAlternativas ?? 0) + (input.questoesDiscursivas ?? 0);

  if (totalQuestoes === 0) {
    res.status(400).json({ error: "A prova deve ter ao menos uma questão." });
    return;
  }

  const valorTotal = input.valorTotal ?? 10;
  const nAlt = input.questoesAlternativas ?? 0;
  const nDisc = input.questoesDiscursivas ?? 0;

  let valorAlt = 0;
  let valorDisc = 0;
  if (nAlt > 0 && nDisc > 0) {
    valorAlt = parseFloat((valorTotal * 0.6 / nAlt).toFixed(2));
    valorDisc = parseFloat((valorTotal * 0.4 / nDisc).toFixed(2));
  } else if (nAlt > 0) {
    valorAlt = parseFloat((valorTotal / nAlt).toFixed(2));
  } else {
    valorDisc = parseFloat((valorTotal / nDisc).toFixed(2));
  }

  const prompt = `Crie uma prova escolar completa com os seguintes parâmetros:

DADOS DA PROVA:
- Disciplina: ${input.disciplina}
- Ano/Série: ${input.anoSerie}
- Turma: ${input.turma ?? "não especificada"}
- Conteúdo cobrado: ${input.conteudo}
- Questões de múltipla escolha: ${nAlt} (valor cada: ${valorAlt} pontos)
- Questões discursivas: ${nDisc} (valor cada: ${valorDisc} pontos)
- Instruções extras: ${input.instrucoes ?? "nenhuma"}

Retorne EXATAMENTE este JSON (sem markdown, apenas JSON puro):
{
  "titulo": "título da prova",
  "instrucoes": "instruções gerais para o aluno (leia atentamente, use caneta azul/preta, etc.)",
  "questoesAlternativas": [
    {
      "numero": 1,
      "enunciado": "enunciado completo da questão",
      "alternativas": {
        "a": "texto da alternativa A",
        "b": "texto da alternativa B",
        "c": "texto da alternativa C",
        "d": "texto da alternativa D",
        "e": "texto da alternativa E"
      },
      "gabarito": "letra correta (a, b, c, d ou e)",
      "valor": ${valorAlt}
    }
  ],
  "questoesDiscursivas": [
    {
      "numero": ${nAlt + 1},
      "enunciado": "enunciado completo da questão discursiva",
      "linhasResposta": 6,
      "valor": ${valorDisc},
      "criterios": "critérios resumidos de correção"
    }
  ]
}

Gere EXATAMENTE ${nAlt} questões de múltipla escolha e ${nDisc} questões discursivas.
Se algum tipo for 0, retorne array vazio para aquele tipo.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + prompt }] }],
      config: { maxOutputTokens: 8192, temperature: 0.7 },
    });

    let content = response.text ?? "";
    content = content.trim();
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    if (!content) {
      res.status(500).json({ error: "A IA não retornou conteúdo" });
      return;
    }

    const exam = JSON.parse(content);

    if (!Array.isArray(exam.questoesAlternativas)) exam.questoesAlternativas = [];
    if (!Array.isArray(exam.questoesDiscursivas)) exam.questoesDiscursivas = [];
    if (typeof exam.titulo !== "string") exam.titulo = `Prova de ${input.disciplina}`;
    if (typeof exam.instrucoes !== "string") exam.instrucoes = "Leia atentamente cada questão antes de responder.";

    res.json(exam);
  } catch (err: unknown) {
    req.log.error({ err }, "Erro ao gerar prova");
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    res.status(500).json({ error: "Falha ao gerar prova: " + message });
  }
});

export default router;
