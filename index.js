const path = require('path');
const fs = require('fs');
const newman = require('newman');
const parseCsvSync = require('csv-parse/lib/sync');
const parseNewmanResults = require('./reporter/parser/newmanParser');
const generateReport = require('./reporter/htmlGenerator');

const {
    sanitizeObject,
    sanitizeBody,
    sanitizeString,
    bufferToText
} = require('./reporter/helpers/sanitizer');

const generatePdf = require('./reporter/exportPdf');

const reportsDir = path.resolve(__dirname, 'reports');
// const reportsDir = path.resolve(__dirname, '/tmp/reports');

function getCollectionVersion(version) {

    if (!version)
        return '1.0.0';


    if (typeof version === 'string')
        return version;


    if (typeof version === 'object') {

        return [
            version.major ?? 0,
            version.minor ?? 0,
            version.patch ?? 0
        ].join('.');

    }


    return String(version);

}

const MAX_ITERATIONS = 1000;

/**
 * Validates and normalizes an iteration count from either the CLI or the web
 * upload form (both arrive as strings, or may be omitted entirely).
 *
 * This is the single source of truth for iteration validation -- both
 * `runCollection()` below (used by the CLI) and server.js (used by the web
 * upload) call this same function rather than each having their own
 * validation logic, satisfying Milestone 2's "no duplicated execution logic
 * between CLI and web mode" requirement.
 *
 * @param {string|number|undefined} iterations
 * @returns {number} A validated positive integer, defaulting to 1.
 * @throws {Error} If a value was given but isn't a valid positive integer,
 *   or exceeds the sanity ceiling.
 */
function normalizeIterations(iterations) {
    if (iterations === undefined || iterations === null || iterations === '') {
        return 1;
    }

    const n = Number(iterations);

    if (!Number.isInteger(n) || n < 1) {
        throw new Error(
            `Invalid iteration count "${iterations}" -- must be a whole number of 1 or more.`
        );
    }

    // A sanity ceiling, not part of the roadmap's explicit spec -- but the
    // web upload path lets anyone submit this number, and an unbounded
    // iteration count is an easy way to tie up the server for a very long
    // time on a single request. 1000 is generous for legitimate use while
    // still bounding worst-case runtime.
    if (n > MAX_ITERATIONS) {
        throw new Error(
            `Iteration count ${n} exceeds the maximum of ${MAX_ITERATIONS}.`
        );
    }

    return n;
}

const SUPPORTED_DATA_FILE_EXTENSIONS = ['.csv', '.json'];

/**
 * Parses a Postman-style iteration data file (CSV or JSON) into the array of
 * row objects Newman's `iterationData` option expects.
 *
 * This is the single source of truth for data-file parsing/validation --
 * both the CLI (which reads a file from disk) and server.js (which has an
 * uploaded buffer in memory) call this same function with a
 * `{ buffer, filename }` shape, so the parsing rules and error messages are
 * identical regardless of which path a file arrived through, and nothing
 * writes the uploaded data to disk to make this work.
 *
 * @param {object} options
 * @param {Buffer} options.buffer - Raw file contents.
 * @param {string} options.filename - Original filename, used only to detect
 *   CSV vs JSON by extension (never stored or exposed further than that).
 * @returns {Array<object>} Parsed rows, each an object of column/field name
 *   to value, ready to hand to Newman as `iterationData`.
 * @throws {Error} On an unsupported extension, invalid CSV/JSON, or a file
 *   that parses but contains no usable rows.
 */
