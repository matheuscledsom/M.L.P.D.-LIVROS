import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { marked } from 'marked';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const { detectFormatFromBytes } = await import('../src/utils/fileFormatDetector.js');
const { getVerdictForScore, getVerdictMeta } = await import('../src/utils/backlogHelpers.js');
const { FONT_PRESETS, EDITORIAL_PRESETS } = await import('../src/utils/themeTokens.js');

function buildMinimalTwoPagePdf() {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Contents 5 0 R /Resources << /Font << /F1 7 0 R >> >> >>\nendobj\n',
    '4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>\nendobj\n',
    '5 0 obj\n<< /Length 44 >>\nstream\nBT /F1 14 Tf 30 350 Td (Pagina Um Codice) Tj ET\nendstream\nendobj\n',
    '6 0 obj\n<< /Length 46 >>\nstream\nBT /F1 14 Tf 30 350 Td (Pagina Dois Codice) Tj ET\nendstream\nendobj\n',
    '7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, 'utf8'));
}

async function buildMinimalEpubBytes() {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
  );
  zip.file(
    'OEBPS/content.opf',
    '<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Livro Teste Códice</dc:title></metadata><manifest><item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="ch1"/></spine></package>'
  );
  zip.file(
    'OEBPS/ch1.xhtml',
    '<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Capítulo 1</h1><p>Conteúdo de teste do Projeto Códice.</p></body></html>'
  );
  return await zip.generateAsync({ type: 'uint8array' });
}

async function buildMinimalCbzBytes() {
  const zip = new JSZip();
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  zip.file('page10.png', tinyPng);
  zip.file('page2.png', tinyPng);
  zip.file('page1.png', tinyPng);
  return await zip.generateAsync({ type: 'uint8array' });
}

test('deteccao por magic bytes reconhece PDF, EPUB, CBZ, TXT, Markdown e bloqueia CBR', async () => {
  const pdfBytes = buildMinimalTwoPagePdf();
  assert.deepEqual(detectFormatFromBytes(pdfBytes, 'arquivo.bin'), {
    format: 'pdf',
    supported: true,
  });

  const epubBytes = await buildMinimalEpubBytes();
  assert.deepEqual(detectFormatFromBytes(epubBytes, 'sem-extensao'), {
    format: 'epub',
    supported: true,
  });

  const cbzBytes = await buildMinimalCbzBytes();
  assert.deepEqual(detectFormatFromBytes(cbzBytes, 'hq.cbz'), {
    format: 'cbz',
    supported: true,
  });

  const cbrHeader = new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00]);
  const cbrRes = detectFormatFromBytes(cbrHeader, 'manga.cbr');
  assert.equal(cbrRes.format, 'cbr');
  assert.equal(cbrRes.supported, false);
  assert.ok(cbrRes.error.includes('CBZ'));

  const mdBytes = new TextEncoder().encode('# Capítulo 1\n\nTexto em Markdown.');
  assert.equal(detectFormatFromBytes(mdBytes, 'notas.md').format, 'markdown');
});

test('pdfjs, jszip (ordenacao natural CBZ) e marked processam arquivos reais com sucesso', async () => {
  // PDF real de 2 páginas
  const pdfBytes = buildMinimalTwoPagePdf();
  const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
  assert.equal(pdfDoc.numPages, 2);
  const page2 = await pdfDoc.getPage(2);
  const txt2 = await page2.getTextContent();
  assert.ok(txt2.items.map((i) => i.str).join(' ').includes('Pagina Dois'));
  await pdfDoc.destroy();

  // CBZ real com ordenação natural
  const cbzBytes = await buildMinimalCbzBytes();
  const zip = await JSZip.loadAsync(cbzBytes);
  const sortedNames = Object.keys(zip.files).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
  assert.deepEqual(sortedNames, ['page1.png', 'page2.png', 'page10.png']);

  // Markdown
  const html = marked.parse('# Capítulo 1\n\nTexto editorial.', { async: false });
  assert.ok(String(html).includes('<h1>Capítulo 1</h1>'));
});

test('review editorial usa faixas corretas e 10 fontes + 22 presets estao presentes', () => {
  assert.equal(getVerdictForScore(95), 'Obra-Prima');
  assert.equal(getVerdictForScore(84), 'Excelente');
  assert.equal(getVerdictForScore(74), 'Muito Bom');
  assert.equal(getVerdictForScore(55), 'Regular');
  assert.equal(getVerdictForScore(35), 'Abaixo do Esperado');
  assert.equal(getVerdictMeta('Bom')?.id, 'Muito Bom');

  assert.equal(FONT_PRESETS.length, 10);
  assert.equal(EDITORIAL_PRESETS.length, 22);
});
