const TEXT_MIMES = new Set(['text/plain', 'text/markdown', 'text/x-markdown']);

function matchesBytes(bytes, signature, offset = 0) {
  if (!bytes || bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
}

function bytesContainAscii(bytes, text, limit = 128) {
  const max = Math.min(bytes.length, limit);
  let slice = '';
  for (let i = 0; i < max; i += 1) {
    slice += String.fromCharCode(bytes[i]);
  }
  return slice.includes(text);
}

export function detectFormatFromBytes(uint8Array, fileName = '', mimeType = '') {
  const bytes =
    uint8Array instanceof Uint8Array
      ? uint8Array
      : new Uint8Array(uint8Array || 0);
  const lowerName = String(fileName || '').toLowerCase();
  const lowerMime = String(mimeType || '').toLowerCase();

  // RAR / CBR (não suportado nativamente no navegador)
  // RAR4: 52 61 72 21 1A 07 00 | RAR5: 52 61 72 21 1A 07 01 00
  if (matchesBytes(bytes, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) {
    return {
      format: 'cbr',
      supported: false,
      error:
        'Arquivos CBR (RAR) não são suportados no navegador. Converta o arquivo para CBZ (ZIP) para ler no Códice.',
    };
  }

  // PDF: "%PDF-" (25 50 44 46 2D)
  if (matchesBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { format: 'pdf', supported: true };
  }

  // ZIP container: "PK\x03\x04" ou "PK\x05\x06" -> EPUB vs CBZ
  if (
    matchesBytes(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
    matchesBytes(bytes, [0x50, 0x4b, 0x05, 0x06])
  ) {
    if (
      bytesContainAscii(bytes, 'application/epub+zip', 256) ||
      lowerName.endsWith('.epub') ||
      lowerMime.includes('epub')
    ) {
      return { format: 'epub', supported: true };
    }
    return { format: 'cbz', supported: true };
  }

  if (lowerName.endsWith('.cbr') || lowerMime.includes('x-cbr')) {
    return {
      format: 'cbr',
      supported: false,
      error:
        'Arquivos CBR (RAR) não são suportados no navegador. Converta o arquivo para CBZ (ZIP) para ler no Códice.',
    };
  }

  // Verifica se é texto válido (TXT / MD) - ausência de bytes nulos nos primeiros 512 bytes
  const probeLength = Math.min(bytes.length, 512);
  let hasNullByte = false;
  for (let i = 0; i < probeLength; i += 1) {
    if (bytes[i] === 0) {
      hasNullByte = true;
      break;
    }
  }

  if (!hasNullByte && (bytes.length > 0 || lowerName.endsWith('.txt') || lowerName.endsWith('.md'))) {
    if (
      lowerName.endsWith('.md') ||
      lowerName.endsWith('.markdown') ||
      lowerMime.includes('markdown')
    ) {
      return { format: 'markdown', supported: true };
    }
    if (
      lowerName.endsWith('.txt') ||
      TEXT_MIMES.has(lowerMime) ||
      bytesContainAscii(bytes, '# ', 64)
    ) {
      const looksMarkdown =
        lowerName.endsWith('.md') ||
        /^#{1,3}\s+/m.test(new TextDecoder().decode(bytes.slice(0, 512)));
      return { format: looksMarkdown ? 'markdown' : 'txt', supported: true };
    }
    return { format: 'txt', supported: true };
  }

  return {
    format: 'unknown',
    supported: false,
    error:
      'Formato de arquivo não reconhecido ou corrompido. Use PDF, EPUB, CBZ, TXT ou Markdown.',
  };
}

export async function detectBookFileFormat(file) {
  if (!file) {
    return {
      format: 'unknown',
      supported: false,
      error: 'Nenhum arquivo selecionado.',
    };
  }
  const headBuffer = await file.slice(0, 512).arrayBuffer();
  return detectFormatFromBytes(
    new Uint8Array(headBuffer),
    file.name,
    file.type
  );
}
