const express = require('express');
const bodyParser = require('body-parser');
const { PDFDocument } = require('pdf-lib');
const { pdflibAddPlaceholder } = require('@signpdf/placeholder-pdf-lib');

const app = express();
const PORT = process.env.PORT || 8080;

// Aceitar JSON grandes (PDFs em Base64)
app.use(bodyParser.json({ limit: '50mb' }));

// Converte hexadecimal em bytes
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

/**
 * Rota: Preparar PDF para assinatura
 */
app.post('/preparar-para-assinatura', async (req, res) => {
    try {
        const { pdfBase64 } = req.body;
        if (!pdfBase64) return res.status(400).json({ error: 'O campo "pdfBase64" é obrigatório.' });

        const pdfBytes = Buffer.from(pdfBase64, 'base64');
        const pdfDoc = await PDFDocument.load(pdfBytes);

        if (!pdfDoc.catalog.get('AcroForm')) {
    pdfDoc.catalog.set('AcroForm', pdfDoc.context.obj({ Fields: [] }));
}
        // Adiciona placeholder para assinatura
        pdflibAddPlaceholder({
            pdfDoc,
            reason: 'Assinatura digital',
            signatureLength: 8192 // tamanho do espaço reservado
        });

        const modifiedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
        const modifiedPdfBase64 = Buffer.from(modifiedPdfBytes).toString('base64');

        res.status(200).json({ pdfBase64: modifiedPdfBase64 });
    } catch (error) {
        console.error("Erro ao preparar PDF:", error);
        res.status(500).json({ error: "Falha ao adicionar placeholder de assinatura." });
    }
});

/**
 * Rota: Assinar PDF com assinatura raw hexadecimal
 */
app.post('/sign-pdf', async (req, res) => {
    try {
        const { pdfBase64, signatureHex } = req.body;
        if (!pdfBase64 || !signatureHex) {
            return res.status(400).json({ error: 'Os campos "pdfBase64" e "signatureHex" são obrigatórios.' });
        }

        const pdfBytes = Buffer.from(pdfBase64, 'base64');
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // Converte assinatura hex para bytes
        const signatureBytes = hexToBytes(signatureHex);

        // Injeta assinatura diretamente no placeholder (low-level)
        const acroForm = pdfDoc.context.lookup(pdfDoc.catalog.get('AcroForm'));
        const fields = acroForm.get('Fields');

        // Normalmente há apenas 1 placeholder, pega o primeiro
        const sigFieldRef = fields.get(0);
        const sigField = pdfDoc.context.lookup(sigFieldRef);

        // Substitui o conteúdo do placeholder pelo bytes da assinatura
        sigField.set('V', pdfDoc.context.obj(signatureBytes));

        // Salva PDF assinado
        const signedPdfBytes = await pdfDoc.save({ useObjectStreams: false });
        const signedPdfBase64 = Buffer.from(signedPdfBytes).toString('base64');

        res.status(200).json({ signedPdfBase64 });
    } catch (error) {
        console.error("Erro ao assinar PDF:", error);
        res.status(500).json({ error: 'Falha ao assinar PDF.' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor de assinatura rodando na porta ${PORT}`);
});