function parseDataFile({ buffer, filename }) {
    const ext = path.extname(filename || '').toLowerCase();

    if (!SUPPORTED_DATA_FILE_EXTENSIONS.includes(ext)) {
        throw new Error(
            `Unsupported data file type "${ext || '(no extension)'}" for "${filename}" -- ` +
            `only ${SUPPORTED_DATA_FILE_EXTENSIONS.join(' and ')} are supported.`
        );
    }

    const text = buffer.toString('utf8');

    if (ext === '.json') {
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (parseErr) {
            throw new Error(`"${filename}" is not valid JSON: ${parseErr.message}`);
        }

        if (!Array.isArray(parsed)) {
            throw new Error(
                `"${filename}" must contain a JSON array of row objects, ` +
                `e.g. [{ "customerId": "10001" }, { "customerId": "10002" }].`
            );
        }

        if (parsed.length === 0) {
            throw new Error(`"${filename}" is an empty array -- add at least one row of data.`);
        }

        return parsed;
    }

    // .csv
    let records;
    try {
        records = parseCsvSync(text, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
    } catch (parseErr) {
        throw new Error(`"${filename}" could not be parsed as CSV: ${parseErr.message}`);
    }

    if (records.length === 0) {
        throw new Error(`"${filename}" has no data rows (only a header row, or the file is empty).`);
    }

    return records;
}

/**
 * Runs a Postman collection through Newman, sanitizes the results, and writes
 * the HTML + JSON reports.
 *
 * This is the same pipeline the CLI entry point below runs -- it's just been
 * pulled out into a function so `server.js` (the web upload backend) can call
 * it directly instead of duplicating the logic.
 *
 * @param {object} options
 * @param {object} options.collection - Parsed Postman collection JSON.
 * @param {object} [options.environment] - Parsed Postman environment JSON.
 *   Entirely optional -- when omitted, Newman runs exactly as it always has.
 *   Only the environment's `name` is ever surfaced in report metadata; the
 *   environment object itself (which may contain secret values) is never
 *   written to the JSON/HTML report or included in the resolved data.
 * @param {Array<object>} [options.dataFile] - Parsed iteration data rows
 *   (already run through `parseDataFile()` by the caller). When provided
 *   without an explicit `iterations`, Newman's own default behavior runs
 *   the collection once per row -- that's intentional, matching how Newman
 *   itself treats a data file with no explicit `-n`/iterationCount.
 * @param {string|number} [options.iterations] - How many times to run the
 *   collection (Newman's `iterationCount`). If omitted: defaults to 1 with
 *   no data file (identical to pre-Milestone-2 behavior), or to the data
 *   file's row count when one is provided.
 * @param {string} [options.reportBaseName] - Filename (without extension) used
 *   for the generated reports. Defaults to 'report', matching the original
 *   single-collection CLI behavior. The web server passes a unique name per
 *   upload so concurrent runs don't overwrite each other.
 * @returns {Promise<{ htmlPath: string, jsonPath: string, summary: object, sanitizedSummary: object, reportData: object, collectionName: string, environmentName: string|null, iterations: number }>}
 */
function runCollection({ collection, environment, dataFile, iterations, reportBaseName = 'report' }) {
    return new Promise((resolve, reject) => {

        // Was an iteration count explicitly requested, or should Newman's
        // own default apply? This matters specifically when a data file is
        // present: Newman's native behavior (verified directly against the
        // installed newman version, not assumed from docs) is to run once
        // per data row when iterationCount is omitted entirely -- which is
        // exactly what "data-driven testing" should mean by default. Pinning
        // an explicit iterationCount unconditionally would silently override
        // that and break the natural one-run-per-row behavior.
        const iterationsExplicitlyGiven =
            iterations !== undefined && iterations !== null && iterations !== '';

        const iterationCount = normalizeIterations(iterations);

        // Only add the `environment` key to Newman's run options when one was
        // actually supplied -- Newman treats a present-but-undefined value
        // differently in some versions, so this keeps collection-only runs
        // byte-for-byte identical to before this feature existed.
        const runOptions = {
            collection,
            // reporters: ['cli']
        };

        if (environment) {
            runOptions.environment = environment;
        }

        if (dataFile) {
            runOptions.iterationData = dataFile;

            if (iterationsExplicitlyGiven) {
                runOptions.iterationCount = iterationCount;
            }
            // else: leave iterationCount unset so Newman defaults to one
            // iteration per data row.
        } else {
            // No data file -- iterationCount always applies here, same as
            // Milestone 2, defaulting to 1 when not specified.
            runOptions.iterationCount = iterationCount;
        }

        newman.run(
            runOptions,
            async (err, summary) => {

                if (err) {
                    reject(err);
                    return;
                }

                try {

                    // =====================================
                    // Sanitize Newman Result
                    // =====================================

                    const sanitizedSummary =
                        JSON.parse(JSON.stringify(summary));


                    // Newman's summary carries the FULL resolved collection,
                    // environment, and globals as top-level fields alongside
                    // `run` -- including, for environment/globals, every
                    // variable value as a `{key, value}` pair. That shape
                    // evades the key-name-based sanitizer below entirely
                    // (it looks for a property literally NAMED "apiKey", not
                    // a property named "value" that happens to hold one),
                    // so a secret stored as an environment variable would
                    // otherwise be written straight into the JSON report.
                    // None of this project's reporting logic reads these
                    // fields -- only `run` -- so the safest fix is removing
                    // them outright rather than trying to sanitize a shape
                    // the generic sanitizer wasn't designed for.
                    delete sanitizedSummary.collection;
                    delete sanitizedSummary.environment;
                    delete sanitizedSummary.globals;



                    sanitizedSummary.run.executions?.forEach(exec => {


                        if (exec.request) {

                            exec.request.header = [];

                        }



                        if (exec.response) {

                            exec.response.header = [];


                            const body =
                                bufferToText(
                                    exec.response.stream
                                );


                            exec.response.bodyText =
                                sanitizeBody(body);


                            delete exec.response.stream;

                        }



                        if (exec.assertions) {

                            exec.assertions.forEach(assertion => {

                                if (assertion.error?.message) {

                                    assertion.error.message =
                                        sanitizeString(
                                            assertion.error.message
                                        );

                                }

                            });

                        }


                    });



                    sanitizeObject(sanitizedSummary);



                    // =====================================
                    // Build Report Data
                    // =====================================

                    const collectionName =
                        collection.info?.name || 'Collection';


                    const collectionVersion =
                        getCollectionVersion(
                            collection.info?.version
                        );


                    // Environment name only -- never the environment object
                    // itself. Postman environment files are exactly the kind
                    // of file that carries API keys, tokens, and base URLs
                    // for internal systems, so the raw values must never
                    // reach a written report, even a sanitized one.
                    const environmentName =
                        environment?.name || null;


                    const generatedAt =
                        new Date().toLocaleString();



                    const reportData =
                        parseNewmanResults(
                            summary,
                            sanitizedSummary
                        );



                    // =====================================
                    // Reports Directory
                    // =====================================

                    fs.mkdirSync(
                        reportsDir,
                        {
                            recursive: true
                        }
                    );

                    const jsonReportPath =
                        path.join(
                            reportsDir,
                            `${reportBaseName}.json`
                        );


                    fs.writeFileSync(
                        jsonReportPath,
                        JSON.stringify(
                            sanitizedSummary,
                            null,
                            2
                        )
                    );



                    const htmlReportPath =
                        path.join(
                            reportsDir,
                            `${reportBaseName}.html`
                        );




                    // =====================================
                    // Generate HTML Report
                    // =====================================

                    generateReport({

                        collectionName,

                        collectionVersion,

                        environmentName,

                        generatedAt,

                        ...reportData,

                        outputPath: htmlReportPath

                    });

                    // PDF export is best-effort: it needs the optional
                    // `puppeteer` dependency. If it's not installed, the
                    // HTML/JSON reports are still generated successfully --
                    // only the PDF is skipped, with a clear one-line notice.
                    let pdfPath = null;
                    try {
                        pdfPath = path.join(reportsDir, `${reportBaseName}.pdf`);
                        await generatePdf(htmlReportPath, pdfPath);
                    } catch (pdfErr) {
                        pdfPath = null;
                        console.warn(`⚠️  Skipped PDF export: ${pdfErr.message}`);
                    }

                    resolve({
                        htmlPath: htmlReportPath,
                        jsonPath: jsonReportPath,
                        pdfPath,
                        summary,
                        sanitizedSummary,
                        reportData,
                        collectionName,
                        environmentName,
                        // The REAL count Newman actually ran, not our
                        // pre-computed guess -- when a data file drives the
                        // count implicitly, iterationCount above may never
                        // even have been set, so summary.run.stats is the
                        // only accurate source of truth here.
                        iterations: summary.run.stats.iterations?.total ?? iterationCount
                    });

                } catch (buildErr) {
                    reject(buildErr);
                }
            }
        );
    });
}

// ===========================================
// CLI entry point
// Only runs when this file is executed directly (`node index.js`) -- not when
// it's `require()`d by server.js, so the web server can reuse `runCollection`
// without also triggering the hardcoded single-file collection run below.
// ===========================================

// Tiny, dependency-free flag parser -- just enough for `--flag value` pairs.
// Not a general-purpose CLI parser; this project doesn't need one.
function parseCliArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--')) {
            const key = argv[i].slice(2);
            const next = argv[i + 1];
            const hasValue = typeof next === 'string' && !next.startsWith('--');
            args[key] = hasValue ? next : true;
            if (hasValue) i++;
        }
    }
    return args;
}

