/**
 * The Leaflet page both map components load — the native one through a
 * WebView, the web one through an iframe. One HTML string, so the pins and
 * the popups can't drift apart between platforms.
 *
 * Selection goes both ways: a tapped pin posts a `mosque-select` message to
 * the host, and the host posts the same message back to move the highlight.
 */

import { colors, teal } from '@/theme';
import type { Coordinates, Mosque } from '@/types';

/** Marker amber — chosen against OSM's tile palette, not the app's. */
const PIN_FILL = '#E3A03A';
const PIN_STROKE = '#9C6A14';

export function buildMapHtml(
  mosques: Mosque[],
  interactive: boolean,
  /** Where the phone says the reader is. Draws the "you are here" dot. */
  me: Coordinates | null = null,
  /** Label for that dot, in the reader's language. */
  meLabel = 'You are here',
): string {
  const points = mosques.map((m) => ({
    id: m._id,
    name: m.name,
    address: m.address,
    lat: m.coordinates.lat,
    lng: m.coordinates.lng,
  }));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; background: ${teal[50]}; }
  .leaflet-container { background: ${teal[50]}; font-family: -apple-system, system-ui, sans-serif; }
  /*
   * The pin. Amber so it separates from OSM's greens and creams; the selected
   * one swaps to the brand teal, lifts, and pulses a halo at its tip. The
   * glyph is a dome, a minaret and a finial — a mosque at a glance.
   */
  .pin {
    position: relative;
    width: 34px; height: 44px;
    transform-origin: 50% 100%;
    transition: transform .18s ease;
    filter: drop-shadow(0 3px 4px rgba(0,0,0,.28));
  }
  .pin .body { fill: ${PIN_FILL}; stroke: ${PIN_STROKE}; stroke-width: 1.4; transition: fill .18s ease, stroke .18s ease; }
  .pin.on { transform: scale(1.18); }
  .pin.on .body { fill: ${teal[700]}; stroke: #fff; stroke-width: 2; }
  .pin .halo {
    display: none;
    position: absolute; left: 50%; bottom: -3px;
    width: 18px; height: 18px; margin-left: -9px;
    border-radius: 50%;
    background: rgba(10,82,71,.32);
  }
  .pin.on .halo { display: block; animation: pulse 1.6s ease-out infinite; }
  @keyframes pulse {
    0%   { transform: scale(.5); opacity: .9; }
    100% { transform: scale(2.6); opacity: 0; }
  }
  /*
   * You. Deliberately not a pin: a pin is a place someone chose to put on the
   * map, and this is just where the phone thinks you are. A blue dot with a
   * white collar and a soft accuracy halo is the convention every map app has
   * taught people to read, so it needs no legend.
   */
  .me {
    width: 18px; height: 18px;
    border-radius: 50%;
    background: #1E7BE0;
    border: 3px solid #fff;
    box-shadow: 0 0 0 6px rgba(30,123,224,.22), 0 2px 6px rgba(0,0,0,.3);
  }
  .leaflet-popup-content-wrapper { border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,.15); }
  .leaflet-popup-tip { display: none; }
  .leaflet-popup-content { margin: 10px 12px; font-size: 12px; color: ${colors.inkMuted}; }
  .leaflet-popup-content b { display: block; font-size: 14px; color: ${teal[700]}; margin-bottom: 2px; }
.leaflet-control-attribution { font-size: 9px; background: rgba(255,255,255,.7); }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var points = ${JSON.stringify(points)};
  var interactive = ${interactive};
  var me = ${JSON.stringify(me)};
  var meLabel = ${JSON.stringify(meLabel)};

  var map = L.map('map', {
    zoomControl: false,
    attributionControl: true,
    dragging: interactive,
    scrollWheelZoom: false,
    doubleClickZoom: interactive,
    touchZoom: interactive,
    keyboard: false,
    tap: interactive
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap'
  }).addTo(map);

  var markers = {};
  points.forEach(function (p) {
    var icon = L.divIcon({
      className: '',
      html:
        '<div class="pin" data-id="' + p.id + '">' +
          '<span class="halo"></span>' +
          '<svg class="mark" viewBox="0 0 34 44" width="34" height="44" aria-hidden="true">' +
            '<path class="body" d="M17 1.5C8.6 1.5 2 8.1 2 16.6c0 10.9 15 25.9 15 25.9s15-15 15-25.9C32 8.1 25.4 1.5 17 1.5z"/>' +
            '<rect x="8.4" y="11.5" width="1.8" height="10.5" rx=".9" fill="#fff"/>' +
            '<path d="M11.5 22V18.8a5.5 5.5 0 0 1 11 0V22z" fill="#fff"/>' +
            '<rect x="10.5" y="22" width="13" height="2" rx="1" fill="#fff"/>' +
            '<circle cx="17" cy="11.6" r="1.2" fill="#fff"/>' +
          '</svg>' +
        '</div>',
      iconSize: [34, 44],
      iconAnchor: [17, 43],
      popupAnchor: [0, -40]
    });
    var marker = L.marker([p.lat, p.lng], { icon: icon, keyboard: false }).addTo(map);
    markers[p.id] = marker;
    marker.bindPopup('<b>' + p.name + '</b>' + p.address);
    marker.on('click', function () {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(p.id);
      else if (window.parent !== window) window.parent.postMessage({ type: 'mosque-select', id: p.id }, '*');
    });
  });

  var meMarker = null;
  if (me) {
    meMarker = L.marker([me.lat, me.lng], {
      icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      keyboard: false,
      // Under the mosque pins: it is context, not an answer.
      zIndexOffset: -500
    }).addTo(map);
    meMarker.bindPopup('<b>' + meLabel + '</b>');
  }

  if (points.length === 1) {
    map.setView([points[0].lat, points[0].lng], 15);
  } else if (points.length > 1) {
    map.fitBounds(points.map(function (p) { return [p.lat, p.lng]; }), { padding: [36, 36] });
  } else {
    map.setView([45.5017, -73.5673], 11);
  }

  window.__select = function (id) {
    document.querySelectorAll('.pin').forEach(function (el) {
      el.classList.toggle('on', el.getAttribute('data-id') === id);
    });
    Object.keys(markers).forEach(function (key) {
      markers[key].setZIndexOffset(key === id ? 1000 : 0);
    });
    var target = points.filter(function (p) { return p.id === id; })[0];
    if (target) map.flyTo([target.lat, target.lng], 14, { duration: 0.9 });
  };

  /** Centre on the reader. No-op without a fix, so the button can be honest. */
  window.__focusMe = function () {
    if (!me) return;
    map.flyTo([me.lat, me.lng], 13, { duration: 0.9 });
    if (meMarker) meMarker.openPopup();
  };

  // The iframe host can't inject script, so it selects by message instead.
  window.addEventListener('message', function (e) {
    if (!e.data) return;
    if (e.data.type === 'mosque-select') window.__select(e.data.id);
    if (e.data.type === 'focus-me') window.__focusMe();
  });
</script>
</body>
</html>`;
}
