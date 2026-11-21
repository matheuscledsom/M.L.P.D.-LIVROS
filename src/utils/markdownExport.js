export function buildWorkMarkdown(item) {
  if (!item || !item.title) return '';
  const lines = [`# ${item.title}`];
  if (item.originalTitle && item.originalTitle !== item.title) {
    lines.push(`*Título original: ${item.originalTitle}*`);
  }
  lines.push('');
  if (item.author) lines.push(`- **Autoria:** ${item.author}`);
  if (item.status) lines.push(`- **Status:** ${item.status}`);
  if (typeof item.rating === 'number') lines.push(`- **Nota:** ${item.rating}/100`);
  if (item.totalPages > 0) {
    lines.push(`- **Páginas:** ${item.currentPage || 0}/${item.totalPages}`);
  }
  if (item.isbn) lines.push(`- **ISBN:** ${item.isbn}`);
  if (Array.isArray(item.genres) && item.genres.length > 0) {
    lines.push(`- **Gêneros:** ${item.genres.join(', ')}`);
  }
  if (Array.isArray(item.tags) && item.tags.length > 0) {
    lines.push(`- **Tags:** ${item.tags.map((t) => `#${t.replace(/^#/, '')}`).join(' ')}`);
  }
  if (item.wantToReread) {
    lines.push('- **Marcador:** Para reler');
  }
  if (item.loanedTo) {
    lines.push(
      `- **Emprestado para:** ${item.loanedTo}${item.loanedAt ? ` (desde ${item.loanedAt})` : ''}`
    );
  }

  if (item.notes) {
    lines.push('', '## Resenha e Notas', '', String(item.notes).trim());
  }

  if (item.fichamento) {
    lines.push('', '## Fichamento', '', String(item.fichamento).trim());
  }

  const quotes = Array.isArray(item.quotes) ? item.quotes : [];
  if (quotes.length > 0) {
    lines.push('', '## Citações');
    quotes.forEach((q) => {
      if (!q?.text) return;
      lines.push('');
      lines.push(`> ${String(q.text).trim()}`);
      if (q.location) lines.push(`— *${q.location}*`);
      if (q.note) lines.push(`Nota: ${q.note}`);
    });
  }

  lines.push('');
  return lines.join('\n');
}

export function downloadWorkMarkdown(item) {
  const md = buildWorkMarkdown(item);
  if (!md || typeof document === 'undefined') return false;
  const slug = String(item.title || 'obra')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'obra';

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slug}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}
