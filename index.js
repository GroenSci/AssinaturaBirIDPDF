import fs from 'fs';
import path from 'path';
import express from 'express';
import { plainAddPlaceholder } from '@signpdf/placeholder-plain';

const app = express();
app.use(express.json({ limit: '50mb' }));

// === 1️⃣ GERA PDF COM PLACEHOLDER E HASH ===
app.post('/prepare', async (req, res) => {
  try {
    const inputBase64 = req.body.pdfBase64;
    const pdfBuffer = Buffer.from(inputBase64, 'base64');

    // Adiciona placeholder de assinatura
    const pdfWithPlaceholder = plainAddPlaceholder({
      pdfBuffer,
      reason: 'Assinatura via BirdID',
      contactInfo: 'assinatura@groen.com.br',
      name: 'Dr. Groen',
      location: 'Brasil',
    });

    // Gera o hash do documento (em base64) para enviar à BirdID
    const crypto = await import('crypto');
    const hash = crypto
      .createHash('sha256')
      .update(pdfWithPlaceholder)
      .digest('base64');

    // Retorna o PDF preparado + hash
    res.json({
      pdfWithPlaceholder: pdfWithPlaceholder.toString('base64'),
      hashBase64: hash,
    });
  } catch (err) {
    console.error('Erro ao preparar PDF:', err);
    res.status(500).json({ error: err.message });
  }
});

// === 2️⃣ INSERE PKCS#7 RETORNADO PELA BIRDID NO PDF ===
app.post('/finalize', (req, res) => {
  try {
    const { pdfBase64, pkcs7 } = req.body;
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Limpa o conteúdo do PKCS7 (remove cabeçalhos e quebras)
    const cleanPkcs7 = pkcs7
      .replace(/-----(BEGIN|END) PKCS7-----/g, '')
      .replace(/\s+/g, '');

    const pdfText = pdfBuffer.toString('latin1');
    const placeholderMatch = pdfText.match(/\/Contents <([0-9A-F]+)>/i);

    if (!placeholderMatch) {
      throw new Error('Placeholder de assinatura não encontrado.');
    }

    const signatureHex = Buffer.from(cleanPkcs7, 'base64')
      .toString('hex')
      .toUpperCase();

    const maxLen = placeholderMatch[1].length;
    if (signatureHex.length > maxLen) {
      throw new Error(
        `Assinatura PKCS#7 (${signatureHex.length}) maior que placeholder (${maxLen})`
      );
    }

    // Preenche o campo /Contents
    const paddedSignature = signatureHex.padEnd(maxLen, '0');
    const newPdfText = pdfText.replace(
      placeholderMatch[0],
      `/Contents <${paddedSignature}>`
    );

    const signedBuffer = Buffer.from(newPdfText, 'latin1');
    res.json({
      signedPdfBase64: signedBuffer.toString('base64'),
    });
  } catch (err) {
    console.error('Erro ao finalizar assinatura:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 8080;
app.listen(PORT, () =>
  console.log(`Servidor de assinatura rodando na porta ${PORT}`)
);
