let currentGroup = null;
let protoRoot = null;
let STOP_NAMES = {};
let allStationETAs = {};
let activeTrains = new Set();
async function initProtobuf() {
    if (!protoRoot) {
        protoRoot = await protobuf.load("./api/data/gtfs-realtime.proto");
    }
    return protoRoot;
}
async function loadStopNames() {
    try {
        const response = await fetch('./api/data/stops.txt');
        if (!response.ok) throw new Error('Failed to load stops.txt');
        const text = await response.text();
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const idIndex = headers.indexOf('stop_id');
        const nameIndex = headers.indexOf('stop_name');
        const locationTypeIndex = headers.indexOf('location_type');
        STOP_NAMES = {};
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i]) continue;
            const cols = lines[i].split(',');
            const stopId = cols[idIndex];
            const stopName = cols[nameIndex];
            const locationType = cols[locationTypeIndex];
            if (locationType === '1') {
                STOP_NAMES[stopId] = stopName;
            }
        }
    } catch (error) {
        console.error('Error loading stop names:', error);
    }
}
function formatETA(timestamp) {
    const now = Math.floor(Date.now() / 1000);
    const diff = timestamp - now;
    const minutes = Math.floor(diff / 60);
    if (minutes < 1) return "Arriving";
    if (minutes === 1) return "1 min";
    return `${minutes} mins`;
}
function getStopName(stopId) {
    const cleanId = stopId.replace(/[NS]$/, '');
    return STOP_NAMES[cleanId] || `Stop ${cleanId}`;
}
async function fetchFeedData(group) {
    const root = await initProtobuf();
    const FeedMessage = root.lookupType("transit_realtime.FeedMessage");
    const res = await fetch(`./api/feed.php?group=${group}`);
    if (!res.ok) throw new Error('Failed to fetch feed data');
    const buffer = await res.arrayBuffer();
    const message = FeedMessage.decode(new Uint8Array(buffer));
    const feed = FeedMessage.toObject(message, {
        longs: Number,
        enums: String,
        defaults: true
    });
    return feed;
}
function processFeedData(feed) {
    const stationETAs = {};
    const trains = new Set();
    feed.entity.forEach(entity => {
        if (!entity.tripUpdate) return;
        const trip = entity.tripUpdate.trip;
        const routeId = trip.routeId;
        trains.add(routeId);
        if (!entity.tripUpdate.stopTimeUpdate) return;
        entity.tripUpdate.stopTimeUpdate.forEach(stopTime => {
            const stopId = stopTime.stopId;
            const arrival = stopTime.arrival || stopTime.departure;
            if (!arrival || !arrival.time) return;
            const stationId = stopId.replace(/[NS]$/, '');
            if (!stationETAs[stationId]) {
                stationETAs[stationId] = {
                    name: getStopName(stopId),
                    arrivals: []
                };
            }
            stationETAs[stationId].arrivals.push({
                route: routeId,
                direction: stopId.endsWith('N') ? 'Northbound' : 'Southbound',
                time: arrival.time,
                stopId: stopId
            });
        });
    });
    Object.values(stationETAs).forEach(station => {
        station.arrivals.sort((a, b) => a.time - b.time);
    });
    return { stationETAs, trains: Array.from(trains).sort() };
}
function createTrainFilters(trains) {
    const filterContainer = document.getElementById('trainFilters');
    if (!filterContainer) return;
    activeTrains = new Set(trains);
    filterContainer.innerHTML = trains.map(train => `
        <button class="train-filter active" data-train="${train}">
            ${train}
            <span class="filter-x">×</span>
        </button>
    `).join('');
    filterContainer.querySelectorAll('.train-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const train = btn.dataset.train;
            if (activeTrains.has(train)) {
                activeTrains.delete(train);
                btn.classList.remove('active');
            } else {
                activeTrains.add(train);
                btn.classList.add('active');
            }
            applyFilters();
        });
    });
}
function applyFilters() {
    const searchTerm = document.getElementById('stationSearch').value.toLowerCase();
    const content = document.getElementById('etaContent');
    let filteredStations = {};
    Object.entries(allStationETAs).forEach(([stationId, station]) => {
        if (searchTerm && !station.name.toLowerCase().includes(searchTerm)) {
            return;
        }
        const filteredArrivals = station.arrivals.filter(arrival => 
            activeTrains.has(arrival.route)
        ).slice(0, 5);
        if (filteredArrivals.length > 0) {
            filteredStations[stationId] = {
                ...station,
                arrivals: filteredArrivals
            };
        }
    });
    displayETAs(filteredStations);
}
function displayETAs(stationETAs, cacheTime) {
    const content = document.getElementById('etaContent');
    const cacheInfo = document.getElementById('cacheInfo');
    if (Object.keys(stationETAs).length === 0) {
        content.innerHTML = '<div class="no-data">No trains found matching your filters</div>';
        return;
    }
    let html = '';
    const sortedStations = Object.entries(stationETAs).sort(([a], [b]) => a.localeCompare(b));
    sortedStations.forEach(([stationId, station]) => {
        html += `
            <div class="station-group">
                <div class="station-name">${station.name}</div>
        `;
        station.arrivals.forEach(arrival => {
            html += `
                <div class="eta-item">
                    <div class="eta-info">
                        <div class="route-badge">${arrival.route}</div>
                        <span class="direction">${arrival.direction}</span>
                    </div>
                    <div class="time">${formatETA(arrival.time)}</div>
                </div>
            `;
        });
        html += '</div>';
    });
    content.innerHTML = html;
    if (cacheTime) {
        const age = Math.floor((Date.now() - cacheTime) / 1000);
        cacheInfo.textContent = `Data cached ${age}s ago`;
    }
}
async function loadETAs(group) {
    const content = document.getElementById('etaContent');
    const refreshBtn = document.getElementById('refreshBtn');
    content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading train data...</div>';
    refreshBtn.disabled = true;
    try {
        const feed = await fetchFeedData(group);
        const { stationETAs, trains } = processFeedData(feed);
        allStationETAs = stationETAs;
        createTrainFilters(trains);
        document.getElementById('filtersContainer').style.display = 'block';
        applyFilters();
    } catch (error) {
        content.innerHTML = `<div class="error">Error loading data: ${error.message}</div>`;
    } finally {
        refreshBtn.disabled = false;
    }
}
function selectGroup(group) {
    currentGroup = group;
    document.querySelectorAll('.train-group').forEach(el => {
        el.classList.remove('active');
    });
    document.querySelector(`[data-group="${group}"]`).classList.add('active');
    document.getElementById('etaContainer').classList.add('show');
    document.getElementById('selectedGroup').textContent = group.toUpperCase() + ' Trains';
    document.getElementById('stationSearch').value = '';
    loadETAs(group);
}
function initializeUI() {
    const container = document.getElementById('appContainer');
    const trainGroupsData = [
        { group: 'ace', name: 'ACE', description: '8th Ave Lines' },
        { group: 'g', name: 'G', description: 'Brooklyn-Queens' },
        { group: 'nqrw', name: 'NQRW', description: 'Broadway Lines' },
        { group: '1234567s', name: '1234567S', description: 'East Side & West Side' },
        { group: 'bdfm', name: 'BDFM', description: '6th Ave Lines' },
        { group: 'jz', name: 'JZ', description: 'Nassau St Lines' },
        { group: 'l', name: 'L', description: '14th St-Canarsie' }
    ];
    let trainGroupsHTML = '';
    trainGroupsData.forEach(item => {
        trainGroupsHTML += `
            <div class="train-group" data-group="${item.group}">
                <h2>${item.name}</h2>
                <p>${item.description}</p>
            </div>
        `;
    });
    container.innerHTML = `
        <main>
            <h1>MTA Subway Check</h1>
            <div class="train-groups" id="trainGroups">
                ${trainGroupsHTML}
            </div>
            <div class="eta-container" id="etaContainer">
                <div class="eta-header">
                    <h2 id="selectedGroup"></h2>
                    <button class="refresh-btn" id="refreshBtn">Refresh</button>
                </div>
                <div id="filtersContainer" class="filters-container">
                    <div id="trainFilters" class="train-filters"></div>
                    <input type="text" id="stationSearch" class="station-search" placeholder="Search stations...">
                </div>
                <div id="etaContent"></div>
                <div class="cache-info" id="cacheInfo"></div>
            </div>
        </main>
    `;
    document.querySelectorAll('.train-group').forEach(el => {
        el.addEventListener('click', () => {
            selectGroup(el.dataset.group);
        });
    });
    document.getElementById('refreshBtn').addEventListener('click', () => {
        if (currentGroup) {
            loadETAs(currentGroup);
        }
    });
    document.getElementById('stationSearch').addEventListener('input', () => {
        applyFilters();
    });
    setInterval(() => {
        if (currentGroup) {
            loadETAs(currentGroup);
        }
    }, 30000);
}
document.addEventListener('DOMContentLoaded', async () => {
    await loadStopNames();
    initializeUI();
});