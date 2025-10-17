// index.js
import express from "express";
import bodyParser from "body-parser";
import fs from "fs";

const app = express();
app.use(bodyParser.json({ limit: "50mb" }));

// Define o tamanho do placeholder em bytes (8192 é padrão seguro)
const PLACEHOLDER_LENGTH = 8192;

// ======================
// ROTA: Preparar PDF
// ======================
app.post("/preparar-para-assinatura", async (req, res) => {
  try {
    const { pdfBase64 } = req.body;
    if (!pdfBase64)
      return res
        .status(400)
        .json({ error: 'O campo "pdfBase64" é obrigatório.' });

    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    // Cria placeholder de zeros
    const placeholder = Buffer.alloc(PLACEHOLDER_LENGTH, 0x00);

    // Busca a última ocorrência de "%%EOF" para inserir o placeholder
    // (essa abordagem é simples e funciona na maioria dos PDFs)
    const eofIndex = pdfBuffer.lastIndexOf(Buffer.from("%%EOF"));
    if (eofIndex === -1)
      return res.status(400).json({ error: "PDF inválido." });

    // Insere placeholder antes do EOF
    const modifiedPdfBuffer = Buffer.concat([
      pdfBuffer.slice(0, eofIndex),
      placeholder,
      pdfBuffer.slice(eofIndex),
    ]);

    const modifiedPdfBase64 = modifiedPdfBuffer.toString("base64");

    res.json({ pdfBase64: modifiedPdfBase64 });
  } catch (err) {
    console.error("Erro ao preparar PDF:", err);
    res.status(500).json({ error: "Falha ao preparar PDF." });
  }
});

// ======================
// Função auxiliar: injeta assinatura RAW
// ======================
function injectRawSignature(pdfBuffer, rawSignatureHex, placeholderLength = PLACEHOLDER_LENGTH) {
  const signatureBuffer = Buffer.from(rawSignatureHex.replace(/\s+/g, ""), "hex");

  if (signatureBuffer.length > placeholderLength) {
    throw new Error("Assinatura maior que o espaço reservado.");
  }

  // Busca a posição do placeholder: sequência de zeros
  const placeholderBuffer = Buffer.alloc(placeholderLength, 0x00);
  const placeholderPos = pdfBuffer.indexOf(placeholderBuffer);

  if (placeholderPos === -1) throw new Error("Placeholder de assinatura não encontrado.");

  // Preenche o placeholder com a assinatura real
  const paddedSignature = Buffer.concat([
    signatureBuffer,
    Buffer.alloc(placeholderLength - signatureBuffer.length, 0x00),
  ]);

  return Buffer.concat([
    pdfBuffer.slice(0, placeholderPos),
    paddedSignature,
    pdfBuffer.slice(placeholderPos + placeholderLength),
  ]);
}

// ======================
// ROTA: Finalizar assinatura
// ======================
app.post("/finalizar-assinatura", async (req, res) => {
  try {
    const { pdfBase64, rawSignatureHex } = req.body;
    if (!pdfBase64 || !rawSignatureHex) {
      return res
        .status(400)
        .json({ error: "Os campos 'pdfBase64' e 'rawSignatureHex' são obrigatórios." });
    }

    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    const signedPdfBuffer = injectRawSignature(pdfBuffer, rawSignatureHex);

    res.json({ pdfAssinadoBase64: signedPdfBuffer.toString("base64") });
  } catch (err) {
    console.error("Erro ao finalizar assinatura:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(8080, () => console.log("Servidor de assinatura rodando na porta 8080"));
