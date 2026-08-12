const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const { runCollection, reportsDir, normalizeIterations, parseDataFile } = require('./index');

const app = express();
const PORT = process.env.PORT || 4000;

fs.mkdirSync(reportsDir, { recursive: true });

// Static frontend
app.use(express.static(path.resolve(__dirname, 'public')));

// Generated reports are served directly so "Open full report" / "Download JSON"
// links on the page work without an extra download step.
app.use('/reports', express.static(reportsDir));

// Accept a single JSON file, kept in memory (never written to disk unsanitized).
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

function sanitizeFilenamePart(value) {
    return String(value || '').replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Derives pass/fail counts for the upload page's stat cards.
 *
 * This intentionally does NOT depend on the shape of `reportData` returned by
 * parser/newmanParser.js -- that return value is an internal contract of your
 * report pipeline and may change independently of this web layer. Instead it
 * reads directly from Newman's own `run.failures`, correlated back to each
 * execution via its cursor ref -- the same accurate method the report itself
 * uses to mark a request as failed, so these numbers always agree with what
 * the generated HTML report shows.
 */
function computeSummaryStats(summary) {
    const failuresByRef = {};
    (summary.run.failures || []).forEach(failure => {
        const ref = failure.cursor?.ref || failure.cursor?.httpRequestId || failure.source?.id;
        if (!ref) return;
        failuresByRef[ref] = true;
    });

    const executions = summary.run.executions || [];
    const totalRequests = executions.length;
    let failedRequests = 0;

    executions.forEach(exec => {
        const ref = exec.cursor?.ref || exec.cursor?.httpRequestId;
        const statusCode = exec.response?.code ?? 0;
        const hasHttpError = statusCode >= 400 || statusCode === 0;
        const hasAssertions = Array.isArray(exec.assertions) && exec.assertions.length > 0;
        const failed = Boolean(ref && failuresByRef[ref]) || (!hasAssertions && hasHttpError);
        if (failed) failedRequests++;
    });

    const passedRequests = totalRequests - failedRequests;
    const successRate = totalRequests === 0
        ? 0
        : Number(((passedRequests / totalRequests) * 100).toFixed(2));

    return { totalRequests, passedRequests, failedRequests, successRate };
}

app.post(
    '/api/run',
    upload.fields([
        { name: 'collection', maxCount: 1 },
        { name: 'environment', maxCount: 1 },
        { name: 'dataFile', maxCount: 1 }
    ]),
    async (req, res) => {

    const collectionFile = req.files?.collection?.[0];
    const environmentFile = req.files?.environment?.[0];
    const dataFileUpload = req.files?.dataFile?.[0];

    if (!collectionFile) {
        return res.status(400).json({ error: 'No collection file was uploaded.' });
    }

    let collection;
    try {
        collection = JSON.parse(collectionFile.buffer.toString('utf8'));
    } catch {
        return res.status(400).json({ error: 'That collection file is not valid JSON.' });
    }

    if (!collection || typeof collection !== 'object' || !collection.info || !collection.item) {
        return res.status(400).json({
            error: 'That doesn\'t look like a Postman collection export (missing "info" or "item").'
        });
    }

    // Environment is entirely optional -- only parse/validate it if one was
    // actually attached to the upload.
    let environment;
    if (environmentFile) {
        try {
            environment = JSON.parse(environmentFile.buffer.toString('utf8'));
        } catch {
            return res.status(400).json({ error: 'That environment file is not valid JSON.' });
        }

        if (!environment || typeof environment !== 'object' || !Array.isArray(environment.values)) {
            return res.status(400).json({
                error: 'That doesn\'t look like a Postman environment export (missing a "values" array).'
            });
        }
    }

    // Data file is also entirely optional. parseDataFile() (shared with the
    // CLI path) handles both CSV and JSON and never writes the upload to
    // disk -- it's parsed straight out of the in-memory buffer multer gave us.
    let dataFile;
    if (dataFileUpload) {
        try {
            dataFile = parseDataFile({
                buffer: dataFileUpload.buffer,
                filename: dataFileUpload.originalname
            });
        } catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }

    // Iterations is a plain text field (not a file), so multer's `.fields()`
    // puts it on req.body alongside the uploaded files. Validated here via
    // the same normalizeIterations() that runCollection() itself calls, so
    // bad input gets a clean 400 instead of a generic 500 from deep inside
    // the run. Note: only the RAW value is validated here and then discarded
    // -- the raw (possibly undefined) req.body.iterations is what actually
    // gets passed to runCollection() below, not a pre-normalized default of
    // 1. runCollection needs to see "nothing was submitted" as literally
    // undefined, not as the number 1, to correctly default to one iteration
    // per data-file row when a data file is attached and no count was typed.
    try {
        normalizeIterations(req.body?.iterations); // validate only; result intentionally discarded
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const reportBaseName = `${sanitizeFilenamePart(collection.info?.name || 'Collection')}_${runId}`;

    try {
        const { htmlPath, jsonPath, pdfPath, summary, collectionName, environmentName, iterations: ranIterations } = await runCollection({
            collection,
            environment,
            dataFile,
            iterations: req.body?.iterations,
            reportBaseName
        });

        const stats = computeSummaryStats(summary);

        res.json({
            success: true,
            collectionName,
            environmentName,
            iterations: ranIterations,
            ...stats,
            reportUrl: `/reports/${path.basename(htmlPath)}`,
            jsonUrl: `/reports/${path.basename(jsonPath)}`,
            pdfUrl: pdfPath ? `/reports/${path.basename(pdfPath)}` : null
        });
    } catch (err) {
        console.error('Run failed:', err);
        res.status(500).json({
            error: 'The collection failed to run. Check that it\'s a valid Postman export.',
            details: err.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 Newman Reporter web app running at http://localhost:${PORT}\n`);
});