(function () {
  var D = window.DATOS;
  var mapa = L.map('mapa', { scrollWheelZoom: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(mapa);

  D.arciprestazgos.forEach(function (a) {
    a.poligonos.forEach(function (p) {
      L.polygon(p, { color: a.color, weight: 1.5, fillColor: a.color, fillOpacity: 0.18 })
        .on('click', function () { location.href = a.url; })
        .addTo(mapa);
    });
  });

  var marcas = D.parroquias.map(function (p) {
    var m = L.circleMarker([p.lat, p.lng], {
      radius: 6, color: '#fff', weight: 1.5, fillColor: p.color, fillOpacity: 1
    }).bindTooltip(p.n, { direction: 'right', offset: [6, 0], className: 'nombre-parroquia' })
      .on('click', function () { location.href = p.url; })
      .addTo(mapa);
    return m;
  });

  var fijasAntes = false;
  function etiquetas() {
    var fijas = mapa.getZoom() >= 13;
    if (fijas === fijasAntes) { return; }
    fijasAntes = fijas;
    marcas.forEach(function (m) {
      var t = m.getTooltip();
      m.unbindTooltip();
      m.bindTooltip(t.getContent(), { permanent: fijas, direction: 'right', offset: [6, 0], className: 'nombre-parroquia' });
    });
  }
  mapa.on('zoomend', etiquetas);
  mapa.fitBounds(L.latLngBounds(D.parroquias.map(function (p) { return [p.lat, p.lng]; })).pad(0.08));
})();
