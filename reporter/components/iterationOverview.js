const { escapeHtml } = require('../helpers/sanitizer');

function renderIterationOverview(data) {

    const { iterationsCount, iterationSummary } = data;

    // Single-run reports skip this section entirely -- an "overview table"
    // with exactly one row would just duplicate the KPI cards above it and
    // add visual noise for the common case. This is what keeps existing
    // single-run reports looking exactly as they did before Milestone 4.
    if (!iterationsCount || iterationsCount <= 1 || !Array.isArray(iterationSummary)) {
        return '';
    }

    return `
<section class="report-section">

<h2>Iteration Overview</h2>

<div class="card iteration-overview-card">
<table class="iteration-table">

<thead>
<tr>
<th>Iteration</th>
<th>Requests</th>
<th>Passed</th>
<th>Failed</th>
<th>Pass Rate</th>
</tr>
</thead>

<tbody>
${iterationSummary.map(row => {

    const rateValue = parseFloat(row.passRate);

    const rateClass =
        rateValue >= 80 ? 'rate-good' :
        rateValue >= 50 ? 'rate-warn' :
        'rate-bad';

    return `
<tr
    class="iteration-row"
    onclick="filterByIterationFromTable(${escapeHtml(row.iteration)})"
    tabindex="0"
    role="button"
    aria-label="Filter the report to iteration ${escapeHtml(row.iteration)}">

<td class="iteration-row-number">${escapeHtml(row.iteration)}</td>
<td>${escapeHtml(row.requests)}</td>
<td class="rate-good">${escapeHtml(row.passed)}</td>
<td class="${row.failed > 0 ? 'rate-bad' : ''}">${escapeHtml(row.failed)}</td>
<td class="${rateClass}">${escapeHtml(row.passRate)}%</td>
</tr>`;

}).join('')}
</tbody>

</table>

<p class="iteration-table-hint">Click a row to filter the requests below to just that iteration.</p>

</div>

</section>
`;

}

module.exports = renderIterationOverview;
