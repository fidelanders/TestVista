// parser/newmanParser.js


function prettyPrintIfJson(text) {

    if (!text) return '';

    try {
        return JSON.stringify(
            JSON.parse(text),
            null,
            2
        );
    }
    catch {
        return text;
    }

}



function buildFailuresMap(summary) {

    const failuresByRef = {};


    (summary.run.failures || []).forEach(failure => {

        const ref =
            failure.cursor?.ref ||
            failure.cursor?.httpRequestId ||
            failure.source?.id;


        if (!ref) return;


        if (!failuresByRef[ref]) {
            failuresByRef[ref] = [];
        }


        failuresByRef[ref].push({

            assertion:
                failure.error?.test ||
                failure.error?.name ||
                'Failure',


            message:
                failure.error?.message ||
                String(failure.error || 'Unknown error')

        });


    });


    return failuresByRef;

}




function parseNewmanResults(summary, sanitizedSummary) {


    const failuresByRef =
        buildFailuresMap(summary);



    const testCards =
    (sanitizedSummary.run.executions || [])
    .map((exec, idx)=>{


        const rawExec =
            summary.run.executions?.[idx];


        const name =
            exec.item?.name ||
            `Request ${idx + 1}`;



        const method =
            exec.request?.method ||
            'N/A';



        const urlRaw =
            exec.request?.url;



        let url = '';



        if(typeof urlRaw === 'string') {

            url = urlRaw;

        }
        else if(urlRaw) {


            url =
                urlRaw.raw ||
                (
                    Array.isArray(urlRaw.host)

                    ?

                    `${urlRaw.protocol || 'https'}://${urlRaw.host.join('.')}${urlRaw.path ? '/' + urlRaw.path.join('/') : ''}`

                    :

                    ''

                );

        }




        const statusCode =
            exec.response?.code ?? 0;


        const statusText =
            exec.response?.status || '';


        const responseTime =
            exec.response?.responseTime ?? 0;


        const assertions =
            Array.isArray(exec.assertions)
            ? exec.assertions
            : [];


        const ref =
            rawExec?.cursor?.ref ||
            rawExec?.cursor?.httpRequestId;


        const matchedFailures =
            (ref && failuresByRef[ref]) || [];


        const hasHttpError =
            statusCode >= 400 ||
            statusCode === 0;


        const passed =
            matchedFailures.length === 0 &&
            !(assertions.length === 0 && hasHttpError);



        const failedAssertions =
            matchedFailures.length

            ?

            matchedFailures.map(
                f => `${f.assertion}: ${f.message}`
            )

            :

            (
                hasHttpError &&
                assertions.length === 0

                ?

                [
                `Request returned ${statusCode || 'no response'} ${statusText}`.trim()
                ]

                :

                []

            );




        return {

            name,
            method,
            url,

            statusCode,
            statusText,

            responseTime,

            passed,

            totalAssertions:
                assertions.length,

            failedAssertions,

            bodyText:
                prettyPrintIfJson(
                    exec.response?.bodyText
                )

        };


    });



    const totalRequests =
        testCards.length;



    const passedRequests =
        testCards.filter(
            t => t.passed
        ).length;



    const failedRequests =
        totalRequests -
        passedRequests;



    const successRate =
        totalRequests
        ?
        (
            passedRequests /
            totalRequests *
            100
        ).toFixed(2)

        :

        "0.00";



    const responseTimes =
        testCards
        .map(t=>t.responseTime)
        .filter(
            t=>typeof t === 'number'
        );



    const avgResponse =
        responseTimes.length
        ?

        Math.round(
            responseTimes.reduce(
                (a,b)=>a+b,
                0
            )
            /
            responseTimes.length
        )

        :

        0;



    const maxResponse =
        responseTimes.length
        ?
        Math.max(...responseTimes)
        :
        0;



    const minResponse =
        responseTimes.length
        ?
        Math.min(...responseTimes)
        :
        0;



    const totalAssertions =
        summary.run.stats.assertions?.total ?? 0;



    const failedAssertionsCount =
        summary.run.stats.assertions?.failed ?? 0;



    return {

        testCards,

        totalRequests,
        passedRequests,
        failedRequests,

        successRate,

        avgResponse,
        maxResponse,
        minResponse,

        totalAssertions,
        failedAssertionsCount

    };


}



module.exports = parseNewmanResults;
