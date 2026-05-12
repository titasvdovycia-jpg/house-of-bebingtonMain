/**
 * UK Chess Directory — Seed Data
 * Clubs include contact info; Events include duration & registration URLs
 */

const getClubs = () => (window.chessClubs && window.chessClubs.length > 0) ? window.chessClubs : [
    {
        id: 200,
        name: "Battersea Chess Club (Fallback)",
        lat: 51.465,
        lng: -0.165,
        address: "Battersea Labor Club, London",
        lmsId: "UK-200",
        ratingType: ["ECF"],
        avgRating: 1600,
        ageGroups: ["Adult", "Senior"],
        description: "An active chess club in London.",
        website: "",
        county: "London",
        events: []
    }
];

const getEvents = () => window.chessEvents || [];



// ─── Utility Helpers ────────────────────────────────────────────────────────

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Radius of the earth in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    return R * c;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function eventDuration(startDate, endDate) {
    if (!startDate || !endDate) return '';
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const days = Math.round((end - start) / 86400000) + 1;
    if (days <= 1) return '1 Day';
    return `${days} Days`;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 3958.8; // Radius of the Earth in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in miles
}

function getDrivingDistance(startLat, startLng, endLat, endLng, callback) {
    if (!L.Routing || !L.Routing.osrmv1) {
        callback(null);
        return;
    }
    const router = L.Routing.osrmv1();
    router.route([
        {latLng: L.latLng(startLat, startLng)},
        {latLng: L.latLng(endLat, endLng)}
    ], function(err, routes) {
        if (!err && routes.length > 0) {
            callback(routes[0].summary.totalDistance); // in meters
        } else {
            callback(null);
        }
    });
}

function eventTypeColor(type) {
    const map = {
        'Congress':     'bg-blue-600',
        'Championship': 'bg-purple-600',
        'Grand Prix':   'bg-indigo-600',
        'Tournament':   'bg-cyan-700',
        'Rapid':        'bg-orange-500',
        'Blitz':        'bg-red-500',
        'Junior':       'bg-green-600',
    };
    return map[type] || 'bg-slate-600';
}

function ratingBadge(rt) {
    if (rt === 'FIDE') return '<span class="badge-fide">FIDE</span>';
    if (rt === 'ECF')  return '<span class="badge-ecf">ECF</span>';
    return '<span class="badge-none">Fun</span>';
}

function makeTileLayer() {
    return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    });
}