if (require.main === module) {

    const cliArgs = parseCliArgs(process.argv.slice(2));

    // --- Collection: explicit --collection flag, or auto-discover as before ---
    let collectionPath;

    if (cliArgs.collection) {
        collectionPath = path.resolve(__dirname, cliArgs.collection);

        if (!fs.existsSync(collectionPath)) {
            console.error(`❌ Collection file not found: ${collectionPath}`);
            process.exit(1);
        }
    } else {
        const collectionsDir = path.resolve(__dirname, 'collections');

        // Auto-discover the collection to run instead of relying on a hardcoded
        // filename -- keeps the CLI working no matter what's actually dropped
        // into collections/, and avoids the "file not found" trap of a stale
        // hardcoded name.
        if (!fs.existsSync(collectionsDir)) {
            console.error('❌ collections/ folder not found.');
            process.exit(1);
        }

        const collectionFiles = fs.readdirSync(collectionsDir)
            .filter(f => f.toLowerCase().endsWith('.json'))
            .sort();

        if (collectionFiles.length === 0) {
            console.error('❌ No .postman_collection.json file found in collections/.');
            process.exit(1);
        }

        if (collectionFiles.length > 1) {
            console.log(`ℹ️  Multiple collections found in collections/ -- using "${collectionFiles[0]}".`);
            console.log('   (Pass --collection <path> to pick a specific one, or use `node server.js`.)');
        }

        collectionPath = path.join(collectionsDir, collectionFiles[0]);
    }

    const collection = JSON.parse(
        fs.readFileSync(collectionPath, 'utf8')
    );

    // --- Environment: optional --environment flag. No auto-discovery here on
    // purpose -- silently picking "some" environment file would be far more
    // dangerous than silently picking "some" collection (wrong base URLs,
    // wrong credentials), so this only ever activates when explicitly asked. ---
    let environment;

    if (cliArgs.environment) {
        const environmentPath = path.resolve(__dirname, cliArgs.environment);

        if (!fs.existsSync(environmentPath)) {
            console.error(`❌ Environment file not found: ${environmentPath}`);
            process.exit(1);
        }

        environment = JSON.parse(
            fs.readFileSync(environmentPath, 'utf8')
        );

        console.log(`ℹ️  Using environment "${environment.name || cliArgs.environment}".`);
    }

    // --- Data file: optional --data flag (CSV or JSON). No auto-discovery,
    // same reasoning as --environment above: silently picking "some" data
    // file if multiple exist would be far more surprising than silently
    // picking "some" collection. ---
    let dataFile;

    if (cliArgs.data) {
        const dataFilePath = path.resolve(__dirname, cliArgs.data);

        if (!fs.existsSync(dataFilePath)) {
            console.error(`❌ Data file not found: ${dataFilePath}`);
            process.exit(1);
        }

        try {
            dataFile = parseDataFile({
                buffer: fs.readFileSync(dataFilePath),
                filename: path.basename(dataFilePath)
            });
        } catch (err) {
            console.error(`❌ ${err.message}`);
            process.exit(1);
        }

        console.log(`ℹ️  Using data file "${path.basename(dataFilePath)}" (${dataFile.length} row(s)).`);
    }

    // --- Iterations: optional --iterations flag. Pre-validated here (via the
    // same normalizeIterations() that runCollection() calls internally)
    // purely for a fast, clean CLI error message -- but the RAW flag value,
    // not the normalized one, is what actually gets passed to runCollection()
    // below. runCollection needs to distinguish "no flag given at all" from
    // "flag given as 1" to correctly default to one-iteration-per-data-row
    // when a data file is present and no count was explicitly requested; a
    // pre-normalized value here would collapse that distinction. ---
    try {
        normalizeIterations(cliArgs.iterations); // validate only; result intentionally discarded
    } catch (err) {
        console.error(`❌ ${err.message}`);
        process.exit(1);
    }

    if (cliArgs.iterations) {
        console.log(`ℹ️  Running ${cliArgs.iterations} iteration(s).`);
    }

    runCollection({ collection, environment, dataFile, iterations: cliArgs.iterations })
        .then(({ htmlPath, jsonPath, pdfPath }) => {
            console.log('\n✅ Reports generated');
            console.log(`📄 HTML : ${htmlPath}`);
            console.log(`📄 JSON : ${jsonPath}`);
            if (pdfPath) {
                console.log(`📄 PDF  : ${pdfPath}`);
            }
        })
        .catch(err => {
            console.error('❌ Newman failed');
            console.error(err);
            process.exit(1);
        });

}

module.exports = { runCollection, reportsDir, normalizeIterations, parseDataFile };