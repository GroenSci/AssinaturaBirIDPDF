import express from 'express';
import { PDFDocument } from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { SUBFILTER_ETSI_CADES_DETACHED } from '@signpdf/utils';
import signpdf from '@signpdf/signpdf';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '50mb' }));

// === Rota: preparar PDF ===
app.post('/preparar-para-assinatura', async (req, res) => {
  try {
    const { pdfBase64 } = req.body;
    if (!pdfBase64) return res.status(400).json({ error: 'O campo "pdfBase64" é obrigatório.' });

    const pdfBytes = Buffer.from(pdfBase64, 'base64');
    const pdfDoc = await PDFDocument.load(pdfBytes);

    pdflibAddPlaceholder({
      pdfDoc,
      name: 'sig1',
      reason: 'Assinatura digital',
      contactInfo: 'contato@exemplo.com',
      location: 'Brasil',
      signatureLength: 8192,
      subFilter: SUBFILTER_ETSI_CADES_DETACHED,
    });

    const modifiedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
    const modifiedPdfBase64 = Buffer.from(modifiedPdfBytes).toString('base64');

    res.status(200).json({ pdfBase64: modifiedPdfBase64 });
  } catch (error) {
    console.error('Erro ao preparar PDF:', error);
    res.status(500).json({ error: 'Falha ao preparar PDF para assinatura.' });
  }
});

// === Rota: finalizar assinatura ===
app.post('/finalizar-assinatura', async (req, res) => {
  try {
    const { pdfBase64, signatureHex } = req.body;
    if (!pdfBase64 || !signatureHex) {
      return res.status(400).json({ error: 'Os campos "pdfBase64" e "signatureHex" são obrigatórios.' });
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const signatureBuffer = Buffer.from(signatureHex, 'hex');

    const signedPdfBuffer = signpdf.sign(pdfBuffer, null, {
      signature: signatureBuffer,
      asBuffer: true,
    });

    const signedPdfBase64 = signedPdfBuffer.toString('base64');
    res.status(200).json({ signedPdfBase64 });
  } catch (error) {
    console.error('Erro ao finalizar assinatura:', error);
    res.status(500).json({ error: 'Falha ao injetar assinatura no PDF.' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de assinatura rodando na porta ${PORT}`);
});
