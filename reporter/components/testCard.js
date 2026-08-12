const { escapeHtml } = require('../helpers/sanitizer');

function renderTestCards(data){

const {
testCards,
failedRequests,
iterationsCount
}=data;

// Only surface iteration-specific UI (badges, the filter dropdown) when
// there's actually more than one iteration to distinguish -- for a normal
// single-run report, "Iteration 1" on every card and a dropdown with a
// single option are pure noise. This is what keeps existing single-run
// reports looking exactly as they did before Milestone 4.
const showIterationUI = (iterationsCount ?? 1) > 1;


return `

<section class="report-section">

<h2>
Request Execution Details
</h2>


<div class="toolbar">

<button 
class="filter-btn all-btn active"
onclick="filterTests('all',this)">
All (${testCards.length})
</button>


<button 
class="filter-btn pass-btn"
onclick="filterTests('passed',this)">
Passed
</button>


<button 
class="filter-btn failed-btn"
onclick="filterTests('failed',this)">
Failed
</button>


${showIterationUI ? `
<select
    id="iterationFilterSelect"
    class="iteration-filter-select"
    onchange="filterByIteration(this.value)"
    aria-label="Filter by iteration">
<option value="all">All Iterations</option>
${Array.from({ length: iterationsCount }, (_, i) => i + 1).map(n =>
    `<option value="${n}">Iteration ${n}</option>`
).join('')}
</select>
` : ''}


<input 
id="searchInput"
placeholder="Search request..."
oninput="searchTests()">


${
failedRequests > 0
?
`
<button
    id="jumpBtn"
    class="filter-btn failed-btn"
    style="background:red;color:white"
    onclick="jumpToFirstFailure()">
    ⚠ Jump to First Failure
</button>
`
:''
}

</div>


${
failedRequests === 0 && testCards.length > 0
?
`
<div class="all-clear-banner">
<span class="all-clear-emoji">🎉</span>
<div>
<strong>No failed tests — nice work!</strong>
<span>Every request in this run passed. Nothing to fix here.</span>
</div>
</div>
`
:''
}


<div id="testCardContainer">


${

testCards.map(t=>`

<div 
class="test-card"
data-status="${t.passed?'passed':'failed'}"
data-iteration="${escapeHtml(t.iteration)}"
data-search="${escapeHtml((t.name+' '+t.url).toLowerCase())}">


<div class="test-card-head">


<h3>
${t.passed?'✅':'❌'}
${escapeHtml(t.name)}
</h3>


<div class="test-card-badges">

${showIterationUI ? `
<span class="badge iteration-badge">
Iteration ${escapeHtml(t.iteration)}
</span>
` : ''}

<span class="badge ${t.passed?'pass':'fail'}">
${t.passed?'PASSED':'FAILED'}
</span>

</div>


</div>



<div class="endpoint-row">

<strong>
Endpoint
</strong>


<code>
${escapeHtml(t.method)}
${escapeHtml(t.url)}
</code>

</div>



<div class="meta-row">

<span>
Status:
${escapeHtml(t.statusCode)}
${escapeHtml(t.statusText)}
</span>


<span>
Response:
${escapeHtml(t.responseTime)} ms
</span>

</div>



${
t.failedAssertions.length
?
`
<div class="failure-list">

<details open>

<summary>
Failures (${t.failedAssertions.length})
</summary>


${t.failedAssertions.map(
f=>`<pre>❌ ${escapeHtml(f)}</pre>`
).join('')}


</details>

</div>
`
:''
}



<details${t.passed ? '' : ' open'} class="response-details">

<summary>
View Response Body
</summary>


<pre>
${escapeHtml(t.bodyText) || 'No response'}
</pre>


</details>



</div>


`).join('')

}


</div>

</section>

`;

}


module.exports = renderTestCards;
