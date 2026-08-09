const path = require('path');

/**
 * Renders a generated HTML report to a PDF file using headless Chrome via
 * Puppeteer. Uses the same @page / @media print rules already defined in
 * styles.css (preferCSSPageSize), so the PDF output matches what "Print /
 * Save as PDF" produces in a real browser.
 *
 * Puppeteer is an optional dependency (it downloads a full Chromium build,
 * so it's not something every environment wants). This lazy-requires it and
 * throws a clear, actionable error if it isn't installed, instead of
 * crashing at module-load time and taking the rest of the app down with it.
 *
 * @param {string} htmlFile - Absolute path to the generated report HTML file.
 * @param {string} outputFile - Absolute path to write the PDF to.
 */
async function generatePdf(htmlFile, outputFile) {

    let puppeteer;
    try {
        puppeteer = require('puppeteer');
    } catch (requireErr) {
       
        if (requireErr.code === 'MODULE_NOT_FOUND') {
            throw new Error(
                'PDF export requires the "puppeteer" package, but Node could not find it in ' +
                'this project (' + requireErr.message + '). If you believe it IS installed, check: ' +
                '(1) it was installed locally in this project, not with `npm install -g` -- a global ' +
                'install is invisible to `require()` here; (2) the install actually completed -- ' +
                'puppeteer downloads a bundled Chromium during `npm install`, and since it\'s listed ' +
                'as an optional dependency, a failed download (e.g. on a restricted network) causes ' +
                'npm to silently skip it rather than error; run `npm ls puppeteer` to confirm it\'s ' +
                'really there. The "Print / Save as PDF" button in the report works either way, with ' +
                'no extra install required.'
            );
        }

        throw new Error(
            `PDF export found the "puppeteer" package but failed to load it: ${requireErr.message}`
        );
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        await page.goto(
            `file://${path.resolve(htmlFile)}`,
            { waitUntil: 'networkidle0' }
        );

        // Mirror what the print button does in-browser
        await page.evaluate(() => {
            document.querySelectorAll('details').forEach(el => { el.open = true; });
            document.querySelectorAll('.test-card').forEach(el => { el.style.display = 'block'; });
        });

        await page.pdf({
            path: outputFile,
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            margin: {
                top: '18mm',
                bottom: '18mm',
                left: '15mm',
                right: '15mm'
            }
        });
    } finally {
        await browser.close();
    }

}


module.exports = generatePdf;