function makeMarkerIcon() {
    return L.divIcon({
        className: 'chess-marker',
        html: `<div class="marker-inner"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });
}

// ─── Main App ───────────────────────────────────────────────────────────────

class ChessApp {
    constructor() {
        this.currentPage = 'clubs';
        this.heroMode = 'clubs';
        this.userLocation = null;

        // Map instances
        this.clubsMap    = null;
        this.eventsMap   = null;
        this.clubMarkers  = [];
        this.eventMarkers = [];
        this.routingControl = null;

        // Filter state
        this.clubFilters = {
            search: '',
            county: ''
        };
        this.eventFilters = {
            search: '',
            county: '',
            type: '',
            ecf: true,
            fide: true,
            unrated: true,
            dateFrom: ''
        };

        this.init();
    }

    init() {
        try {
            if (typeof window.loadChessData === 'function') {
                window.loadChessData();
            }
            console.log("window.chessClubs on init:", window.chessClubs);
            if (window.lucide) window.lucide.createIcons();
            this.initHeroUI();
            this.initNavbarEffect();
            this.populateCountyDropdowns();

            // Mobile menu
            document.getElementById('mobile-menu-btn').onclick = () => {
                document.getElementById('mobile-menu').classList.toggle('hidden');
            };

            // Set today as default date-from for events
            const today = new Date().toISOString().split('T')[0];
            const df = document.getElementById('events-date-from');
            if (df) df.value = today;
            this.eventFilters.dateFrom = today;

            // Init checkbox state
            this.syncCheckboxes();
            this.wireLabelCheckboxes();

            // Start on clubs page and locate
            this.showPage('clubs');
            this.locateUser('clubs');

            // Foolproof resize loop to guarantee map never gets stuck at 0x0
            setInterval(() => {
                if (this.clubsMap) this.clubsMap.invalidateSize(false);
                if (this.eventsMap) this.eventsMap.invalidateSize(false);
            }, 1000);
        } catch (error) {
            console.error("Error in init():", error);
        }
    }

    syncCheckboxes() {
        // Init visual state from checkbox state for all custom checkboxes
        document.querySelectorAll('input[type="checkbox"].hidden').forEach(cb => {
            this.updateCheckboxVisual(cb);
        });
    }

    updateCheckboxVisual(cb) {
        const box = cb.nextElementSibling;
        if (!box) return;
        const dot = box.querySelector('.check-indicator');
        if (dot) dot.classList.toggle('hidden', !cb.checked);
        box.classList.toggle('border-blue-500', cb.checked);
    }

    // Handle checkbox clicks via label — wire up visual
    wireLabelCheckboxes() {
        document.querySelectorAll('input[type="checkbox"].hidden').forEach(cb => {
            cb.addEventListener('change', () => this.updateCheckboxVisual(cb));
        });
    }

    initNavbarEffect() {
        const nav = document.getElementById('navbar');
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                nav.classList.add('bg-slate-950', 'border-white/10', 'py-4', 'shadow-lg');
                nav.classList.remove('py-6');
            } else {
                nav.classList.remove('bg-slate-950', 'border-white/10', 'py-4', 'shadow-lg');
                nav.classList.add('py-6');
            }
        });
    }

    initHeroUI() {
        // Render chessboard squares
        const board = document.getElementById('hero-chessboard');
        if (board) {
            board.innerHTML = '';
            for (let i = 0; i < 64; i++) {
                const sq = document.createElement('div');
                sq.className = `w-[12.5%] h-[12.5%] border border-white/5 ${((Math.floor(i / 8) + i) % 2 === 0) ? 'bg-white/10' : 'bg-transparent'}`;
                board.appendChild(sq);
            }
        }
        this.updateTrendingTags();
    }

    updateTrendingTags() {
        const trendingClubs  = ["Bebington", "Liverpool", "Battersea", "Edinburgh", "Manchester"];
        const trendingEvents = ["British Champs", "Isle of Man", "Yorkshire", "London Classic"];
        const tags = this.heroMode === 'clubs' ? trendingClubs : trendingEvents;

        const container = document.getElementById('trending-tags');
        if (!container) return;
        container.innerHTML = '';
        tags.forEach(tag => {
            const btn = document.createElement('button');
            btn.className = "px-4 py-1.5 border border-white/20 text-sm text-gray-300 hover:bg-blue-600 hover:border-blue-600 hover:text-white transition-all rounded-sm backdrop-blur-sm";
            btn.textContent = tag;
            btn.onclick = () => {
                document.getElementById('main-search-input').value = tag;
                this.heroSearch();
            };
            container.appendChild(btn);
        });
    }

    setHeroMode(mode) {
        this.heroMode = mode;
        const clubBtn  = document.getElementById('mode-clubs');
        const evtBtn   = document.getElementById('mode-events');
        const input    = document.getElementById('main-search-input');
        const iconEl   = document.getElementById('search-icon');

        if (mode === 'clubs') {
            clubBtn.classList.add('bg-blue-600', 'text-white', 'shadow-md');
            clubBtn.classList.remove('bg-transparent', 'text-gray-500');
            evtBtn.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
            evtBtn.classList.add('bg-transparent', 'text-gray-500');
            input.placeholder = "Search by city, county, or club name…";
            iconEl.innerHTML  = '<i data-lucide="map-pin" class="w-6 h-6"></i>';
        } else {
            evtBtn.classList.add('bg-blue-600', 'text-white', 'shadow-md');
            evtBtn.classList.remove('bg-transparent', 'text-gray-500');
            clubBtn.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
            clubBtn.classList.add('bg-transparent', 'text-gray-500');
            input.placeholder = "Search rapidplays, congresses, or locations…";
            iconEl.innerHTML  = '<i data-lucide="calendar" class="w-6 h-6"></i>';
        }
        window.lucide.createIcons();
        this.updateTrendingTags();
    }

    heroSearch() {
        const query = document.getElementById('main-search-input').value.toLowerCase().trim();
        if (this.heroMode === 'clubs') {
            this.showPage('clubs');
            if (query) {
                document.getElementById('clubs-search').value = query;
                this.clubFilters.search = query;
            }
            this.filterClubs();
        } else {
            this.showPage('events');
            if (query) {
                document.getElementById('events-search').value = query;
                this.eventFilters.search = query;
            }
            this.filterEvents();
        }
    }

    // ─── PAGE NAVIGATION ──────────────────────────────────────────────────

    showPage(page) {
        // Hide all pages
        document.getElementById('page-home').classList.add('hidden');
        document.getElementById('page-clubs').classList.add('hidden');
        document.getElementById('page-events').classList.add('hidden');
        document.getElementById('main-footer').classList.add('hidden');

        // Reset nav link active states
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('text-blue-400', 'font-bold'));

        if (page === 'home') {
            document.getElementById('page-home').classList.remove('hidden');
            document.getElementById('main-footer').classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (page === 'clubs') {
            document.getElementById('page-clubs').classList.remove('hidden');
            document.getElementById('nav-clubs').classList.add('text-blue-400', 'font-bold');
            window.scrollTo({ top: 0 });
            this.initClubsMap();
        } else if (page === 'events') {
            document.getElementById('page-events').classList.remove('hidden');
            document.getElementById('nav-events').classList.add('text-blue-400', 'font-bold');
            window.scrollTo({ top: 0 });
            this.initEventsMap();
        } else if (page === 'rankings') {
            alert('Rankings feature coming soon! We are aggregating 2024/25 league performance data.');
            return;
        }

        this.currentPage = page;
        if (window.lucide) window.lucide.createIcons();
    }

    // ─── CLUBS PAGE ───────────────────────────────────────────────────────

    initClubsMap() {
        if (this.clubsMap) {
            setTimeout(() => this.clubsMap.invalidateSize(), 50);
            this.renderClubMarkers();
            return;
        }
        this.clubsMap = L.map('map-clubs', { zoomControl: true, attributionControl: false })
            .setView([54.5, -3], 6);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
        }).addTo(this.clubsMap);

        setTimeout(() => this.clubsMap.invalidateSize(), 500);
        this.filterClubs();
    }

    populateCountyDropdowns() {
        const clubCounties  = [...new Set(getClubs().map(c => c.county).filter(Boolean))].sort();
        const eventCounties = [...new Set(chessEvents.map(e => e.county).filter(Boolean))].sort();

        const cc = document.getElementById('clubs-county');
        clubCounties.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            cc.appendChild(opt);
        });

        const ec = document.getElementById('events-county');
        eventCounties.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            ec.appendChild(opt);
        });
    }

    updateClubsRating() {
        let rmin = parseInt(document.getElementById('clubs-rating-min').value);
        let rmax = parseInt(document.getElementById('clubs-rating-max').value);
        if (rmin > rmax - 50) { rmin = rmax - 50; document.getElementById('clubs-rating-min').value = rmin; }
        this.clubFilters.ratingMin = rmin;
        this.clubFilters.ratingMax = rmax;
        document.getElementById('clubs-rating-min-val').textContent = rmin;
        document.getElementById('clubs-rating-max-val').textContent = rmax;

        const track = document.querySelector('.clubs-slider-track');
        if (track) {
            track.style.left  = (rmin / 3000) * 100 + '%';
            track.style.width = ((rmax - rmin) / 3000) * 100 + '%';
        }
        this.filterClubs();
    }

    filterClubs() {
        this.clubFilters.search  = (document.getElementById('clubs-search')?.value || '').toLowerCase();
        this.clubFilters.county  = document.getElementById('clubs-county')?.value  || '';
 
        let filtered = getClubs().filter(c => this.clubMatchesFilters(c));

        // Sort by distance if location available
        if (this.userLocation) {
            filtered.sort((a, b) => {
                const distA = calculateDistance(this.userLocation.lat, this.userLocation.lng, a.lat, a.lng);
                const distB = calculateDistance(this.userLocation.lat, this.userLocation.lng, b.lat, b.lng);
                return distA - distB;
            });
        }

        this.renderClubList(filtered);
        this.renderClubMarkers(filtered);

        const count = document.getElementById('clubs-count');
        if (count) count.textContent = `Showing ${filtered.length} of ${getClubs().length} clubs`;
    }

    clubMatchesFilters(club) {
        const f = this.clubFilters;
        if (f.search) {
            const haystack = [club.name, club.county, club.address, club.description].join(' ').toLowerCase();
            if (!haystack.includes(f.search)) return false;
        }
        if (f.county && club.county !== f.county) return false;
        return true;
    }

    renderClubList(clubs) {
        const list = document.getElementById('clubs-list');
        if (!list) return;
        list.innerHTML = '';

        if (clubs.length === 0) {
            list.innerHTML = '<p class="text-[10px] text-gray-500 uppercase tracking-widest text-center mt-8 px-4">No clubs match your filters.</p>';
            return;
        }

        clubs.forEach((club, index) => {
            const dist = this.userLocation ? calculateDistance(this.userLocation.lat, this.userLocation.lng, club.lat, club.lng) : null;
            const card = document.createElement('div');
            card.className = 'club-card p-4 bg-white/5 border border-white/10 rounded-sm cursor-pointer hover:border-blue-500 hover:bg-white/8 transition-all group';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-sm font-bold text-white group-hover:text-blue-400 leading-tight pr-2">${club.name}</h3>
                    <span class="text-[9px] text-gray-500 shrink-0">${club.lmsId}</span>
                </div>
                <p class="text-[10px] text-gray-500 mb-2 leading-relaxed">${club.address}</p>
                ${dist !== null ? `
                <div class="flex items-center gap-2 mb-3">
                    <span class="distance-tag text-[10px] bg-slate-900 border border-white/10 px-2 py-0.5 rounded-sm"><i data-lucide="navigation" class="w-2 h-2 inline mr-1 text-blue-400"></i>${dist.toFixed(1)} mi</span>
                </div>` : ''}
                <div class="flex flex-wrap gap-1 mb-3">
                    ${club.ratingType.map(rt => ratingBadge(rt)).join('')}
                    ${club.ageGroups.map(ag => `<span class="badge-age">${ag}</span>`).join('')}
                </div>
                <div class="space-y-1 text-[10px] text-gray-500">
                    ${club.meetingInfo ? `<div class="flex items-center gap-1.5"><span class="text-blue-400">●</span>${club.meetingInfo}</div>` : ''}
                    ${club.phone      ? `<div class="flex items-center gap-1.5">📞 ${club.phone}</div>` : ''}
                    ${club.email      ? `<div class="flex items-center gap-1.5 truncate">✉ <a href="mailto:${club.email}" class="hover:text-blue-400 truncate" onclick="event.stopPropagation()">${club.email}</a></div>` : ''}
                    ${club.website    ? `<div class="flex items-center gap-1.5">🌐 <a href="${club.website}" target="_blank" class="hover:text-blue-400 underline truncate" onclick="event.stopPropagation()">${club.website.replace('https://', '')}</a></div>` : ''}
                </div>
            `;
            
            // Async driving distance for top 5
            if (this.userLocation && index < 5) {
                getDrivingDistance(this.userLocation.lat, this.userLocation.lng, club.lat, club.lng, (drivingDist) => {
                    if (drivingDist !== null) {
                        const miles = drivingDist / 1609.34;
                        const distEl = card.querySelector('.distance-tag');
                        if (distEl) {
                            distEl.innerHTML = `<i data-lucide="car" class="w-3 h-3 inline mr-1 text-orange-400"></i>${miles.toFixed(1)} mi (Drive)`;
                            if (window.lucide) window.lucide.createIcons();
                        }
                    }
                });
            }

            card.onclick = () => this.focusClubOnMap(club);
            list.appendChild(card);
        });
    }

    renderClubMarkers(clubs) {
        if (!this.clubsMap) return;
        // Remove old markers
        this.clubMarkers.forEach(m => this.clubsMap.removeLayer(m));
        this.clubMarkers = [];

        const data = clubs || chessClubs;
        data.forEach(club => {
            const marker = L.marker([club.lat, club.lng], { icon: makeMarkerIcon() });
            marker.bindPopup(this.buildClubPopup(club));
            marker.addTo(this.clubsMap);
            marker._clubId = club.id;
            this.clubMarkers.push(marker);
        });

        if (data.length > 0 && data.length < chessClubs.length) {
            // Fit map to markers
            const group = L.featureGroup(this.clubMarkers);
            this.clubsMap.fitBounds(group.getBounds().pad(0.2));
        }
    }

    buildClubPopup(club) {
        return `
            <div class="popup-content">
                <h3>${club.name}</h3>
                <p><strong style="color:#94a3b8">Address:</strong> ${club.address}</p>
                ${club.phone   ? `<p>📞 ${club.phone}</p>` : ''}
                ${club.email   ? `<p>✉ <a href="mailto:${club.email}" style="color:#e87c3e">${club.email}</a></p>` : ''}
                ${club.website ? `<p>🌐 <a href="${club.website}" target="_blank" style="color:#e87c3e">${club.website.replace('https://','')}</a></p>` : ''}
                ${club.meetingInfo ? `<p>🕐 ${club.meetingInfo}</p>` : ''}
            </div>`;
    }

    focusClubOnMap(club) {
        if (!this.clubsMap) return;
        this.clubsMap.setView([club.lat, club.lng], 14);
        const marker = this.clubMarkers.find(m => m._clubId === club.id);
        if (marker) marker.openPopup();

        // Draw route if user location is available
        if (this.userLocation && window.L && L.Routing) {
            if (this.routingControl) {
                this.clubsMap.removeControl(this.routingControl);
            }
            this.routingControl = L.Routing.control({
                waypoints: [
                    L.latLng(this.userLocation.lat, this.userLocation.lng),
                    L.latLng(club.lat, club.lng)
                ],
                routeWhileDragging: false,
                addWaypoints: false,
                draggableWaypoints: false,
                fitSelectedRoutes: false,
                show: false
            }).addTo(this.clubsMap);
        }
    }

    // ─── EVENTS PAGE ──────────────────────────────────────────────────────

    initEventsMap() {
        if (this.eventsMap) {
            setTimeout(() => this.eventsMap.invalidateSize(), 50);
            this.renderEventMarkers();
            return;
        }
        this.eventsMap = L.map('map-events', { zoomControl: true, attributionControl: false })
            .setView([54.5, -3], 6);
        makeTileLayer().addTo(this.eventsMap);

        // Set date-from default to today
        const today = new Date().toISOString().split('T')[0];
        const df = document.getElementById('events-date-from');
        if (df && !df.value) { df.value = today; this.eventFilters.dateFrom = today; }

        setTimeout(() => this.eventsMap.invalidateSize(), 500);
        this.filterEvents();
    }

    filterEvents() {
        this.eventFilters.search   = (document.getElementById('events-search')?.value || '').toLowerCase();
        this.eventFilters.county   = document.getElementById('events-county')?.value  || '';
        this.eventFilters.type     = document.getElementById('events-type')?.value    || '';
        this.eventFilters.ecf      = document.getElementById('events-filter-ecf')?.checked    ?? true;
        this.eventFilters.fide     = document.getElementById('events-filter-fide')?.checked   ?? true;
        this.eventFilters.unrated  = document.getElementById('events-filter-unrated')?.checked ?? true;
        this.eventFilters.dateFrom = document.getElementById('events-date-from')?.value || '';

        // Sync checkbox visuals
        ['events-filter-ecf', 'events-filter-fide', 'events-filter-unrated'].forEach(id => {
            const cb = document.getElementById(id);
            if (cb) this.updateCheckboxVisual(cb);
        });

        const sortedByDate = [...chessEvents].sort((a, b) => a.startDate.localeCompare(b.startDate));
        let filtered = sortedByDate.filter(ev => this.eventMatchesFilters(ev));

        if (this.userLocation) {
            filtered.sort((a, b) => {
                const distA = calculateDistance(this.userLocation.lat, this.userLocation.lng, a.lat, a.lng);
                const distB = calculateDistance(this.userLocation.lat, this.userLocation.lng, b.lat, b.lng);
                return distA - distB;
            });
        }

        this.renderEventList(filtered);
        this.renderEventMarkers(filtered);

        const count = document.getElementById('events-count');
        if (count) count.textContent = `Showing ${filtered.length} of ${chessEvents.length} events`;
    }

    eventMatchesFilters(ev) {
        const f = this.eventFilters;

        // Date from filter
        if (f.dateFrom && ev.endDate < f.dateFrom) return false;

        // Rating type filter
        const isECF     = ev.ratingType === 'ECF';
        const isFIDE    = ev.ratingType === 'FIDE';
        const isUnrated = ev.ratingType === 'None' || !isECF && !isFIDE;
        if (!((f.ecf && isECF) || (f.fide && isFIDE) || (f.unrated && isUnrated))) return false;

        if (f.type   && ev.type !== f.type)       return false;
        if (f.county && ev.county !== f.county)   return false;

        if (f.search) {
            const haystack = [ev.title, ev.venue, ev.description].join(' ').toLowerCase();
            if (!haystack.includes(f.search)) return false;
        }

        return true;
    }

    renderEventList(events) {
        const list = document.getElementById('events-list');
        if (!list) return;
        list.innerHTML = '';

        if (events.length === 0) {
            list.innerHTML = '<p class="text-[10px] text-gray-500 uppercase tracking-widest text-center mt-8 px-4">No events match your filters.</p>';
            return;
        }

        events.forEach(ev => {
            const club     = chessClubs.find(c => c.id === ev.clubId);
            const duration = eventDuration(ev.startDate, ev.endDate);
            const dist = this.userLocation ? calculateDistance(this.userLocation.lat, this.userLocation.lng, ev.lat || club?.lat, ev.lng || club?.lng) : null;
            const card     = document.createElement('div');
            card.className = 'event-card p-4 bg-white/5 border border-white/10 rounded-sm cursor-pointer hover:border-blue-500 hover:bg-white/8 transition-all group';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-2 gap-2">
                    <h3 class="text-sm font-bold text-white group-hover:text-blue-400 leading-tight">${ev.title}</h3>
                    <span class="${eventTypeColor(ev.type)} text-[9px] text-white px-2 py-0.5 rounded-sm shrink-0 font-bold uppercase">${ev.type}</span>
                </div>
                <div class="flex items-center gap-2 mb-2 flex-wrap">
                    ${ratingBadge(ev.ratingType)}
                    <span class="text-[10px] text-gray-400 flex items-center gap-1">
                        <span class="text-blue-400">📅</span>${formatDate(ev.startDate)}
                    </span>
                    ${duration ? `<span class="text-[10px] text-gray-400 flex items-center gap-1"><span class="text-cyan-400">⏱</span>${duration}</span>` : ''}
                </div>
                ${dist !== null ? `
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-[10px] bg-slate-900 border border-white/10 px-2 py-0.5 rounded-sm"><i data-lucide="navigation" class="w-2 h-2 inline mr-1 text-blue-400"></i>${dist.toFixed(1)} mi${dist <= 10 ? ' <span class="text-blue-400">(Local)</span>' : ''}</span>
                </div>` : ''}
                <p class="text-[10px] text-gray-500 mb-2 leading-relaxed">${ev.venue || (club?.address ?? '')}</p>
                <p class="text-[10px] text-gray-600 leading-relaxed mb-3">${ev.description}</p>
                <div class="flex items-center justify-between gap-2">
                    ${ev.entryFee ? `<span class="text-[10px] text-green-400">💷 ${ev.entryFee}</span>` : '<span></span>'}
                    ${ev.website  ? `<a href="${ev.website}" target="_blank" onclick="event.stopPropagation()" class="text-[10px] text-blue-400 hover:text-blue-300 underline flex items-center gap-1">Register →</a>` : ''}
                </div>
            `;
            if (club) {
                card.onclick = () => this.focusEventOnMap(ev, club);
            }
            list.appendChild(card);
        });
    }

    renderEventMarkers(events) {
        if (!this.eventsMap) return;
        this.eventMarkers.forEach(m => this.eventsMap.removeLayer(m));
        this.eventMarkers = [];

        const data = events || chessEvents;
        data.forEach(ev => {
            const club = chessClubs.find(c => c.id === ev.clubId);
            if (!club) return;

            const lat = ev.lat || club.lat;
            const lng = ev.lng || club.lng;

            const marker = L.marker([lat, lng], { icon: makeMarkerIcon() });
            marker.bindPopup(this.buildEventPopup(ev, club));
            marker.addTo(this.eventsMap);
            marker._eventId = ev.id;
            this.eventMarkers.push(marker);
        });

        if (data.length > 0 && this.eventMarkers.length > 0 && data.length < chessEvents.length) {
            const group = L.featureGroup(this.eventMarkers);
            this.eventsMap.fitBounds(group.getBounds().pad(0.2));
        }
    }

    buildEventPopup(ev, club) {
        const duration = eventDuration(ev.startDate, ev.endDate);
        return `
            <div class="popup-content">
                <h3>${ev.title}</h3>
                <p><strong style="color:#94a3b8">Date:</strong> ${formatDate(ev.startDate)}${ev.endDate !== ev.startDate ? ` – ${formatDate(ev.endDate)}` : ''}</p>
                ${duration ? `<p><strong style="color:#94a3b8">Duration:</strong> ${duration}</p>` : ''}
                <p><strong style="color:#94a3b8">Venue:</strong> ${ev.venue || club.address}</p>
                ${ev.entryFee ? `<p><strong style="color:#94a3b8">Entry:</strong> ${ev.entryFee}</p>` : ''}
                ${ev.website  ? `<p>🌐 <a href="${ev.website}" target="_blank" style="color:#e87c3e">Register / More Info</a></p>` : ''}
            </div>`;
    }

    focusEventOnMap(ev, club) {
        if (!this.eventsMap) return;
        const lat = ev.lat || club.lat;
        const lng = ev.lng || club.lng;
        this.eventsMap.setView([lat, lng], 13);
        const marker = this.eventMarkers.find(m => m._eventId === ev.id);
        if (marker) {
            marker.openPopup();
            this.showRoute(this.eventsMap, lat, lng);
        }
    }

    showRoute(map, targetLat, targetLng) {
        if (!this.userLocation) return;
        
        // Remove existing route if any
        if (this.routingControl) {
            map.removeControl(this.routingControl);
        }

        this.routingControl = L.Routing.control({
            waypoints: [
                L.latLng(this.userLocation.lat, this.userLocation.lng),
                L.latLng(targetLat, targetLng)
            ],
            lineOptions: {
                styles: [{ color: '#ffffff', opacity: 0.8, weight: 5 }]
            },
            router: L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/trip/v1/driving'
            }),
            createMarker: () => null, // Don't create default routing markers
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: false,
            show: false
        }).on('routesfound', (e) => {
            const routes = e.routes;
            const summary = routes[0].summary;
            const distKm = summary.totalDistance / 1000;
            const distMi = distKm * 0.621371;
            const timeMin = Math.round(summary.totalTime / 60);
            
            // Find popup to inject travel info
            const popup = map._popup;
            if (popup) {
                const content = popup.getContent();
                if (content && !content.includes('Driving Info')) {
                    const travelHtml = `
                        <div style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.1); font-size:0.75rem;">
                            <strong style="color:#22d3ee">Driving Info:</strong><br>
                            🚗 ${distMi.toFixed(1)} miles • ⏱ ${timeMin} mins
                        </div>
                    `;
                    popup.setContent(content + travelHtml);
                }
            }
        }).addTo(map);
    }

    // ─── GEOLOCATION ──────────────────────────────────────────────────────

    locateUser(context) {
        if (!navigator.geolocation) return alert("Geolocation not supported");
        const btn = document.getElementById('clubs-locate');
        if (btn) btn.innerHTML = '<span class="animate-spin inline-block mr-2">⟳</span> Locating…';

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                const map = context === 'clubs' ? this.clubsMap : this.eventsMap;
                if (map) {
                    map.setView([this.userLocation.lat, this.userLocation.lng], 11);
                    L.circle([this.userLocation.lat, this.userLocation.lng], {
                        radius: 16093, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1
                    }).addTo(map);
                }
                if (btn) {
                    btn.innerHTML = '<i data-lucide="map" class="w-4 h-4"></i> Nearby Active';
                    window.lucide.createIcons();
                }
                // Trigger filter update after location found
                if (context === 'clubs') this.filterClubs(); else this.filterEvents();
            },
            () => {
                alert("Location access denied.");
                if (btn) {
                    btn.innerHTML = '<i data-lucide="navigation" class="w-4 h-4"></i> Find Nearby Clubs';
                    window.lucide.createIcons();
                }
            }
        );
    }
}

// ─── Boot ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Initialize and expose globally immediately so inline onclick handlers work.
    const app = new ChessApp();
    window.app = app;
    // Label clicks are already handled in part by Tailwind/HTML, 
    // but we ensure the visual indicators stay in sync.
    document.querySelectorAll('label').forEach(label => {
        label.addEventListener('click', () => {
            setTimeout(() => {
                const cb = label.querySelector('input[type="checkbox"]');
                if (cb) app.updateCheckboxVisual(cb);
            }, 10);
        });
    });
});
