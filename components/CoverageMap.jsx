'use client';
import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
export default function CoverageMap({ enabledZips, selectedZip, onSelect }) {
  const container = useRef(null), mapRef = useRef(null), layerRef = useRef(null), selectRef = useRef(onSelect);
  const [ready, setReady] = useState(0), [error, setError] = useState(''), [tileError, setTileError] = useState(false);
  selectRef.current = onSelect;
  useEffect(() => {
    let cancelled = false, map, resize;
    const controller = new AbortController();
    Promise.all([import('leaflet'), fetch('/data/service-area-zips.geojson', { signal: controller.signal }).then(r => { if (!r.ok) throw Error('Boundary download failed'); return r.json(); })]).then(([module, boundaries]) => {
      if (cancelled) return;
      const L = module.default || module;
      map = L.map(container.current, { scrollWheelZoom: false, zoomSnap: 0.25, minZoom: 8, maxZoom: 16 });
      mapRef.current = { map, L, boundaries };
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).on('tileerror', () => { if (!cancelled) setTileError(true); }).addTo(map);
      map.attributionControl.addAttribution('Area boundaries: <a href="https://www.census.gov/programs-surveys/geography/guidance/geo-areas/zctas.html">U.S. Census Bureau</a>');
      const bounds = L.geoJSON(boundaries).getBounds();
      map.fitBounds(bounds, { padding: [20, 20] });
      L.control.scale({ imperial: true, metric: false }).addTo(map);
      resize = new ResizeObserver(() => map.invalidateSize()); resize.observe(container.current);
      setReady(v => v + 1);
    }).catch(error => { if (!cancelled && error.name !== 'AbortError') setError('The map could not load. The community directory below still shows current coverage.'); });
    return () => { cancelled = true; controller.abort(); resize?.disconnect(); map?.remove(); mapRef.current = null; layerRef.current = null; };
  }, []);
  useEffect(() => {
    if (!mapRef.current) return;
    const { map, L, boundaries } = mapRef.current;
    layerRef.current?.remove();
    const active = new Set(enabledZips || []);
    layerRef.current = L.geoJSON(boundaries, {
      // Only active ZIPs get boundary outlines. Disabled ZIPs retain the base map.
      filter: feature => active.has(feature.properties.zip),
      style: { color: '#f47721', weight: 2, fillColor: '#f47721', fillOpacity: 0.16 },
      onEachFeature(feature, layer) {
        const { zip, label } = feature.properties;
        const tooltip = document.createElement('span'); tooltip.textContent = label;
        layer.bindTooltip(tooltip, { sticky: true });
        layer.on('click', () => selectRef.current?.(zip));
        layer.on('mouseover', () => layer.setStyle({ weight: 3, fillOpacity: .28 }));
        layer.on('mouseout', () => layer.setStyle({ weight: 2, fillOpacity: .16 }));
      },
    }).addTo(map);
  }, [ready, enabledZips]);
  useEffect(() => {
    if (!selectedZip || !mapRef.current) return;
    const { map, L, boundaries } = mapRef.current;
    const feature = boundaries.features.find(f => f.properties.zip === selectedZip);
    if (feature) map.fitBounds(L.geoJSON(feature).getBounds(), { padding: [35,35], maxZoom: 13, animate: false });
  }, [selectedZip, ready]);
  function reset() { const state = mapRef.current; if (state) state.map.fitBounds(state.L.geoJSON(state.boundaries).getBounds(), { padding: [20,20] }); }
  return <div className="coverage-map-frame"><div className="coverage-map-toolbar"><span><i/> Current service area</span><button type="button" onClick={reset} disabled={!ready}>Show whole region ↗</button></div><div ref={container} className="coverage-map" role="region" aria-label="Interactive map showing current Austin-area service coverage"/>{!ready && !error && <p className="map-loading" role="status">Loading the Austin-area map…</p>}{error && <p className="notice error" role="alert">{error}</p>}{tileError && <p className="fine" role="status">Some street-map tiles could not load. Service outlines and the directory remain available.</p>}<p className="map-source">Outlines show approximate service coverage using Census geographic areas, not city limits. Zoom to explore your neighborhood. <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">Report a base-map issue ↗</a></p></div>;
}

