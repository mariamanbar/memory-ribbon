// --- Configuration ---
const RADIUS = 900; 
const THETA = 18; // Degrees separation

// --- State ---
let photos = []; // Will load from LocalStorage
let targetAngle = 0;
let currentAngle = 0;

// Drag/Click Logic
let isDragging = false;
let startX = 0;
let lastX = 0;
let dragStartTime = 0;

// DOM References
const track = document.getElementById('ribbon-track');
const emptyMsg = document.getElementById('empty-msg');
const viewport = document.getElementById('scene-viewport');

// --- 1. Load Data ---
function loadData() {
    const stored = localStorage.getItem('memory_ribbon_data');
    if (stored) {
        photos = JSON.parse(stored);
        // Ensure they are sorted on load
        sortPhotos();
    } else {
        photos = [];
    }
    checkEmptyState();
    buildDOM();
}

// Helper: Sort Ascending by Date
function sortPhotos() {
    photos.sort((a, b) => {
        const da = new Date(a.date);
        const db = new Date(b.date);
        return da - db;
    });
}

function saveData() {
    try {
        localStorage.setItem('memory_ribbon_data', JSON.stringify(photos));
    } catch (e) {
        alert("Storage is full! Try using smaller images or URLs instead of uploads.");
    }
}

function checkEmptyState() {
    if (photos.length === 0) {
        emptyMsg.classList.add('visible');
        targetAngle = 0;
    } else {
        emptyMsg.classList.remove('visible');
    }
}

// --- 2. Render Loop (Physics) ---
function buildDOM() {
    track.innerHTML = '';
    photos.forEach((photo, i) => {
        const div = document.createElement('div');
        div.className = 'card-wrapper';
        div.dataset.index = i; // Save index for clicking
        
        // Initial Static Position
        const angle = i * THETA;
        div.style.transform = `rotateY(${angle}deg) translateZ(${RADIUS}px)`;

        div.innerHTML = `
            <div class="photo-card">
                <img src="${photo.url}" class="card-image">
                <div class="card-details">
                    <div class="card-date">${formatDate(photo.date)}</div>
                    <div class="card-note">${photo.note}</div>
                </div>
            </div>
        `;
        track.appendChild(div);
    });
}

function animate() {
    // Smooth scroll physics
    currentAngle += (targetAngle - currentAngle) * 0.1;
    
    // Move the track
    track.style.transform = `translateZ(-${RADIUS}px) rotateY(${-currentAngle}deg)`;

    // Opacity/Visibility Logic
    const cards = document.querySelectorAll('.card-wrapper');
    cards.forEach((card, i) => {
        const cardAngle = i * THETA;
        const diff = Math.abs(cardAngle - currentAngle);
        
        // Fade out distant cards
        if (diff > 60) {
            card.style.opacity = Math.max(0, 1 - (diff - 60) / 20);
            card.style.pointerEvents = 'none'; // Don't click invisible cards
        } else {
            card.style.opacity = 1;
            card.style.pointerEvents = 'auto';
        }
    });

    requestAnimationFrame(animate);
}

// --- 3. Interaction (Drag, Click, Keyboard) ---

viewport.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    lastX = e.clientX;
    dragStartTime = Date.now();
    viewport.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const delta = e.clientX - lastX;
    lastX = e.clientX;
    targetAngle -= delta * 0.15; // Scroll speed
});

window.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;
    viewport.style.cursor = 'grab';

    // Detect "Click" vs "Drag"
    const dist = Math.abs(e.clientX - startX);
    const time = Date.now() - dragStartTime;

    // If moved less than 5px and faster than 200ms, it's a click
    if (dist < 5 && time < 400) {
        // Find what was clicked
        // We use composedPath to find the .card-wrapper parent
        const path = e.composedPath();
        const wrapper = path.find(el => el.classList && el.classList.contains('card-wrapper'));
        if (wrapper) {
            openModal(parseInt(wrapper.dataset.index));
        }
    }

    //  Keyboard Navigation 
