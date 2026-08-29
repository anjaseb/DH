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
