// ============================================================
// Carregador de conteúdo do site — DOMINGOS HUMBA
//
// Objectivo: manter o site público rápido e leve.
// - O texto estático do HTML aparece sempre primeiro, na hora.
// - Este script pede em segundo plano (fetch simples, sem SDK)
//   a versão mais recente à tabela "site_content" do Supabase e,
//   se houver diferenças, troca o texto sem recarregar a página.
// - Guarda uma cópia em sessionStorage: só há pedido de rede uma
//   vez por sessão de navegação, não em cada página.
// - Se o Supabase estiver em baixo ou sem rede, o site continua a
//   funcionar normalmente com o texto que já está no HTML.
// ============================================================

import { SUPABASE_URL, SUPABASE_KEY } from './supabase-config.js';

const CACHE_KEY = 'dh_site_content_v1';

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function applyContent(data) {
  if (!data) return;

  document.querySelectorAll('[data-ct]').forEach((el) => {
    const val = getPath(data, el.getAttribute('data-ct'));
    if (val !== undefined && val !== null && val !== '') el.textContent = val;
  });

  document.querySelectorAll('[data-ct-tel]').forEach((el) => {
    const val = getPath(data, el.getAttribute('data-ct-tel'));
    if (val) el.setAttribute('href', 'tel:' + String(val).replace(/\s+/g, ''));
  });

  document.querySelectorAll('[data-ct-mail]').forEach((el) => {
    const val = getPath(data, el.getAttribute('data-ct-mail'));
    if (val) el.setAttribute('href', 'mailto:' + val);
  });

  document.querySelectorAll('[data-ct-wa]').forEach((el) => {
    const val = getPath(data, el.getAttribute('data-ct-wa'));
    const href = el.getAttribute('href') || '';
    if (val) el.setAttribute('href', href.replace(/wa\.me\/\d+/, 'wa.me/' + val));
  });

  // listas (ex: serviços) — elemento pai com data-ct-list="servicos" e
  // dentro dele itens molde marcados com data-ct-item, um por posição
  document.querySelectorAll('[data-ct-list]').forEach((list) => {
    const arr = getPath(data, list.getAttribute('data-ct-list'));
    if (!Array.isArray(arr)) return;
    const items = list.querySelectorAll('[data-ct-item]');
    items.forEach((item, i) => {
      if (!arr[i]) return;
      item.querySelectorAll('[data-ct-field]').forEach((field) => {
        const key = field.getAttribute('data-ct-field');
        if (arr[i][key] !== undefined && arr[i][key] !== '') field.textContent = arr[i][key];
      });
    });
  });
}

// 1) aplica imediatamente o que já estiver em cache (instantâneo, sem rede)
try {
  const cached = sessionStorage.getItem(CACHE_KEY);
  if (cached) applyContent(JSON.parse(cached));
} catch (e) {
  /* cache inválida — ignora e segue com o texto estático do HTML */
}

// 2) confirma/actualiza em segundo plano, sem bloquear o carregamento da página
if (SUPABASE_URL && !SUPABASE_URL.includes('SEU-PROJETO')) {
  fetch(`${SUPABASE_URL}/rest/v1/site_content?key=eq.site&select=value`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((rows) => {
      const data = rows && rows[0] && rows[0].value;
      if (!data) return;
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
      applyContent(data);
    })
    .catch(() => {
      /* offline ou Supabase indisponível — mantém o texto actual, site continua a funcionar */
    });
}
