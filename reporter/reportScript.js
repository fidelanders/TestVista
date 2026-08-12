let currentFilter = 'all';
let currentIteration = 'all';

function applyFilters() {
    const q = document
        .getElementById('searchInput')
        .value
        .trim()
        .toLowerCase();

    document.querySelectorAll('.test-card').forEach(card => {
        const status = card.dataset.status;
        const iteration = card.dataset.iteration;

        const haystack =
            (card.dataset.search || '').toLowerCase();

        const matchesStatus =
            currentFilter === 'all' ||
            status === currentFilter;

        const matchesIteration =
            currentIteration === 'all' ||
            iteration === currentIteration;

        const matchesSearch =
            haystack.includes(q);

        card.style.display =
            matchesStatus && matchesIteration && matchesSearch
                ? 'block'
                : 'none';
    });
}

function filterTests(type, btn) {
    currentFilter = type;

    document
        .querySelectorAll('.filter-btn')
        .forEach(b => b.classList.remove('active'));

    if (btn) {
        btn.classList.add('active');
    }

    const jumpBtn = document.getElementById('jumpBtn');

    if (jumpBtn) {
        jumpBtn.style.display =
            type === 'all'
                ? 'inline-flex'
                : 'none';
    }

    applyFilters();
}

function filterByIteration(value) {
    currentIteration = value;
    applyFilters();
}

// Clicking a row in the "Iteration Overview" table filters the request
// list below AND keeps the toolbar's iteration <select> in sync, so the two
// controls never show contradictory state (e.g. the table having "driven"
// a filter the dropdown still shows as "All Iterations").
function filterByIterationFromTable(iterationNumber) {
    const select = document.getElementById('iterationFilterSelect');

    if (select) {
        select.value = String(iterationNumber);
    }

    filterByIteration(String(iterationNumber));

    const container = document.getElementById('testCardContainer');
    if (container && typeof container.scrollIntoView === 'function') {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function searchTests() {
    applyFilters();
}

function jumpToFirstFailure() {
    const firstFailure = [...document.querySelectorAll('.test-card')]
        .find(card =>
            card.dataset.status === 'failed' &&
            getComputedStyle(card).display !== 'none'
        );

    if (!firstFailure) return;

    if (typeof firstFailure.scrollIntoView === 'function') {
        firstFailure.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }

    firstFailure.style.backgroundColor = '#fee2e2';
firstFailure.style.border = '2px solid #dc2626';

setTimeout(() => {
    firstFailure.style.backgroundColor = '';
    firstFailure.style.border = '';
}, 2000);
}

// ==========================================
// Print / PDF preparation
// ==========================================

let printState = null;

function prepareForPrint() {
    printState = {
        details: [],
        cards: [],
        labels: []
    };

    document.querySelectorAll('details').forEach(el => {
        printState.details.push({ el, wasOpen: el.open });
        el.open = true;
    });

    document.querySelectorAll('.test-card').forEach(el => {
        printState.cards.push({ el, wasHidden: el.style.display === 'none' });
        el.style.display = 'block';
    });
    document.querySelectorAll('.response-details > summary').forEach(el => {
        printState.labels.push({ el, original: el.textContent });
        el.textContent = 'Response Body';
    });
}

function restoreAfterPrint() {
    if (!printState) return;

    printState.details.forEach(({ el, wasOpen }) => {
        el.open = wasOpen;
    });

    printState.cards.forEach(({ el, wasHidden }) => {
        el.style.display = wasHidden ? 'none' : 'block';
    });

    printState.labels.forEach(({ el, original }) => {
        el.textContent = original;
    });

    printState = null;
}

window.addEventListener('beforeprint', prepareForPrint);
window.addEventListener('afterprint', restoreAfterPrint);

function printReport() {
    prepareForPrint();
    window.print();
    setTimeout(restoreAfterPrint, 1000);
}
