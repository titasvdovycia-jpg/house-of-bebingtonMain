/**
 * UK Chess Directory — Simplified Map-First Version
 */

const getClubs = () => (window.chessClubs && window.chessClubs.length > 0) ? window.chessClubs : [];
const getEvents = () => window.chessEvents || [];

// ─── Utility Helpers ────────────────────────────────────────────────────────

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
    const R = 3958.8; // Radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function makeMarkerIcon(color = 'blue') {
    return L.divIcon({
        className: `chess-marker marker-${color}`,
        html: `<div class="marker-inner"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });
}

function ratingBadge(rt) {
    if (rt === 'FIDE') return '<span class="badge-fide">FIDE</span>';
    if (rt === 'ECF')  return '<span class="badge-ecf">ECF</span>';
    return '<span class="badge-none">Fun</span>';
}

// ─── Main App ───────────────────────────────────────────────────────────────

class ChessApp {
    constructor() {
        this.userLocation = null;
        this.map = null;
        this.markers = [];
        this.routingControl = null;

        this.filters = {
            showClubs: true,
            showEvents: true,
            search: '',
            county: '',
            eventType: '',
            dateFrom: '' // Empty by default to show all tournaments
        };

        this.init();
    }

    init() {
        try {
            if (typeof window.loadChessData === 'function') {
                window.loadChessData();
            }
            if (window.lucide) window.lucide.createIcons();
            this.populateCountyDropdown();
            this.initMap();
            this.locateUser();

            // Refresh layout periodically to fix map display issues
            setInterval(() => {
                if (this.map) this.map.invalidateSize(false);
            }, 1000);
        } catch (error) {
            console.error("Error in init():", error);
        }
    }

    initMap() {
        const mapEl = document.getElementById('map-directory');
        if (!mapEl) return;

        this.map = L.map('map-directory', { zoomControl: true, attributionControl: false })
            .setView([54.5, -3], 6);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; CARTO'
        }).addTo(this.map);

        this.filterDirectory();
    }

    populateCountyDropdown() {
        const clubCounties  = [...new Set(getClubs().map(c => c.county).filter(Boolean))];
        const eventCounties = [...new Set(getEvents().map(e => e.county).filter(Boolean))];
        const allCounties = [...new Set([...clubCounties, ...eventCounties])].sort();

        const dc = document.getElementById('dir-county');
        if (!dc) return;
        dc.innerHTML = '<option value="">All Counties</option>';
        allCounties.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            dc.appendChild(opt);
        });
    }

    filterDirectory() {
        this.filters.showClubs  = document.getElementById('show-clubs')?.checked ?? true;
        this.filters.showEvents = document.getElementById('show-events')?.checked ?? true;
        this.filters.search     = (document.getElementById('directory-search')?.value || '').toLowerCase();
        this.filters.county     = document.getElementById('dir-county')?.value || '';
        this.filters.eventType  = document.getElementById('dir-event-type')?.value || '';
        this.filters.dateFrom   = document.getElementById('dir-date-from')?.value || '';

        // Update Toggle UI
        const clubLabel = document.getElementById('toggle-clubs-label');
        const eventLabel = document.getElementById('toggle-events-label');
        if (clubLabel) {
            clubLabel.classList.toggle('bg-blue-600/20', this.filters.showClubs);
            clubLabel.classList.toggle('border-blue-500', this.filters.showClubs);
            clubLabel.classList.toggle('opacity-50', !this.filters.showClubs);
        }
        if (eventLabel) {
            eventLabel.classList.toggle('bg-orange-500/20', this.filters.showEvents);
            eventLabel.classList.toggle('border-orange-500', this.filters.showEvents);
            eventLabel.classList.toggle('opacity-50', !this.filters.showEvents);
        }

        const evtTypeFilter = document.getElementById('filter-event-type');
        const dateFilter = document.getElementById('filter-date-from');
        if (evtTypeFilter) evtTypeFilter.classList.toggle('hidden', !this.filters.showEvents);
        if (dateFilter) dateFilter.classList.toggle('hidden', !this.filters.showEvents);

        let clubs = this.filters.showClubs ? getClubs().filter(c => this.clubMatches(c)) : [];
        let events = this.filters.showEvents ? getEvents().filter(e => this.eventMatches(e)) : [];

        let combined = [
            ...clubs.map(c => ({...c, typeDir: 'club'})),
            ...events.map(e => ({...e, typeDir: 'event'}))
        ];

        if (this.userLocation) {
            combined.sort((a, b) => {
                const distA = calculateDistance(this.userLocation.lat, this.userLocation.lng, a.lat, a.lng);
                const distB = calculateDistance(this.userLocation.lat, this.userLocation.lng, b.lat, b.lng);
                return distA - distB;
            });
        }

        this.renderList(combined);
        this.renderMarkers(combined);

        const count = document.getElementById('dir-count');
        if (count) count.textContent = `Showing ${combined.length} matches`;
    }

    clubMatches(club) {
        if (this.filters.county && club.county !== this.filters.county) return false;
        if (this.filters.search) {
            const haystack = [club.name, club.county, club.address].join(' ').toLowerCase();
            if (!haystack.includes(this.filters.search)) return false;
        }
        return true;
    }

    eventMatches(ev) {
        if (this.filters.county && ev.county !== this.filters.county) return false;
        if (this.filters.eventType && ev.type !== this.filters.eventType) return false;
        if (this.filters.dateFrom && ev.endDate < this.filters.dateFrom) return false;
        if (this.filters.search) {
            const haystack = [ev.title, ev.venue, ev.description].join(' ').toLowerCase();
            if (!haystack.includes(this.filters.search)) return false;
        }
        return true;
    }

    renderList(items) {
        const list = document.getElementById('directory-list');
        if (!list) return;
        list.innerHTML = '';

        if (items.length === 0) {
            list.innerHTML = '<p class="text-[10px] text-gray-500 uppercase tracking-widest text-center mt-8 px-4">No results found.</p>';
            return;
        }

        items.forEach((item, index) => {
            const card = document.createElement('div');
            if (item.typeDir === 'club') {
                this.renderClubCard(card, item);
            } else {
                this.renderEventCard(card, item);
            }
            list.appendChild(card);
        });
        if (window.lucide) window.lucide.createIcons();
    }

    renderClubCard(card, club) {
        const dist = this.userLocation ? calculateDistance(this.userLocation.lat, this.userLocation.lng, club.lat, club.lng) : null;
        card.className = 'club-card p-4 bg-white/5 border border-white/10 rounded-sm cursor-pointer hover:border-blue-500 hover:bg-white/8 transition-all group mb-2';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h3 class="text-sm font-bold text-white group-hover:text-blue-400 leading-tight pr-2">${club.name}</h3>
                <span class="text-[9px] text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded-sm font-bold uppercase">Club</span>
            </div>
            <p class="text-[10px] text-gray-500 mb-2 leading-relaxed">${club.address}</p>
            ${dist !== null ? `<div class="text-[10px] bg-slate-900 border border-white/10 px-2 py-0.5 rounded-sm inline-block mb-2"><i data-lucide="navigation" class="w-2 h-2 inline mr-1 text-blue-400"></i>${dist.toFixed(1)} mi</div>` : ''}
            <div class="flex flex-wrap gap-1">
                ${(club.ratingType || []).map(rt => ratingBadge(rt)).join('')}
            </div>
        `;
        card.onclick = () => this.focusOnMap(club, 'blue');
    }

    renderEventCard(card, ev) {
        const dist = this.userLocation ? calculateDistance(this.userLocation.lat, this.userLocation.lng, ev.lat, ev.lng) : null;
        const duration = eventDuration(ev.startDate, ev.endDate);
        card.className = 'event-card p-4 bg-white/5 border border-white/10 rounded-sm cursor-pointer hover:border-orange-500 hover:bg-white/8 transition-all group mb-2';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h3 class="text-sm font-bold text-white group-hover:text-orange-400 leading-tight pr-2">${ev.title}</h3>
                <span class="text-[9px] text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded-sm font-bold uppercase">Event</span>
            </div>
            <div class="flex items-center gap-2 mb-2 flex-wrap">
                <span class="text-[10px] text-gray-400 flex items-center gap-1">📅 ${formatDate(ev.startDate)}</span>
                ${duration ? `<span class="text-[10px] text-gray-400">⏱ ${duration}</span>` : ''}
            </div>
            <p class="text-[10px] text-gray-500 mb-2 leading-relaxed">${ev.venue}</p>
            ${dist !== null ? `<div class="text-[10px] bg-slate-900 border border-white/10 px-2 py-0.5 rounded-sm inline-block mb-2"><i data-lucide="navigation" class="w-2 h-2 inline mr-1 text-orange-400"></i>${dist.toFixed(1)} mi</div>` : ''}
        `;
        card.onclick = () => this.focusOnMap(ev, 'orange');
    }

    renderMarkers(items) {
        if (!this.map) return;
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];

        items.forEach(item => {
            const color = item.typeDir === 'club' ? 'blue' : 'orange';
            const marker = L.marker([item.lat, item.lng], { icon: makeMarkerIcon(color) });
            marker.bindPopup(item.typeDir === 'club' ? this.buildClubPopup(item) : this.buildEventPopup(item));
            marker.addTo(this.map);
            marker._id = item.id;
            this.markers.push(marker);
        });

        if (items.length > 0 && items.length < 50) {
            const group = L.featureGroup(this.markers);
            this.map.fitBounds(group.getBounds().pad(0.2));
        }
    }

    buildClubPopup(club) {
        return `
            <div class="popup-content">
                <h3 style="color:#60a5fa">${club.name}</h3>
                <p>${club.address}</p>
                ${club.website ? `<p>🌐 <a href="${club.website}" target="_blank" style="color:#60a5fa">${club.website.replace('https://','')}</a></p>` : ''}
            </div>`;
    }

    buildEventPopup(ev) {
        return `
            <div class="popup-content">
                <h3 style="color:#fb923c">${ev.title}</h3>
                <p><strong>Date:</strong> ${formatDate(ev.startDate)}</p>
                <p><strong>Venue:</strong> ${ev.venue}</p>
                ${ev.website ? `<p>🌐 <a href="${ev.website}" target="_blank" style="color:#fb923c">Details</a></p>` : ''}
            </div>`;
    }

    focusOnMap(item, color) {
        if (!this.map) return;
        this.map.setView([item.lat, item.lng], 13);
        const marker = this.markers.find(m => m._id === item.id);
        if (marker) marker.openPopup();
        this.showRoute(item.lat, item.lng);
    }

    showRoute(targetLat, targetLng) {
        if (!this.userLocation || !this.map) return;
        if (this.routingControl) this.map.removeControl(this.routingControl);

        this.routingControl = L.Routing.control({
            waypoints: [L.latLng(this.userLocation.lat, this.userLocation.lng), L.latLng(targetLat, targetLng)],
            lineOptions: { styles: [{ color: '#3b82f6', opacity: 0.6, weight: 4 }] },
            createMarker: () => null,
            addWaypoints: false,
            draggableWaypoints: false,
            show: false
        }).addTo(this.map);
    }

    locateUser() {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                if (this.map) {
                    this.map.setView([this.userLocation.lat, this.userLocation.lng], 10);
                    L.circle([this.userLocation.lat, this.userLocation.lng], {
                        radius: 8000, color: '#3b82f6', fillOpacity: 0.1, weight: 1
                    }).addTo(this.map);
                }
                this.filterDirectory();
            },
            (err) => console.warn("Location denied", err)
        );
    }

    // Explicitly show directory page (in case it was hidden)
    showPage(page) {
        // This version is single-page, so this is mostly for compatibility or manual triggers
        const dir = document.getElementById('page-directory');
        if (dir) dir.classList.remove('hidden');
        if (this.map) this.map.invalidateSize();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new ChessApp();
});
