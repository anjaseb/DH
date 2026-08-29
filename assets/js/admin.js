import {supabase} from './supabase.js';
import {requireUser, profile} from './auth.js';

const $ = s => document.querySelector(s);
const msg = $('#msg');
let me;

(async () => {
  const u = await requireUser();
  if (!u) return;
  me = await profile(u);
  if (me.role !== 'admin') {
    document.body.innerHTML = '<main class="portal"><div class="wrap"><div class="formbox"><h1>Acesso restrito</h1><p>Apenas administradores podem abrir esta área.</p><a class="btn" href="dashboard.html">Voltar</a></div></div></main>';
    return;
  }
  loadEmployees();
  loadAreas();
  loadVagas();
  loadCandidaturas();
})();

$('#logout').onclick = async e => { e.preventDefault(); await supabase.auth.signOut(); location.href = 'login.html'; };

// --- separador (tabs) ---
document.querySelectorAll('.admin-tabs button').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.admin-tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    $('#tab-' + btn.dataset.tab).classList.add('active');
  };
});

// ============================================================
// FUNCIONÁRIOS — editar nome/departamento/perfil, activar/desactivar
// ============================================================
async function loadEmployees() {
  const rows = $('#rows');
  const { data, error } = await supabase.from('profiles')
    .select('id,full_name,email,department,role,active')
    .order('full_name');
  if (error) { msg.textContent = error.message; return; }
  rows.innerHTML = '';
  data.forEach(x => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input value="${x.full_name || ''}" data-field="full_name"></td>
      <td>${x.email || ''}</td>
      <td><input value="${x.department || ''}" data-field="department"></td>
      <td>
        <select data-field="role">
          <option value="employee" ${x.role === 'employee' ? 'selected' : ''}>Funcionário</option>
          <option value="admin" ${x.role === 'admin' ? 'selected' : ''}>Administrador</option>
        </select>
      </td>
      <td>${x.active ? 'Activo' : 'Inactivo'}</td>
      <td style="white-space:nowrap">
        <button class="btn" data-action="save">Guardar</button>
        <button class="btn alt" data-action="toggle">${x.active ? 'Desactivar' : 'Activar'}</button>
      </td>`;
    tr.querySelector('[data-action="save"]').onclick = async () => {
      const full_name = tr.querySelector('[data-field="full_name"]').value.trim();
      const department = tr.querySelector('[data-field="department"]').value.trim();
      const role = tr.querySelector('[data-field="role"]').value;
      const { error } = await supabase.from('profiles').update({ full_name, department, role }).eq('id', x.id);
      if (error) alert(error.message); else { msg.textContent = 'Dados actualizados.'; loadEmployees(); }
    };
    tr.querySelector('[data-action="toggle"]').onclick = async () => {
      const { error } = await supabase.from('profiles').update({ active: !x.active }).eq('id', x.id);
      if (error) alert(error.message); else loadEmployees();
    };
    rows.appendChild(tr);
  });
}

// ============================================================
// FOTOS DOS TRABALHOS — por área, mostra fotos actuais + upload novo
// ============================================================
async function loadAreas() {
  const wrap = $('#areas');
  const { data: areas, error } = await supabase.from('project_areas').select('*').order('sort_order');
  if (error) { wrap.innerHTML = '<div class="notice error">' + error.message + '</div>'; return; }
  const { data: images } = await supabase.from('project_images').select('*').order('sort_order');

  wrap.innerHTML = '';
  areas.forEach(area => {
    const block = document.createElement('div');
    block.className = 'area-block';
    const areaImages = (images || []).filter(im => im.area_key === area.key);
    block.innerHTML = `
      <span class="tag">${area.tag}</span>
      <h3>${area.title}</h3>
      <div class="photo-grid" data-grid></div>
      <div class="upload-row">
        <input type="file" accept="image/png,image/jpeg,image/webp" data-file>
        <input type="text" placeholder="Legenda da foto (opcional)" data-caption>
        <button class="btn" data-upload>Enviar foto</button>
      </div>
      <p class="notice" data-status style="margin-top:8px"></p>`;

    const grid = block.querySelector('[data-grid]');
    function renderPhotos() {
      grid.innerHTML = '';
      areaImages.forEach(im => {
        const item = document.createElement('div');
        item.className = 'photo-item';
        item.innerHTML = `<img src="${im.url}" alt="${im.caption || area.title}"><button title="Apagar">×</button>`;
        item.querySelector('button').onclick = async () => {
          if (!confirm('Apagar esta foto?')) return;
          await supabase.from('project_images').delete().eq('id', im.id);
          loadAreas();
        };
        grid.appendChild(item);
      });
      if (areaImages.length === 0) grid.innerHTML = '<p style="color:var(--ink-soft);font-size:13px">Ainda sem fotos enviadas — a página está a usar a foto de reserva.</p>';
    }
    renderPhotos();

    block.querySelector('[data-upload]').onclick = async () => {
      const fileInput = block.querySelector('[data-file]');
      const captionInput = block.querySelector('[data-caption]');
      const status = block.querySelector('[data-status]');
      const file = fileInput.files[0];
      if (!file) { status.className = 'notice error'; status.textContent = 'Escolhe uma foto primeiro.'; return; }
      if (file.size > 5 * 1024 * 1024) { status.className = 'notice error'; status.textContent = 'A foto tem de ter menos de 5MB.'; return; }
      status.className = 'notice'; status.textContent = 'A enviar...';
      const ext = file.name.split('.').pop();
      const path = `${area.key}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('projectos').upload(path, file);
      if (upErr) { status.className = 'notice error'; status.textContent = upErr.message; return; }
      const { data: pub } = supabase.storage.from('projectos').getPublicUrl(path);
      const { error: insErr } = await supabase.from('project_images').insert({
        area_key: area.key, url: pub.publicUrl, caption: captionInput.value.trim() || null
      });
      if (insErr) { status.className = 'notice error'; status.textContent = insErr.message; return; }
      status.className = 'notice ok'; status.textContent = 'Foto enviada.';
      fileInput.value = ''; captionInput.value = '';
      loadAreas();
    };

    wrap.appendChild(block);
  });
}