document.addEventListener('keydown', (e) => {
    if (modal.classList.contains('open')) return; // Don't scroll if modal is open

    if (e.key === 'ArrowRight') {
        targetAngle += THETA;
        clampScroll();
    } else if (e.key === 'ArrowLeft') {
        targetAngle -= THETA;
        clampScroll();
    }
});
    
    clampScroll();
});

// Mouse Wheel
viewport.addEventListener('wheel', (e) => {
    targetAngle += e.deltaY * 0.05;
    clampScroll();
});

function clampScroll() {
    if(photos.length === 0) return;
    const max = (photos.length - 1) * THETA;
    const padding = 10;
    if (targetAngle < -padding) targetAngle = -padding;
    if (targetAngle > max + padding) targetAngle = max + padding;
}

// --- 4. Modal & Data Logic ---
const modal = document.getElementById('modal-overlay');
const inpFile = document.getElementById('inp-file');
const inpUrl = document.getElementById('inp-url');
const inpDate = document.getElementById('inp-date');
const inpNote = document.getElementById('inp-note');
const editIndex = document.getElementById('edit-index');
const btnDelete = document.getElementById('btn-delete');

function openModal(index) {
    modal.classList.add('open');
    editIndex.value = index;
    
    if (index === -1) {
        // New Entry
        document.getElementById('modal-title').innerText = "Add New Memory";
        inpUrl.value = "";
        inpFile.value = "";
        inpDate.value = new Date().toISOString().split('T')[0];
        inpNote.value = "";
        btnDelete.style.display = 'none';
    } else {
        // Edit Existing
        const p = photos[index];
        document.getElementById('modal-title').innerText = "Edit Memory";
        inpUrl.value = p.url.startsWith('data:') ? '' : p.url; // Don't show base64 string in text input
        inpFile.value = ""; // Can't pre-fill file input
        inpDate.value = p.date;
        inpNote.value = p.note;
        btnDelete.style.display = 'block';
    }
}

function closeModal() {
    modal.classList.remove('open');
}

// Save Logic
document.getElementById('btn-save').addEventListener('click', () => {
    const index = parseInt(editIndex.value);
    const file = inpFile.files[0];
    
    // Helper to finalize save after getting image data
    const finishSave = (finalUrl) => {
        const entry = {
            url: finalUrl,
            date: inpDate.value,
            note: inpNote.value
        };

        if (index === -1) {
            photos.push(entry);
        } else {
            photos[index] = entry;
        }

        // 1. Sort the photos by date
        sortPhotos();

        // 2. Find where our entry ended up after sorting
        const newIndex = photos.indexOf(entry);

        // 3. Scroll to that specific position
        targetAngle = newIndex * THETA;

        saveData();
        buildDOM();
        checkEmptyState();
        closeModal();
    };

    if (file) {
        // Convert file to Base64
        const reader = new FileReader();
        reader.onload = function(e) {
            finishSave(e.target.result);
        };
        reader.readAsDataURL(file);
    } else if (inpUrl.value) {
        finishSave(inpUrl.value);
    } else if (index !== -1) {
        // Editing, but didn't change image -> keep old one
        finishSave(photos[index].url);
    } else {
        alert("Please provide an image URL or upload a file.");
    }
});

// Delete Logic
btnDelete.addEventListener('click', () => {
    const index = parseInt(editIndex.value);
    if (confirm("Delete this memory?")) {
        photos.splice(index, 1);
        saveData();
        buildDOM();
        checkEmptyState();
        closeModal();
        // Adjust scroll if we deleted the last item
        clampScroll();
    }
});

document.getElementById('btn-cancel').addEventListener('click', closeModal);
document.getElementById('fab-add').addEventListener('click', () => openModal(-1));

// Helper
function formatDate(str) {
    if(!str) return '';
    const d = new Date(str);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Init
loadData();
animate();