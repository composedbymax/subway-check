let currentGroup = null;
let protoRoot = null;
let STOP_NAMES = {};
let STOPS_DATA = [];
let STATION_TO_GROUPS = {};
let allStationETAs = {};
let activeTrains = new Set();
let searchMode = null;
let currentStationName = null;
let currentStationIds = [];
const TRAIN_TO_GROUP = {
    'A': 'ace', 'C': 'ace', 'E': 'ace', 'H': 'ace',
    'G': 'g',
    'N': 'nqrw', 'Q': 'nqrw', 'R': 'nqrw', 'W': 'nqrw',
    '1': '1234567s', '2': '1234567s', '3': '1234567s', '4': '1234567s', 
    '5': '1234567s', '6': '1234567s', '7': '1234567s', 'S': '1234567s',
    'B': 'bdfm', 'D': 'bdfm', 'F': 'bdfm', 'M': 'bdfm',
    'J': 'jz', 'Z': 'jz',
    'L': 'l'
};
const ALL_GROUPS = ['ace', 'g', 'nqrw', '1234567s', 'bdfm', 'jz', 'l'];
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
        STOPS_DATA = [];
        const uniqueStations = new Map();
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const cols = lines[i].split(',');
            const stopId = cols[idIndex]?.trim();
            const stopName = cols[nameIndex]?.trim();
            const locationType = cols[locationTypeIndex]?.trim();
            if (!stopId || !stopName) continue;
            if (locationType === '1') {
                STOP_NAMES[stopId] = stopName;
                if (!uniqueStations.has(stopName)) {
                    uniqueStations.set(stopName, stopId);
                    STOPS_DATA.push({ id: stopId, name: stopName });
                }
            }
        }
    } catch (error) {
        console.error('Error loading stop names:', error);
    }
}
async function loadOrBuildStationMapping() {
    try {
        const response = await fetch('./api/mapping.php');
        const data = await response.json();
        if (data.mapping && Object.keys(data.mapping).length > 0) {
            STATION_TO_GROUPS = data.mapping;
            return true;
        }
        return await buildAndSaveMapping();
    } catch (error) {
        console.error('Error loading station mapping:', error);
        return await buildAndSuildMapping();
    }
}
async function buildAndSaveMapping() {
    const statusDiv = document.getElementById('mappingStatus');
    if (statusDiv) {
        statusDiv.style.display = 'block';
    }
    const stationMapping = {};
    for (let i = 0; i < ALL_GROUPS.length; i++) {
        const group = ALL_GROUPS[i];
        if (statusDiv) {
            statusDiv.textContent = `Building station mapping... (${i + 1}/${ALL_GROUPS.length}) - ${group.toUpperCase()}`;
        }
        try {
            const feed = await fetchFeedData(group);
            const stationsInFeed = new Set();
            feed.entity.forEach(entity => {
                if (!entity.tripUpdate || !entity.tripUpdate.stopTimeUpdate) return;
                entity.tripUpdate.stopTimeUpdate.forEach(stopTime => {
                    const stopId = stopTime.stopId;
                    const cleanStopId = stopId.replace(/[NS]$/, '');
                    const stationName = STOP_NAMES[cleanStopId];
                    if (stationName) {
                        stationsInFeed.add(stationName);
                    }
                });
            });
            stationsInFeed.forEach(stationName => {
                if (!stationMapping[stationName]) {
                    stationMapping[stationName] = [];
                }
                if (!stationMapping[stationName].includes(group)) {
                    stationMapping[stationName].push(group);
                }
            });
        } catch (error) {
            console.error(`Error processing group ${group}:`, error);
        }
    }
    STATION_TO_GROUPS = stationMapping;
    try {
        await fetch('./api/mapping.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ mapping: stationMapping })
        });
    } catch (error) {
        console.error('Error saving mapping to server:', error);
    }
    if (statusDiv) {
        statusDiv.style.display = 'none';
    }
    return true;
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
function processFeedData(feed, targetStationIds = null) {
    const stationETAs = {};
    const trains = new Set();
    feed.entity.forEach(entity => {
        if (!entity.tripUpdate) return;
        const trip = entity.tripUpdate.trip;
        const routeId = trip.routeId;
        trains.add(routeId);
        if (!entity.tripUpdate.stopTimeUpdate) return;
        const stops = entity.tripUpdate.stopTimeUpdate.map(st => st.stopId);
        const lastStop = stops[stops.length - 1];
        entity.tripUpdate.stopTimeUpdate.forEach(stopTime => {
            const stopId = stopTime.stopId;
            const arrival = stopTime.arrival || stopTime.departure;
            if (!arrival || !arrival.time) return;
            const stationId = stopId.replace(/[NS]$/, '');
            if (targetStationIds && !targetStationIds.includes(stationId)) {
                return;
            }
            if (!stationETAs[stationId]) {
                stationETAs[stationId] = {
                    name: getStopName(stopId),
                    arrivals: []
                };
            }
            const direction = getStopName(lastStop);
            stationETAs[stationId].arrivals.push({
                route: routeId,
                direction,
                time: arrival.time,
                stopId
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
    if (activeTrains.size === 0) {
        activeTrains = new Set(trains);
    }
    filterContainer.innerHTML = trains.map(train => {
        const isActive = activeTrains.has(train);
        return `
            <button class="train-filter ${isActive ? 'active' : ''}" data-train="${train}">
                ${train}
                <span class="filter-x">×</span>
            </button>
        `;
    }).join('');
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
    const searchTerm = document.getElementById('stationSearchFilter').value.toLowerCase();
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
function displayETAs(stationETAs) {
    const content = document.getElementById('etaContent');
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
async function loadStationData(stationName) {
    const content = document.getElementById('etaContent');
    const refreshBtn = document.getElementById('refreshBtn');
    content.innerHTML = '<div class="loading"><div class="spinner"></div>Loading station data...</div>';
    refreshBtn.disabled = true;
    currentStationName = stationName;
    try {
        const groupsToLoad = STATION_TO_GROUPS[stationName] || [];
        if (groupsToLoad.length === 0) {
            content.innerHTML = '<div class="error">No trains found for this station</div>';
            refreshBtn.disabled = false;
            return;
        }
        currentStationIds = Object.entries(STOP_NAMES)
            .filter(([id, name]) => name === stationName)
            .map(([id]) => id);

        allStationETAs = {};
        const allTrains = new Set();
        for (let i = 0; i < groupsToLoad.length; i++) {
            const group = groupsToLoad[i];
            content.innerHTML = `<div class="loading"><div class="spinner"></div>Loading ${group.toUpperCase()} trains... (${i + 1}/${groupsToLoad.length})</div>`;
            const feed = await fetchFeedData(group);
            const { stationETAs, trains } = processFeedData(feed, currentStationIds);
            Object.entries(stationETAs).forEach(([stopId, data]) => {
                if (currentStationIds.includes(stopId)) {
                    if (!allStationETAs[stopId]) {
                        allStationETAs[stopId] = { 
                            name: data.name, 
                            arrivals: [] 
                        };
                    }
                    allStationETAs[stopId].arrivals.push(...data.arrivals);
                }
            });
            trains.forEach(t => allTrains.add(t));
        }
        Object.values(allStationETAs).forEach(station => {
            station.arrivals.sort((a, b) => a.time - b.time);
        });
        createTrainFilters(Array.from(allTrains).sort());
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
    searchMode = 'train';
    currentStationName = null;
    currentStationIds = [];
    document.querySelectorAll('.train-group').forEach(el => {
        el.classList.remove('active');
    });
    document.querySelector(`[data-group="${group}"]`).classList.add('active');
    document.getElementById('etaContainer').classList.add('show');
    document.getElementById('selectedGroup').textContent = group.toUpperCase() + ' Trains';
    document.getElementById('stationSearchFilter').value = '';
    loadETAs(group);
}
function setupMainSearch() {
    const mainSearch = document.getElementById('mainSearch');
    const searchResults = document.getElementById('searchResults');
    const trainGroups = document.getElementById('trainGroups');
    mainSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (!query) {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
            trainGroups.style.display = 'grid';
            return;
        }
        trainGroups.style.display = 'none';
        searchResults.style.display = 'block';
        const trainMatches = [];
        const stationMatches = [];
        Object.keys(TRAIN_TO_GROUP).forEach(train => {
            if (train.toLowerCase().includes(query)) {
                trainMatches.push(train);
            }
        });
        STOPS_DATA.forEach(stop => {
            if (stop.name.toLowerCase().includes(query)) {
                stationMatches.push(stop);
            }
        });
        let html = '';
        if (trainMatches.length > 0) {
            html += '<div class="search-section"><h3>Trains</h3>';
            trainMatches.slice(0, 5).forEach(train => {
                html += `<div class="search-result" data-type="train" data-value="${train}">
                    <div class="route-badge">${train}</div>
                    <span>${train} Train</span>
                </div>`;
            });
            html += '</div>';
        }
        if (stationMatches.length > 0) {
            html += '<div class="search-section"><h3>Stations</h3>';
            stationMatches.slice(0, 10).forEach(station => {
                const groups = STATION_TO_GROUPS[station.name] || [];
                const groupText = groups.length > 0 ? ` · ${groups.join(', ').toUpperCase()}` : '';
                html += `<div class="search-result" data-type="station" data-value="${station.name}">
                    <span>${station.name}<span style="opacity: 0.6">${groupText}</span></span>
                </div>`;
            });
            html += '</div>';
        }
        if (trainMatches.length === 0 && stationMatches.length === 0) {
            html = '<div class="no-data">No results found</div>';
        }
        searchResults.innerHTML = html;
        searchResults.querySelectorAll('.search-result').forEach(result => {
            result.addEventListener('click', () => {
                const type = result.dataset.type;
                const value = result.dataset.value;
                mainSearch.value = '';
                searchResults.innerHTML = '';
                searchResults.style.display = 'none';
                trainGroups.style.display = 'grid';
                if (type === 'train') {
                    handleTrainSearch(value);
                } else if (type === 'station') {
                    handleStationSearch(value);
                }
            });
        });
    });
}
function handleTrainSearch(train) {
    const group = TRAIN_TO_GROUP[train];
    searchMode = 'train';
    currentGroup = group;
    currentStationName = null;
    currentStationIds = [];
    document.querySelectorAll('.train-group').forEach(el => {
        el.classList.remove('active');
    });
    document.querySelector(`[data-group="${group}"]`).classList.add('active');
    document.getElementById('etaContainer').classList.add('show');
    document.getElementById('selectedGroup').textContent = `${train} Train`;
    document.getElementById('stationSearchFilter').value = '';
    loadETAs(group).then(() => {
        activeTrains.clear();
        activeTrains.add(train);
        document.querySelectorAll('.train-filter').forEach(btn => {
            if (btn.dataset.train === train) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        applyFilters();
    });
}
function handleStationSearch(stationName) {
    searchMode = 'station';
    currentGroup = null;
    document.querySelectorAll('.train-group').forEach(el => {
        el.classList.remove('active');
    });
    document.getElementById('etaContainer').classList.add('show');
    document.getElementById('selectedGroup').textContent = stationName;
    document.getElementById('stationSearchFilter').value = '';
    loadStationData(stationName);
}
function initializeUI() {
    const container = document.getElementById('subwayCheck');
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
        <div id="mappingStatus" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.9); color: white; padding: 30px; border-radius: 12px; z-index: 1000; font-size: 1.2rem; text-align: center;"></div>
        <h1>MTA Subway Check</h1>
        <div class="main-search-container">
            <input type="text" id="mainSearch" class="main-search" placeholder="Search for trains or stations...">
            <div id="searchResults" class="search-results"></div>
        </div>
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
                <input type="text" id="stationSearchFilter" class="station-search" placeholder="Filter stations...">
            </div>
            <div id="etaContent"></div>
        </div>
    `;
    document.querySelectorAll('.train-group').forEach(el => {
        el.addEventListener('click', () => {
            selectGroup(el.dataset.group);
        });
    });
    document.getElementById('refreshBtn').addEventListener('click', () => {
        if (searchMode === 'train' && currentGroup) {
            loadETAs(currentGroup);
        } else if (searchMode === 'station' && currentStationName) {
            loadStationData(currentStationName);
        }
    });
    document.getElementById('stationSearchFilter').addEventListener('input', () => {
        applyFilters();
    });
    setupMainSearch();
    setInterval(() => {
        if (searchMode === 'train' && currentGroup) {
            loadETAs(currentGroup);
        } else if (searchMode === 'station' && currentStationName) {
            loadStationData(currentStationName);
        }
    }, 30000);
}
document.addEventListener('DOMContentLoaded', async () => {
    await loadStopNames();
    await loadOrBuildStationMapping();
    initializeUI();
});