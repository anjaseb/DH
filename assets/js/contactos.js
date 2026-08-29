document.querySelector('#quote').onsubmit = e => {
  e.preventDefault();
  const f = new FormData(e.target);
  const email = document.querySelector('[data-ct-mail="contactos.email"]')?.href.replace('mailto:', '') || 'domingosmanuelhumba2021@gmail.com';
  location.href = 'mailto:' + email
    + '?subject=' + encodeURIComponent('Pedido de orçamento - ' + f.get('service'))
    + '&body=' + encodeURIComponent('Nome: ' + f.get('name') + '\nTelefone: ' + f.get('phone') + '\nServiço: ' + f.get('service') + '\n\n' + f.get('message'));
};
