(function() {
  'use strict';
  const LOCATION_SVG = `<svg class="location-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M16.114-0.011c-6.559 0-12.114 5.587-12.114 12.204 0 6.93 6.439 14.017 10.77 18.998 0.017 0.020 0.717 0.797 1.579 0.797h0.076c0.863 0 1.558-0.777 1.575-0.797 4.064-4.672 10-12.377 10-18.998 0-6.618-4.333-12.204-11.886-12.204zM16.515 29.849c-0.035 0.035-0.086 0.074-0.131 0.107-0.046-0.032-0.096-0.072-0.133-0.107l-0.523-0.602c-4.106-4.71-9.729-11.161-9.729-17.055 0-5.532 4.632-10.205 10.114-10.205 6.829 0 9.886 5.125 9.886 10.205 0 4.474-3.192 10.416-9.485 17.657zM16.035 6.044c-3.313 0-6 2.686-6 6s2.687 6 6 6 6-2.687 6-6-2.686-6-6-6zM16.035 16.044c-2.206 0-4.046-1.838-4.046-4.044s1.794-4 4-4c2.207 0 4 1.794 4 4 0.001 2.206-1.747 4.044-3.954 4.044z"/></svg>`;
  let maplibreLoaded = false;
  let mapInstance = null;
  let modalOverlay = null;
  let onStationSelectCallback = null;
  function addLocationButton(inputElement) {
    let container = inputElement.parentElement;
    if (container.querySelector('.location-btn')) return;
    const button = document.createElement('div');
    button.className = 'location-btn';
    button.innerHTML = LOCATION_SVG;
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      openMapModal(inputElement);
    });
    if (container.classList.contains('main-search-container')) {
      container.appendChild(button);
    } else {
      const wrapper = document.createElement('div');
      wrapper.className = 'location-input-wrapper';
      container.insertBefore(wrapper, inputElement);
      wrapper.appendChild(inputElement);
      wrapper.appendChild(button);
    }
  }
  async function loadMapLibre() {
    if (maplibreLoaded) return;
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'assets/css/maplibre-gl.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'assets/scripts/maplibre-gl.js';
      script.onload = () => {
        maplibreLoaded = true;
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  async function fetchStopsData() {
    const response = await fetch('./api/data/stops.txt');
    const text = await response.text();
    const lines = text.split(/\r?\n/);
    const stops = lines
      .map(line => line.trim())
      .filter(line => line.length > 0 && !/^stop_id\s*,/i.test(line))
      .map(line => {
        const fields = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
        const clean = f => (f ? f.replace(/^"(.*)"$/, "$1").replace(/""/g, '"').trim() : "");
        const stop_id = clean(fields[0]);
        const stop_name = clean(fields[1]);
        const stop_lat = clean(fields[2]);
        const stop_lon = clean(fields[3]);
        const location_type = clean(fields[4]);
        const lat = parseFloat(stop_lat);
        const lon = parseFloat(stop_lon);
        return {
          stop_id: stop_id || null,
          stop_name: stop_name || null,
          stop_lat: Number.isFinite(lat) ? lat : null,
          stop_lon: Number.isFinite(lon) ? lon : null,
          location_type: location_type
        };
      })
      .filter(s => s.stop_id && s.location_type === '1');
    return stops;
  }
  function createModalOverlay() {
    modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    const mapContainer = document.createElement('div');
    mapContainer.className = 'modal-container';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close-btn';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', closeMapModal);
    const mapDiv = document.createElement('div');
    mapDiv.id = 'mapSelector';
    mapDiv.className = 'modal-map';
    mapContainer.appendChild(closeBtn);
    mapContainer.appendChild(mapDiv);
    modalOverlay.appendChild(mapContainer);
    document.body.appendChild(modalOverlay);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeMapModal();
    });
    return mapDiv;
  }
  async function initializeMap(mapDiv) {
    const middleOfNYC = [-73.935242, 40.73061];
    mapInstance = new maplibregl.Map({
      style: "api/data/dark.json",
      center: middleOfNYC,
      zoom: 10,
      container: mapDiv,
      maxZoom: 14,
      minZoom: 8,
      maxBounds: [
        [-74.5, 40.3],
        [-73.4, 41.2],
      ],
    });
    const stopsData = await fetchStopsData();
    mapInstance.on('load', () => {
      stopsData.forEach(stop => {
        if (stop.stop_lat && stop.stop_lon) {
          const marker = new maplibregl.Marker({ color: '#1e88e5' })
            .setLngLat([stop.stop_lon, stop.stop_lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25 })
                .setHTML(`
                  <div class="map-popup">
                    <strong class="map-popup-title">${stop.stop_name}</strong>
                    <button class="map-popup-btn" data-station="${stop.stop_name.replace(/"/g, '&quot;')}">Select Station</button>
                  </div>
                `)
            )
            .addTo(mapInstance);
          marker.getElement().addEventListener('click', () => {
            selectStation(stop.stop_name);
          });
        }
      });
    });
  }
  async function openMapModal(inputElement) {
    onStationSelectCallback = (stationName) => {
      if (inputElement.id === 'mainSearch') {
        inputElement.value = stationName;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        setTimeout(() => {
          const result = document.querySelector(`.search-result[data-type="station"][data-value="${stationName}"]`);
          if (result) result.click();
        }, 100);
      } else if (inputElement.id === 'stationSearchFilter') {
        inputElement.value = stationName;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };
    try {
      await loadMapLibre();
      const mapDiv = createModalOverlay();
      await initializeMap(mapDiv);
    } catch (error) {
      console.error('Error loading map:', error);
      alert('Failed to load map. Please try again.');
    }
  }
  function closeMapModal() {
    if (modalOverlay) {
      if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
      }
      modalOverlay.remove();
      modalOverlay = null;
    }
    onStationSelectCallback = null;
  }
  function selectStation(stationName) {
    if (onStationSelectCallback) {
      onStationSelectCallback(stationName);
    }
    closeMapModal();
  }
  window.selectMapStation = selectStation;
  function init() {
    const addButtons = () => {
      const mainSearch = document.getElementById('mainSearch');
      if (mainSearch && !mainSearch.parentElement.querySelector('.location-btn')) {
        addLocationButton(mainSearch);
      }
      const filter = document.getElementById('stationSearchFilter');
      if (filter && !filter.closest('.location-input-wrapper') && !filter.parentElement.querySelector('.location-btn')) {
        addLocationButton(filter);
      }
    };
    addButtons();
    const observer = new MutationObserver(addButtons);
    observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();