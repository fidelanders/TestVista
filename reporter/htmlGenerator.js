const fs=require('fs');
const path=require('path');


const header =
require('./components/header');


const summary =
require('./components/summaryCards');


const testCards =
require('./components/testCard');


const footer =
require('./components/footer');



function generateReport(data){


const css =
fs.readFileSync(
path.join(__dirname,'styles.css'),
'utf8'
);


const script =
fs.readFileSync(
path.join(__dirname,'reportScript.js'),
'utf8'
);



const html = `

<!DOCTYPE html>

<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <style>${css}</style>
</head>

${header(data)}

<div class="container">

${summary(data)}

${testCards(data)}

${footer()}


</div>

<script>${script}</script>

</body>


</html>

`;



fs.writeFileSync(
data.outputPath,
html
);


}



module.exports = generateReport;
