(function () {
  var caja = document.getElementById('vf-globos');
  if (!caja) { return; }
  var globo = document.createElement('div');
  globo.className = 'vf-globo';
  globo.setAttribute('role', 'dialog');
  globo.setAttribute('aria-labelledby', 'vf-globo-tit');
  globo.tabIndex = -1;
  globo.hidden = true;
  globo.innerHTML = '<div class="vf-cab"><span class="vf-ico" aria-hidden="true"></span><p id="vf-globo-tit"></p>' +
    '<button type="button" class="vf-cerrar" aria-label="Cerrar">×</button></div><div class="vf-cont"></div>';
  document.body.appendChild(globo);
  var tit = globo.querySelector('#vf-globo-tit'), cont = globo.querySelector('.vf-cont');
  var activo = null;

  function cerrar(volver) {
    if (!activo) { return; }
    globo.hidden = true;
    activo.setAttribute('aria-expanded', 'false');
    if (volver) { activo.focus(); }
    activo = null;
  }

  function colocar(a) {
    if (window.matchMedia('(max-width: 600px)').matches) { globo.style.left = ''; globo.style.top = ''; return; }
    var r = a.getBoundingClientRect(), ancho = globo.offsetWidth, alto = globo.offsetHeight;
    var x = Math.min(Math.max(8, r.left + r.width / 2 - ancho / 2), document.documentElement.clientWidth - ancho - 8);
    var y = r.bottom + 8;
    if (y + alto > window.innerHeight - 8 && r.top - alto - 8 > 8) { y = r.top - alto - 8; }
    globo.style.left = (x + window.scrollX) + 'px';
    globo.style.top = (y + window.scrollY) + 'px';
  }

  function abrir(a) {
    if (activo === a) { cerrar(true); return; }
    cerrar(false);
    var origen = document.getElementById(a.dataset.vf + '-c');
    if (!origen) { return; }
    tit.textContent = origen.dataset.titulo;
    cont.innerHTML = origen.innerHTML;
    globo.hidden = false;
    activo = a;
    a.setAttribute('aria-expanded', 'true');
    colocar(a);
    globo.focus();
  }

  document.querySelectorAll('a.vf[data-vf]').forEach(function (a) {
    a.setAttribute('role', 'button');
    a.setAttribute('aria-expanded', 'false');
    a.setAttribute('aria-haspopup', 'dialog');
    a.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); abrir(a); });
    a.addEventListener('keydown', function (ev) {
      if (ev.key === ' ') { ev.preventDefault(); ev.stopPropagation(); abrir(a); }
    });
  });
  globo.querySelector('.vf-cerrar').addEventListener('click', function () { cerrar(true); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && activo) { cerrar(true); } });
  document.addEventListener('click', function (ev) {
    if (activo && !globo.contains(ev.target) && !activo.contains(ev.target)) { cerrar(false); }
  });
  window.addEventListener('resize', function () { if (activo) { colocar(activo); } });
})();