// ============================================================
// CONCURSO PÚBLICO — vagas e candidaturas
// ============================================================
async function loadVagas() {
  const wrap = $('#vagas-list');
  if (!wrap) return;
  const { data, error } = await supabase.from('vagas').select('*').order('sort_order');
  if (error) { wrap.innerHTML = '<div class="notice error">' + error.message + '</div>'; return; }

  wrap.innerHTML = '';
  if (!data.length) { wrap.innerHTML = '<p class="notice">Ainda sem vagas criadas. Use "+ Nova vaga".</p>'; }

  data.forEach(v => {
    const row = document.createElement('div');
    row.className = 'vaga-row';
    row.innerHTML = `
      <div class="vaga-row-head">
        <input value="${v.title || ''}" data-field="title" placeholder="Título da vaga">
        <select data-field="status">
          <option value="aberta" ${v.status === 'aberta' ? 'selected' : ''}>Aberta</option>
          <option value="fechada" ${v.status === 'fechada' ? 'selected' : ''}>Fechada</option>
        </select>
        <button class="btn alt" data-action="delete">Apagar</button>
      </div>
      <div class="vaga-row-grid">
        <input value="${v.department || ''}" data-field="department" placeholder="Departamento / área">
        <input value="${v.location || ''}" data-field="location" placeholder="Local (ex: Namibe)">
        <input value="${v.type || ''}" data-field="type" placeholder="Tipo (Efectivo, Estágio...)">
        <input type="date" value="${v.deadline || ''}" data-field="deadline">
      </div>
      <textarea data-field="description" rows="3" placeholder="Descrição da vaga">${v.description || ''}</textarea>
      <textarea data-field="requirements" rows="3" placeholder="Requisitos">${v.requirements || ''}</textarea>
      <button class="btn" data-action="save">Guardar vaga</button>
      <p class="notice" data-status style="display:none;margin-top:10px"></p>`;

    row.querySelector('[data-action="save"]').onclick = async () => {
      const status = row.querySelector('[data-status]');
      const payload = {
        title: row.querySelector('[data-field="title"]').value.trim(),
        status: row.querySelector('[data-field="status"]').value,
        department: row.querySelector('[data-field="department"]').value.trim() || null,
        location: row.querySelector('[data-field="location"]').value.trim() || null,
        type: row.querySelector('[data-field="type"]').value.trim() || null,
        deadline: row.querySelector('[data-field="deadline"]').value || null,
        description: row.querySelector('[data-field="description"]').value.trim() || null,
        requirements: row.querySelector('[data-field="requirements"]').value.trim() || null,
      };
      if (!payload.title) { alert('Indique o título da vaga.'); return; }
      const { error } = await supabase.from('vagas').update(payload).eq('id', v.id);
      status.style.display = 'block';
      if (error) { status.className = 'notice error'; status.textContent = error.message; }
      else {
        status.className = 'notice ok';
        status.textContent = 'Vaga actualizada.';
        loadCandidaturas();
      }
    };

    row.querySelector('[data-action="delete"]').onclick = async () => {
      if (!confirm('Apagar esta vaga e todas as candidaturas associadas?')) return;
      const { error } = await supabase.from('vagas').delete().eq('id', v.id);
      if (error) alert(error.message); else { loadVagas(); loadCandidaturas(); }
    };

    wrap.appendChild(row);
  });
}

