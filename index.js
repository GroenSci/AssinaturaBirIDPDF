import express from "express";
import bodyParser from "body-parser";
import { PDFDocument } from "pdf-lib";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(bodyParser.json({ limit: "50mb" }));

app.post("/sign-pdf", async (req, res) => {
  try {
    const { pdfBase64, rawSignature } = req.body;

    if (!pdfBase64 || !rawSignature) {
      return res.status(400).json({ error: "Faltando pdfBase64 ou rawSignature" });
    }

    // 1️⃣ Converte PDF Base64 em Buffer
    const pdfBuffer = Buffer.from(pdfBase64, "base64");

    // 2️⃣ Regera PDF com pdf-lib (limpa estrutura)
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const newPdfBytes = await pdfDoc.save();

    // 3️⃣ Converte a raw signature (Bird ID) em buffer
    const signatureBuffer = Buffer.from(rawSignature, "base64");

    // 4️⃣ Insere a assinatura digital no final do PDF
    // Nota: Essa abordagem funciona se a Bird ID fornecer a assinatura completa do PDF
    const signedPdf = Buffer.concat([newPdfBytes, signatureBuffer]);

    // 5️⃣ Retorna PDF assinado em Base64
    res.json({ signedPdf: signedPdf.toString("base64") });

  } catch (error) {
    console.error("Erro ao assinar PDF:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
