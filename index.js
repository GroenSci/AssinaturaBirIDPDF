// 1. Importar as dependências necessárias
const express = require('express');
const { PDFDocument } = require('pdf-lib');

// 2. Inicializar o aplicativo Express
const app = express();

// Railway (e outros provedores) define a porta via variável de ambiente.
// Usamos a porta deles ou a 3000 para testes locais.
const PORT = process.env.PORT || 3000;

// 3. Configurar o Express para aceitar JSON no corpo da requisição.
// Aumentamos o limite para 50mb para suportar PDFs grandes em Base64.
app.use(express.json({ limit: '50mb' }));

// Função auxiliar para converter Hexadecimal para Bytes (Uint8Array)
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

// 4. Definir a rota principal da nossa API: POST /sign-pdf
app.post('/sign-pdf', async (req, res) => {
    try {
        // Pega o PDF (em Base64) e a assinatura (em Hex) do corpo da requisição
        const { pdfBase64, signatureHex } = req.body;

        // Validação básica da entrada
        if (!pdfBase64 || !signatureHex) {
            return res.status(400).json({ error: 'Os campos "pdfBase64" e "signatureHex" são obrigatórios.' });
        }

        // --- LÓGICA DE ASSINATURA COM PDF-LIB ---

        // 1. Carrega o PDF a partir do Base64.
        // O PDF já deve conter o placeholder criado pelo seu script no Bubble.
        const pdfBytes = Buffer.from(pdfBase64, 'base64');
        const pdfDoc = await PDFDocument.load(pdfBytes);

        // 2. Encontra o placeholder de assinatura no documento.
        const signaturePlaceholders = pdfDoc.findSignaturePlaceholders();
        if (signaturePlaceholders.length === 0) {
            return res.status(400).json({ error: "Nenhum placeholder de assinatura foi encontrado no PDF." });
        }
        const placeholder = signaturePlaceholders[0];

        // 3. Prepara a assinatura. O formato esperado pela pdf-lib é um hexadecimal
        //    dentro de "<>" e com um preenchimento de zeros no final.
        const signatureHexPadded = `<${signatureHex.padEnd(placeholder.getSignatureLength(), '0')}>`;
        const signatureBytes = hexToBytes(signatureHexPadded);
        
        // 4. "Injeta" a assinatura no placeholder.
        placeholder.embedSignature(signatureBytes);

        // 5. Salva o documento final e assinado.
        const signedPdfBytes = await pdfDoc.save({ useObjectStreams: false });

        // 6. Converte os bytes do PDF assinado para Base64 para retornar na resposta.
        const signedPdfBase64 = Buffer.from(signedPdfBytes).toString('base64');

        // 7. Envia a resposta de sucesso com o PDF assinado.
        res.status(200).json({ signedPdfBase64: signedPdfBase64 });

    } catch (error) {
        // Em caso de qualquer erro no processo, retorna uma mensagem de erro.
        console.error('Erro ao assinar o PDF:', error);
        res.status(500).json({ error: 'Ocorreu um erro interno ao processar a assinatura do PDF.' });
    }
});

// 5. Iniciar o servidor para escutar as requisições na porta definida
app.listen(PORT, () => {
    console.log(`Servidor de assinatura rodando na porta ${PORT}`);
});