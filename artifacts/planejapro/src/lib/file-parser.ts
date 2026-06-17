import * as pdfjsLib from "pdfjs-dist";

// Configure the PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export async function parsePDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const texts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) texts.push(pageText);
  }

  return texts.join("\n\n");
}

export async function parseDOCX(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export async function parseTXT(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string ?? "");
    reader.onerror = () => reject(new Error("Erro ao ler arquivo TXT"));
    reader.readAsText(file, "utf-8");
  });
}

export type ParseResult = {
  text: string;
  pageCount?: number;
};

export async function parseFile(file: File): Promise<ParseResult> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    const text = await parsePDF(file);
    // Estimate page count from text length
    return { text, pageCount: Math.ceil(text.length / 2000) };
  }

  if (ext === "docx" || ext === "doc") {
    const text = await parseDOCX(file);
    return { text };
  }

  if (ext === "txt") {
    const text = await parseTXT(file);
    return { text };
  }

  throw new Error(`Formato não suportado: .${ext}`);
}
