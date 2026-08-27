
import { SUPABASE_URL, SUPABASE_KEY } from './supabase-config.js';

const FALLBACK_PROJECTS = [
  { key: 'construcao', tag: 'INSTALAÇÕES', title: 'instalações', images: [
    { src: 'assets/img/projectos/rede.jpg', caption: 'Instalações eléctricas e de redes' },
    { src: 'assets/img/projectos/instalacao.jpg', caption: 'Instalação e manutenção de ar condicionado' },
  ]},
  { key: 'tecnologia', tag: 'TECNOLOGIA', title: 'Software e sistemas', images: [
    { src: 'assets/img/projectos/informatica.jpg', caption: 'Soluções de informática no terreno' },
  ]},
  { key: 'arquitectura', tag: 'ARQUITECTURA', title: 'Projectos civis', images: [
    { src: 'assets/img/projectos/arq.jpg', caption: 'Arqutectua civil' },
  ] },
  { key: 'eventos', tag: 'EVENTOS', title: 'Cobertura de eventos', images: [
    { src: 'assets/img/projectos/evento.jpg', caption: 'Eventos' },
  ] },
  { key: 'limpeza', tag: 'LIMPEZA', title: 'Manutenção de espaços', images: [
    { src: 'assets/img/projectos/limpeza.jpg', caption: 'Equipa de limpeza geral em acção' },
  ]},
  { key: 'seguranca', tag: 'SEGURANÇA', title: 'Segurança institucional', images: [
    { src: 'assets/img/projectos/seguranca.jpg', caption: 'Equipa de segurança institucional' },
  ]},
];

const FALLBACK_IMG = 'assets/img/bg/team-duotone.jpg';

let PROJECTS = FALLBACK_PROJECTS;

const grid = document.getElementById('projectGrid');
const lb = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
const lbTitle = document.getElementById('lbTitle');
const lbSub = document.getElementById('lbSub');

let current = null;
let slide = 0;

function renderGrid() {
  if (!grid) return;
  grid.innerHTML = PROJECTS.map((p, i) => {
    const cover = p.images[0] ? p.images[0].src : FALLBACK_IMG;
    const badge = p.images.length === 0
      ? '<span class="soon">Fotos em breve</span>'
      : (p.images.length > 1 ? `<span class="count">${p.images.length} fotos</span>` : '');
    return `<button type="button" class="project" data-index="${i}">
      <img src="${cover}" alt="${p.title}" loading="lazy">
      ${badge}
      <span class="tag">${p.tag}</span>
      <h3>${p.title}</h3>
    </button>`;
  }).join('');
}

function openProject(index) {
  current = PROJECTS[index];
  slide = 0;
  render();
  lb.classList.remove('hidden');
}
function render() {
  if (!current) return;
  const has = current.images.length > 0;
  const img = has ? current.images[slide] : { src: FALLBACK_IMG, caption: 'Ainda não há fotografias desta área — em breve.' };
  lbImg.src = img.src;
  lbImg.alt = current.title;
  lbTitle.textContent = current.title;
  lbSub.textContent = img.caption || '';
}
function close() {
  lb.classList.add('hidden');
  current = null;
}
function next() {
  if (!current || current.images.length < 2) return;
  slide = (slide + 1) % current.images.length;
  render();
}
function prev() {
  if (!current || current.images.length < 2) return;
  slide = (slide - 1 + current.images.length) % current.images.length;
  render();
}

if (grid) {
  renderGrid();
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.project');
    if (!btn) return;
    openProject(Number(btn.dataset.index));
  });
}
document.getElementById('lbClose')?.addEventListener('click', close);
document.getElementById('lbNext')?.addEventListener('click', next);
document.getElementById('lbPrev')?.addEventListener('click', prev);
lb?.addEventListener('click', (e) => { if (e.target === lb) close(); });
document.addEventListener('keydown', (e) => {
  if (lb && lb.classList.contains('hidden')) return;
  if (e.key === 'Escape') close();
  if (e.key === 'ArrowRight') next();
  if (e.key === 'ArrowLeft') prev();
});

// --- carrega da base de dados em segundo plano; substitui a reserva estática ---
if (SUPABASE_URL && !SUPABASE_URL.includes('SEU-PROJETO')) {
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/project_areas?select=key,tag,title,sort_order&order=sort_order`, { headers }).then(r => r.ok ? r.json() : []),
    fetch(`${SUPABASE_URL}/rest/v1/project_images?select=area_key,url,caption,sort_order&order=sort_order`, { headers }).then(r => r.ok ? r.json() : []),
  ]).then(([areas, images]) => {
    if (!Array.isArray(areas) || areas.length === 0) return;
     PROJECTS = areas.map(a => {
      const dbImages = images.filter(im => im.area_key === a.key).map(im => ({ src: im.url, caption: im.caption }));
      const fallback = FALLBACK_PROJECTS.find(f => f.key === a.key);
      return {
        key: a.key,
        tag: a.tag,
        title: a.title,
        // se ainda não há fotos enviadas pelo painel para esta área,
        // mantém as fotos de reserva já definidas aqui no código
        images: dbImages.length ? dbImages : (fallback ? fallback.images : []),
      };
    });
    renderGrid();
  }).catch(() => {
    /* mantém a lista de reserva — a página continua a funcionar */
  });
}
