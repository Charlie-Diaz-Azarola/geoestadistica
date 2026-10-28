(function () {
  var D = window.ARC;
  var mapa = L.map('mapa', { scrollWheelZoom: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(mapa);

  var limites = L.latLngBounds([]);
  D.parroquias.forEach(function (p) {
    p.poligonos.forEach(function (q) {
      var capa = L.polygon(q, { color: p.color, weight: 1.5, fillColor: p.color, fillOpacity: 0.25 })
        .on('click', function () { location.href = p.url; })
        .addTo(mapa);
      limites.extend(capa.getBounds());
    });
  });

  var marcas = D.parroquias.map(function (p) {
    return L.circleMarker([p.lat, p.lng], {
      radius: 6, color: '#fff', weight: 1.5, fillColor: p.color, fillOpacity: 1
    }).bindTooltip(p.n, { direction: 'right', offset: [6, 0], className: 'nombre-parroquia' })
      .on('click', function () { location.href = p.url; })
      .addTo(mapa);
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
  mapa.fitBounds(limites.pad(0.04));
  etiquetas();
})();
