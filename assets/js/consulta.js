import { supabase } from './supabase.js';

// ============================================================
// CONSULTAR CANDIDATURA — página pública
// Chama a função SQL consultar_candidatura (supabase/consulta-candidatura.sql).
// A função só devolve vaga, estado, data e primeiro nome — nunca CV, BI, foto,
// telefone ou email — e bloqueia tentativas repetidas.
// ============================================================

const form = document.querySelector('#consulta-form');
const modo = document.querySelector('#modo');
const campoCodigo = document.querySelector('#campo-codigo');
const campoEmail = document.querySelector('#campo-email');
const msg = document.querySelector('#consulta-msg');
const out = document.querySelector('#resultado');

const ESTADOS = {
    pendente: { label: 'Recebida', texto: 'Recebemos a sua candidatura. Ainda não foi analisada.' },
    em_analise: { label: 'Em análise', texto: 'A sua candidatura está a ser analisada pela nossa equipa.' },
    aprovado: { label: 'Aprovada', texto: 'A sua candidatura foi aprovada. Aguarde o nosso contacto pelo telefone ou email indicados na inscrição.' },
    rejeitado: { label: 'Não seleccionada', texto: 'Nesta fase o seu perfil não foi seleccionado. Agradecemos o seu interesse na Domingos Humba.' },
};

function showMsg(kind, text) {
    msg.className = 'notice' + (kind ? ' ' + kind : '');
    msg.textContent = text;
    msg.classList.remove('hidden');
}

function formatDate(d) {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('pt-AO'); } catch { return d; }
}

function syncModo() {
    const porCodigo = modo.value === 'codigo';
    campoCodigo.classList.toggle('hidden', !porCodigo);
    campoEmail.classList.toggle('hidden', porCodigo);
    form.codigo.required = porCodigo;
    form.email.required = !porCodigo;
    form.codigo.value = porCodigo ? form.codigo.value : '';
    form.email.value = porCodigo ? '' : form.email.value;
}
modo.onchange = syncModo;
syncModo();

function renderCard(c) {
    const info = ESTADOS[c.estado] || { label: c.estado || '—', texto: '' };
    const card = document.createElement('div');
    card.className = 'res-card';

    const h = document.createElement('h3');
    h.textContent = c.vaga;
    const small = document.createElement('small');
    small.textContent = `${c.nome ? c.nome + ' · ' : ''}Submetida em ${formatDate(c.data)}`;
    const pill = document.createElement('span');
    pill.className = 'res-estado ' + (c.estado === 'aprovado' || c.estado === 'rejeitado' ? c.estado : '');
    pill.textContent = info.label;
    card.append(h, small, pill);

    if (info.texto) {
        const p = document.createElement('p');
        p.textContent = info.texto;
        card.appendChild(p);
    }
    return card;
}

form.onsubmit = async (e) => {
    e.preventDefault();
    out.innerHTML = '';
    msg.classList.add('hidden');

    const telefone = form.telefone.value.trim();
    const codigo = modo.value === 'codigo' ? form.codigo.value.trim().toUpperCase() : '';
    const email = modo.value === 'email' ? form.email.value.trim() : '';

    if (telefone.replace(/\D/g, '').length < 9) { showMsg('error', 'Indique o telefone completo (9 dígitos).'); return; }
    if (modo.value === 'codigo' && !codigo) { showMsg('error', 'Indique o código da candidatura.'); return; }
    if (modo.value === 'email' && !email) { showMsg('error', 'Indique o email usado na candidatura.'); return; }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    showMsg('', 'A consultar...');

    try {
        const { data, error } = await supabase.rpc('consultar_candidatura', {
            p_telefone: telefone,
            p_codigo: codigo || null,
            p_email: email || null,
        });
        if (error) throw error;

        if (!data || !data.ok) {
            if (data && data.motivo === 'bloqueado') {
                showMsg('error', 'Demasiadas tentativas. Aguarde 15 minutos e tente novamente, ou contacte-nos.');
            } else if (data && data.motivo === 'dados_invalidos') {
                showMsg('error', 'Verifique os dados indicados.');
            } else {
                showMsg('error', 'Não encontrámos nenhuma candidatura com esses dados. Confirme o telefone e o código (ou email).');
            }
            return;
        }

        msg.classList.add('hidden');
        data.candidaturas.forEach((c) => out.appendChild(renderCard(c)));
        out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        console.error(err);
        showMsg('error', 'Não foi possível fazer a consulta neste momento. Tente novamente.');
    } finally {
        btn.disabled = false;
    }
};
