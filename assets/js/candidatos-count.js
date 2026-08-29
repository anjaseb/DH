import { SUPABASE_URL, SUPABASE_KEY } from './supabase-config.js';

// ============================================================
// Mostra, na página inicial, quantos candidatos já se inscreveram
// no concurso público. Usa uma função SQL pública (candidaturas_count)
// que devolve apenas o número — nunca dados pessoais dos candidatos.
// ============================================================

const el = document.querySelector('#candidatos-count');
if (el && SUPABASE_URL && !SUPABASE_URL.includes('SEU-PROJETO')) {
    fetch(`${SUPABASE_URL}/rest/v1/rpc/candidaturas_count`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
        },
        body: '{}',
    })
        .then((r) => (r.ok ? r.json() : null))
        .then((n) => { if (typeof n === 'number') el.textContent = n; else el.textContent = '0'; })
        .catch(() => { el.textContent = '0'; });
}