$('#new-vaga')?.addEventListener('click', async () => {
  const { error } = await supabase.from('vagas').insert({ title: 'Nova vaga', status: 'fechada' });
  if (error) alert(error.message); else loadVagas();
});

const STATUS_LABELS = { pendente: 'Pendente', em_analise: 'Em análise', aprovado: 'Aprovado', rejeitado: 'Rejeitado' };
const WA_NUMBER_KEY = 'dh_wa_gerente_numero';
let lastCandidaturas = []; // guarda { c, cvUrl, biUrl, photoUrl } da última renderização, para o envio em massa

function waNumber() {
  return (localStorage.getItem(WA_NUMBER_KEY) || '').replace(/\D/g, '');
}

function waLink(number, text) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function candidatoMensagem(c, cvUrl, biUrl) {
  return [
    '*Nova candidatura — Domingos Humba*',
    `Vaga: ${c.vagas?.title || 'Vaga removida'}`,
    `Nome: ${c.full_name}`,
    `Telefone: ${c.phone || '—'}`,
    c.email ? `Email: ${c.email}` : null,
    `Estado: ${STATUS_LABELS[c.status] || c.status}`,
    `Data: ${new Date(c.created_at).toLocaleDateString('pt-AO')}`,
    '',
    `CV: ${cvUrl || '(link indisponível)'}`,
    `BI: ${biUrl || '(link indisponível)'}`,
  ].filter(Boolean).join('\n');
}

// carrega o número guardado no campo de configuração
(function initWaConfig() {
  const input = $('#wa-number');
  if (!input) return;
  input.value = localStorage.getItem(WA_NUMBER_KEY) || '';
  $('#wa-save')?.addEventListener('click', () => {
    localStorage.setItem(WA_NUMBER_KEY, input.value.replace(/\D/g, ''));
    const status = $('#wa-msg');
    status.className = 'notice ok';
    status.textContent = 'Número guardado neste dispositivo.';
    status.classList.remove('hidden');
  });
})();

$('#wa-send-all')?.addEventListener('click', () => {
  const status = $('#wa-msg');
  const number = waNumber();
  if (!number) {
    status.className = 'notice error';
    status.textContent = 'Indique e guarde primeiro o número de WhatsApp do gerente/presidente.';
    status.classList.remove('hidden');
    return;
  }
  if (!lastCandidaturas.length) {
    status.className = 'notice error';
    status.textContent = 'Não há candidaturas nesta lista para enviar.';
    status.classList.remove('hidden');
    return;
  }
  const partes = lastCandidaturas.map(({ c, cvUrl, biUrl }, i) => `${i + 1}) ${candidatoMensagem(c, cvUrl, biUrl)}`);
  const texto = `*Resumo de candidaturas — Domingos Humba* (${lastCandidaturas.length})\n\n` + partes.join('\n\n');
  status.classList.add('hidden');
  window.open(waLink(number, texto), '_blank', 'noopener');
});

