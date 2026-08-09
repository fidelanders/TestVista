const { escapeHtml } = require('../helpers/sanitizer');

function renderHeader(data) {

    const {
        collectionName,
        collectionVersion,
        environmentName,
        generatedAt,
        totalRequests,
        successRate
    } = data;

    // Color the success-rate chip by how good the number actually is, rather
    // than a fixed color -- a hardcoded "green" reads as "all good" even
    // when the rate is 0%, which is actively misleading at a glance.
    const rateValue = parseFloat(successRate);
    const rateClass = Number.isNaN(rateValue)
        ? 'chip-accent-warn'
        : rateValue >= 80
            ? 'chip-accent-good'
            : rateValue >= 50
                ? 'chip-accent-warn'
                : 'chip-accent-bad';


    return `
<div class="header">

    <div class="header-grid" aria-hidden="true"></div>

    <div class="header-top">

        <div class="brand-mark">
            <span class="brand-prompt">&gt;_</span>
            TestVista <span class="brand-accent">Newman Reporter</span>
        </div>

        <button
            type="button"
            class="print-btn"
            onclick="printReport()"
            aria-label="Print or save this report as a PDF">
            🖨️ Print / Save as PDF
        </button>

    </div>


    <div class="header-main">

        <div class="eyebrow">
            <span class="eyebrow-dot"></span>
            QA Automation &middot; Newman Execution Report
        </div>

        <h1>
            🚀 ${escapeHtml(collectionName)}
        </h1>

        <div class="version-pill">
            v${escapeHtml(collectionVersion)}
        </div>

    </div>


    <div class="meta-chips">

        ${environmentName ? `
        <div class="chip">
            <span class="chip-label">Environment</span>
            <span class="chip-value chip-accent-info">${escapeHtml(environmentName)}</span>
        </div>
        ` : ''}

        <div class="chip">
            <span class="chip-label">Generated</span>
            <span class="chip-value">${escapeHtml(generatedAt)}</span>
        </div>

        <div class="chip">
            <span class="chip-label">Total Requests</span>
            <span class="chip-value">${escapeHtml(totalRequests)}</span>
        </div>

        <div class="chip">
            <span class="chip-label">Success Rate</span>
            <span class="chip-value ${rateClass}">${escapeHtml(successRate)}%</span>
        </div>

    </div>

</div>
`;

}


module.exports = renderHeader;
