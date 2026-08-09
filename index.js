const path = require('path');
const fs = require('fs');
const newman = require('newman');
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
 * @param {string} [options.reportBaseName] - Filename (without extension) used
 *   for the generated reports. Defaults to 'report', matching the original
 *   single-collection CLI behavior. The web server passes a unique name per
 *   upload so concurrent runs don't overwrite each other.
 * @returns {Promise<{ htmlPath: string, jsonPath: string, summary: object, sanitizedSummary: object, reportData: object, collectionName: string, environmentName: string|null }>}
 */
function runCollection({ collection, environment, reportBaseName = 'report' }) {
    return new Promise((resolve, reject) => {

        // Only add the `environment` key to Newman's run options when one was
        // actually supplied -- Newman treats a present-but-undefined value
        // differently in some versions, so this keeps collection-only runs
        // byte-for-byte identical to before this feature existed.
        const runOptions = {
            collection,
            reporters: ['cli']
        };

        if (environment) {
            runOptions.environment = environment;
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
                        environmentName
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

    runCollection({ collection, environment })
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

module.exports = { runCollection, reportsDir };