async function loadCandidaturas() {
  const wrap = $('#cand-list');
  const filter = $('#cand-vaga-filter');
  if (!wrap || !filter) return;

  if (filter.dataset.loaded !== '1') {
    const { data: vagas } = await supabase.from('vagas').select('id,title').order('sort_order');
    (vagas || []).forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id; opt.textContent = v.title;
      filter.appendChild(opt);
    });
    filter.dataset.loaded = '1';
    filter.onchange = loadCandidaturas;
  }

  let q = supabase.from('candidaturas').select('*, vagas(title)').order('created_at', { ascending: false });
  if (filter.value) q = q.eq('vaga_id', filter.value);
  const { data, error } = await q;
  if (error) { wrap.innerHTML = '<div class="notice error">' + error.message + '</div>'; return; }

  wrap.innerHTML = '';
  lastCandidaturas = [];
  if (!data.length) { wrap.innerHTML = '<p class="notice">Sem candidaturas para mostrar.</p>'; return; }

  for (const c of data) {
    const [cv, bi, photo] = await Promise.all([
      supabase.storage.from('candidaturas').createSignedUrl(c.cv_path, 3600),
      supabase.storage.from('candidaturas').createSignedUrl(c.bi_path, 3600),
      supabase.storage.from('candidaturas').createSignedUrl(c.photo_path, 3600),
    ]);
    const cvUrl = cv.data?.signedUrl || '';
    const biUrl = bi.data?.signedUrl || '';
    const photoUrl = photo.data?.signedUrl || '';
    lastCandidaturas.push({ c, cvUrl, biUrl, photoUrl });

    const card = document.createElement('div');
    card.className = 'cand-card';
    card.innerHTML = `
      <div class="cand-info">
        <img class="cand-photo" src="${photoUrl}" alt="${c.full_name}">
        <div>
          <b>${c.full_name}</b>
          <small>${c.vagas?.title || 'Vaga removida'} · ${new Date(c.created_at).toLocaleDateString('pt-AO')}</small>
          <small>${c.phone || ''}${c.email ? ' · ' + c.email : ''}</small>
        </div>
      </div>
      <div class="cand-actions">
        <a class="btn alt" href="${cvUrl || '#'}" target="_blank" rel="noopener">CV</a>
        <a class="btn alt" href="${biUrl || '#'}" target="_blank" rel="noopener">BI</a>
        <button type="button" class="btn alt" data-action="whatsapp"><i class="fab fa-whatsapp"></i> Enviar</button>
        <select data-field="status">
          ${Object.entries(STATUS_LABELS).map(([val, label]) =>
      `<option value="${val}" ${c.status === val ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <button class="btn alt" data-action="delete">Apagar</button>
      </div>`;

    card.querySelector('[data-field="status"]').onchange = async (e) => {
      const { error } = await supabase.from('candidaturas').update({ status: e.target.value }).eq('id', c.id);
      if (error) alert(error.message);
    };

    card.querySelector('[data-action="whatsapp"]').onclick = () => {
      const number = waNumber();
      if (!number) { alert('Indique e guarde primeiro o número de WhatsApp do gerente/presidente.'); return; }
      window.open(waLink(number, candidatoMensagem(c, cvUrl, biUrl)), '_blank', 'noopener');
    };

    card.querySelector('[data-action="delete"]').onclick = async () => {
      if (!confirm('Apagar esta candidatura e os ficheiros associados?')) return;
      await supabase.storage.from('candidaturas').remove([c.cv_path, c.bi_path, c.photo_path]);
      const { error } = await supabase.from('candidaturas').delete().eq('id', c.id);
      if (error) alert(error.message); else loadCandidaturas();
    };

    wrap.appendChild(card);
  }
}
