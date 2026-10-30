(function () {
  // Página de la sección: arciprestazgos (window.DATOS) de fondo y todos los desarrollos.
  // Ficha de un desarrollo: sus parroquias (window.DES.parroquias) de fondo y su polígono.
  var D = window.DES, F = window.DATOS;
  var mapa = L.map('mapa', { scrollWheelZoom: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(mapa);

  if (F) {
    F.arciprestazgos.forEach(function (a) {
      a.poligonos.forEach(function (p) {
        L.polygon(p, { color: '#6b6259', weight: 1.5, dashArray: '4 3', fillColor: '#8a8179', fillOpacity: 0.12, interactive: false })
          .addTo(mapa);
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

  var limites = L.latLngBounds([]);
  D.desarrollos.forEach(function (d) {
    d.poligonos.forEach(function (q) {
      var capa = L.polygon(q, { color: '#7a1f2b', weight: 2, fillColor: '#7a1f2b', fillOpacity: 0.45 })
        .bindTooltip(d.n, { sticky: true, className: 'nombre-parroquia' });
      if (d.url) { capa.on('click', function () { location.href = d.url; }); }
      limites.extend(capa.addTo(mapa).getBounds());
    });
  });
  mapa.fitBounds(limites.pad(F ? 0.6 : 0.25));
})();
