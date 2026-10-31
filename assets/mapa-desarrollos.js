(function () {
  // Página de la sección: arciprestazgos (window.DATOS) de fondo, todos los desarrollos y filtro por fuente.
  // Ficha de un desarrollo: sus parroquias (window.DES.parroquias) de fondo y su polígono, sus puntos o su límite.
  var D = window.DES, F = window.DATOS;
  var COLOR = { abc: '#7a1f2b', otras: '#1f5f8b', municipal: '#b8650a' };
  var mapa = L.map('mapa', { scrollWheelZoom: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(mapa);

  var fondo = L.latLngBounds([]);
  if (F) {
    F.arciprestazgos.forEach(function (a) {
      a.poligonos.forEach(function (p) {
        var c = L.polygon(p, { color: '#6b6259', weight: 1.5, dashArray: '4 3', fillColor: '#8a8179', fillOpacity: 0.12, interactive: false })
          .addTo(mapa);
        fondo.extend(c.getBounds());
      });
    });
  }
  (D.parroquias || []).forEach(function (p) {
    p.poligonos.forEach(function (q) {
      L.polygon(q, { color: p.color, weight: 1.5, fillColor: p.color, fillOpacity: 0.2 })
        .bindTooltip(p.n, { sticky: true, className: 'nombre-parroquia' })
        .on('click', function () { location.href = p.url; })
        .addTo(mapa);
    });
  });

  var capas = { abc: [], otras: [] };
  var limites = L.latLngBounds([]);
  D.desarrollos.forEach(function (d) {
    var color = d.c === 'municipal' ? COLOR.municipal : COLOR[d.f];
    var estilo = d.c === 'municipal' ? { color: color, weight: 2.5, dashArray: '8 5', fill: false }
      : d.c === 'zona' ? { color: color, weight: 2, dashArray: '5 4', fillColor: color, fillOpacity: 0.12 }
      : { color: color, weight: 2, fillColor: color, fillOpacity: 0.45 };
    var grupo = d.poligonos.map(function (q) {
      return L.polygon(q, estilo).bindTooltip(d.n, { sticky: true, className: 'nombre-parroquia' });
    });
    d.puntos.forEach(function (p) {
      grupo.push(L.circleMarker([p[0], p[1]], {
        radius: 7, color: color, weight: 2.5, fillColor: d.e ? '#ffffff' : color, fillOpacity: 0.9
      }).bindTooltip(d.n + ' · ' + p[2], { className: 'nombre-parroquia' }));
    });
    grupo.forEach(function (c) {
      if (d.url) { c.on('click', function () { location.href = d.url; }); }
      c.addTo(mapa);
      limites.extend(c.getBounds ? c.getBounds() : L.latLngBounds([c.getLatLng(), c.getLatLng()]));
      capas[d.f].push(c);
    });
  });
  if (F) {
    mapa.fitBounds(fondo.pad(0.02));
  } else {
    mapa.fitBounds(limites.pad(0.25), { maxZoom: 16 });
  }

  // Filtro por fuente (solo en la página de la sección)
  var botones = document.querySelectorAll('.filtro button');
  function filtrar(f) {
    botones.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-f') === f)); });
    Object.keys(capas).forEach(function (k) {
      capas[k].forEach(function (c) {
        if (f === 'todas' || f === k) { c.addTo(mapa); } else { mapa.removeLayer(c); }
      });
    });
    document.querySelectorAll('[data-fuente]').forEach(function (el) {
      var k = el.getAttribute('data-fuente');
      el.classList.toggle('oculta', !(f === 'todas' || k === f));
    });
  }
  botones.forEach(function (b) {
    b.addEventListener('click', function () { filtrar(b.getAttribute('data-f')); });
  });
})();
