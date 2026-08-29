import { supabase } from './supabase.js';

// ============================================================
// CONCURSO PÚBLICO — página pública
// Carrega as vagas abertas e trata o envio de candidaturas
// (CV, cópia do BI e fotografia) para o Supabase Storage.
// ============================================================

const grid = document.querySelector('#vagas-grid');
const vagasMsg = document.querySelector('#vagas-msg');
const select = document.querySelector('#vaga-select');
const selectedBox = document.querySelector('#selected-vaga-box');
const form = document.querySelector('#candidatura-form');
const candMsg = document.querySelector('#cand-msg');

const MAX_DOC = 8 * 1024 * 1024;  // 8MB — CV
const MAX_IMG = 5 * 1024 * 1024;  // 5MB — BI / fotografia

let vagas = [];

async function loadVagas() {
    const { data, error } = await supabase.from('vagas')
        .select('*')
        .eq('status', 'aberta')
        .order('sort_order', { ascending: true });

    if (error) {
        vagasMsg.textContent = 'Não foi possível carregar as vagas neste momento.';
        return;
    }

    vagas = data || [];

    if (!vagas.length) {
        vagasMsg.textContent = '';
        grid.innerHTML = '<div class="empty-state">Não há vagas abertas neste momento. Volte a consultar esta página mais tarde.</div>';
        select.innerHTML = '<option value="">— Sem vagas abertas —</option>';
        return;
    }

    vagasMsg.textContent = '';
    grid.innerHTML = '';
    select.innerHTML = '<option value="">— Seleccione a vaga —</option>';

    vagas.forEach(v => {
        const card = document.createElement('div');
        card.className = 'vaga-card';
        card.innerHTML = `
            <span class="tag">${esc(v.department) || 'Domingos Humba'}</span>
            <h3>${esc(v.title)}</h3>
            <div class="vaga-meta">
                ${v.location ? `<span><i class="fa-solid fa-location-dot"></i>${esc(v.location)}</span>` : ''}
                ${v.type ? `<span><i class="fa-solid fa-briefcase"></i>${esc(v.type)}</span>` : ''}
                ${v.deadline ? `<span><i class="fa-solid fa-calendar"></i>Prazo: ${formatDate(v.deadline)}</span>` : ''}
            </div>
            ${v.description ? `<p>${esc(v.description)}</p>` : ''}
            ${v.requirements ? `<details><summary>Ver requisitos</summary><p>${esc(v.requirements)}</p></details>` : ''}
            <button class="btn" type="button" data-apply>Candidatar-me a esta vaga</button>
        `;
        card.querySelector('[data-apply]').onclick = () => selectVaga(v.id);
        grid.appendChild(card);

        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = v.title;
        select.appendChild(opt);
    });
}

function selectVaga(id) {
    select.value = id;
    updateSelectedBox();
    document.querySelector('#candidatura').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateSelectedBox() {
    const v = vagas.find(x => x.id === select.value);
    if (v) {
        selectedBox.textContent = 'A candidatar-se à vaga: ' + v.title;
        selectedBox.classList.remove('hidden');
    } else {
        selectedBox.classList.add('hidden');
    }
}
select.onchange = updateSelectedBox;

function esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function formatDate(d) {
    try { return new Date(d + 'T00:00:00').toLocaleDateString('pt-AO'); }
    catch { return d; }
}

function showMsg(kind, text) {
    candMsg.className = 'notice' + (kind ? ' ' + kind : '');
    candMsg.textContent = text;
    candMsg.classList.remove('hidden');
}

function extOf(file) {
    const parts = file.name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : 'dat';
}

async function uploadFile(file, folder, prefix) {
    const path = `${folder}/${prefix}.${extOf(file)}`;
    const { error } = await supabase.storage.from('candidaturas').upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
}

form.onsubmit = async (e) => {
    e.preventDefault();

    const f = new FormData(form);
    const vagaId = f.get('vaga_id');
    if (!vagaId) { showMsg('error', 'Seleccione a vaga pretendida.'); return; }

    const fullName = (f.get('full_name') || '').trim();
    const phone = (f.get('phone') || '').trim();
    if (!fullName || !phone) { showMsg('error', 'Preencha o nome completo e o telefone.'); return; }

    const cvFile = form.cv.files[0];
    const biFile = form.bi.files[0];
    const photoFile = form.photo.files[0];
    if (!cvFile || !biFile || !photoFile) {
        showMsg('error', 'Anexe o CV, a cópia do BI e uma fotografia.');
        return;
    }
    if (cvFile.size > MAX_DOC) { showMsg('error', 'O CV tem de ter menos de 8MB.'); return; }
    if (biFile.size > MAX_IMG) { showMsg('error', 'A cópia do BI tem de ter menos de 5MB.'); return; }
    if (photoFile.size > MAX_IMG) { showMsg('error', 'A fotografia tem de ter menos de 5MB.'); return; }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    showMsg('', 'A enviar candidatura...');

    try {
        const folder = `${vagaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const [cv_path, bi_path, photo_path] = await Promise.all([
            uploadFile(cvFile, folder, 'cv'),
            uploadFile(biFile, folder, 'bi'),
            uploadFile(photoFile, folder, 'foto'),
        ]);

        const { error } = await supabase.from('candidaturas').insert({
            vaga_id: vagaId,
            full_name: fullName,
            phone,
            email: (f.get('email') || '').trim() || null,
            cv_path,
            bi_path,
            photo_path,
        });
        if (error) throw error;

        form.reset();
        selectedBox.classList.add('hidden');
        showMsg('ok', 'Candidatura submetida com sucesso. Entraremos em contacto se o seu perfil for seleccionado.');
    } catch (err) {
        showMsg('error', err.message || 'Não foi possível submeter a candidatura. Tente novamente.');
    } finally {
        submitBtn.disabled = false;
    }
};

loadVagas();
