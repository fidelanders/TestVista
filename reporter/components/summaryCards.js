const { escapeHtml } = require('../helpers/sanitizer');

function renderSummary(data){

const {
totalRequests,
passedRequests,
failedRequests,
avgResponse,
successRate,
minResponse,
maxResponse,
totalAssertions,
failedAssertionsCount
}=data;


return `
<section class="report-section">
<h2>Execution Overview</h2>


<div class="cards">

<div class="card">
<h3>Total Requests</h3>
<div class="number blue">
${totalRequests}
</div>
</div>


<div class="card">
<h3>Passed Requests</h3>
<div class="number green">
${passedRequests}
</div>
</div>


<div class="card">
<h3>Failed Requests</h3>
<div class="number red">
${failedRequests}
</div>
</div>


<div class="card">
<h3>Average Response</h3>
<div class="number orange">
${avgResponse} ms
</div>
</div>


</div>
</section>

<section class="report-section">
<h2>Success Rate</h2>

<div class="card summary-row">

    <div
        class="donut"
        style="--success-rate: ${escapeHtml(successRate)}%">

        <div class="donut-label">
            <div class="pct">${escapeHtml(successRate)}%</div>
            <div class="lbl">Passed</div>
        </div>

    </div>

    <div class="summary-details">

        <div class="progress" style="--progress-width:${escapeHtml(successRate)}%;">
    <div class="progress-fill"></div>
</div>


        <p>
            <strong>${passedRequests}</strong> of
            <strong>${totalRequests}</strong> requests passed
            &middot;
            <strong>${failedAssertionsCount}</strong> of
            <strong>${totalAssertions}</strong> assertions failed
        </p>

    </div>

</div>

</section>

<section class="report-section">

<h2>Performance Metrics</h2>


<div class="cards">


<div class="card">
<h3>Fastest Response</h3>
<div class="number green">
${minResponse} ms
</div>
</div>


<div class="card">
<h3>Slowest Response</h3>
<div class="number red">
${maxResponse} ms
</div>
</div>



<div class="card">
<h3>Total Assertions</h3>
<div class="number blue">
${totalAssertions}
</div>
</div>


</div>

</section>

`;

}


module.exports = renderSummary;
