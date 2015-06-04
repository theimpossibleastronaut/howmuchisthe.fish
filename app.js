var restify = require( 'restify' );
var bindIp = '0.0.0.0', bindPort = '8080';
var quotes = require('./model.js').model;
var crypto = require('crypto');
var ua = require('universal-analytics');
var visitor = ua('UA-2158627-15');
var fs = require('fs');
var testNLP = false;

var og = []; var oga = []; var ogt = [];
var bg = []; var bga = []; var bgt = [];

var server = restify.createServer( {

    name: 'howmuchisthe.fish',
    handleUpgrades: true

} );

server.use( restify.queryParser() );
server.use( restify.bodyParser() );
server.use( restify.CORS() );
server.use(restify.jsonp());
server.use(restify.gzipResponse());
server.use(restify.throttle({
  burst: 50,
  rate: 30,
  ip: true
  }
));

server.get( {path: '/json'}, noRequest );
server.get( {path: '/json/random'}, randomQuote );
server.get( {path: '/json/random/generate'}, generateQuote );
server.get( {path: '/json/daily'}, dailyQuote );
server.get( {path: '/json/perma/:quoteId'}, fixedQuote );

server.get(/.*/, restify.serveStatic({

    'directory': 'htdocs',
    'default': 'index.html'

}));

server.pre(restify.pre.userAgentConnection());

server.listen( bindPort, bindIp, function() {

    console.log( '%s listening at %s ', server.name , server.url );
    console.log( '#Quotes %s', quotes.length );
    console.log( 'Generating data for generation callback' );

    annotateModel();
    setupNLP();

    console.log( 'Ready.' );

});

function randomQuote( req, res, next ) {

    res.setHeader('Access-Control-Allow-Origin','*');

    var index = Math.floor(Math.random() * (quotes.length)) ;

    visitor.pageview("/json/quote/" + index).send();
    visitor.event("Return Quote", "Random Quote").send()

    res.json( 200, getQuote(index) );
    return next();

}


function dailyQuote( req, res, next ) {

    res.setHeader('Access-Control-Allow-Origin','*');

    var dat = new Date();
    var index = parseInt(dat.getFullYear() + dat.getMonth() + dat.getDay()) % quotes.length;

    visitor.pageview("/json/quote/" + index).send();
    visitor.event("Return Quote", "Daily Quote").send()

    res.json( 200, getQuote(index) );
    return next();

}

function fixedQuote( req, res, next ) {

    res.setHeader('Access-Control-Allow-Origin','*');

    var index = req.params.quoteId;
    if ( typeof( quotes[index] ) == 'undefined' ) {

        var error = { 'error': 'non existent' };

        visitor.event("Quote not found", "Non Existent Quote").send()

        res.send( 404, error );
        return next();

    }

    visitor.pageview("/json/quote/" + index).send();
    visitor.event("Return Quote", "Fixed Quote").send()

    res.json( 200, getQuote(index) );
    return next();

}

function generateQuote( req, res, next ) {

    res.setHeader('Access-Control-Allow-Origin','*');

    visitor.pageview("/json/quote/generated").send();
    visitor.event("Return Quote", "Generate Quote").send()

    res.json( 200, buildQuote() );
    return next();

}


function getQuote( index ) {

    var output = {
        'id': index,
        'permalink': 'http://howmuchisthe.fish/json/perma/' + index,
        'quote': quotes[index]
    };

    return output;
}

function noRequest( req, res, next ) {

    res.setHeader('Access-Control-Allow-Origin','*');

    var error = { 'error': 'no method' };

    res.send( 404, error );
    return next();

}

function setupNLP() {

    var r, t = new Date().getTime();

    r = setupNLPInner('text');
    og = r.og; bg = r.bg;

    r = setupNLPInner('track');
    ogt = r.og; bgt = r.bg;

    r = setupNLPInner('album');
    oga = r.og; bga = r.bg;

    var numtokens = og.length+bg.length+ogt.length+bgt.length+oga.length+bga.length;
    console.log("setupNLP took: " + (new Date().getTime() - t) + "ms for " + numtokens + " tokens" );

    if (testNLP == true) {

        for ( var i = 0; i < 25; i++ ) {

            console.log( generateString( og, bg, 13, 6 ) );

        }

    }
}

function annotateModel() {
    for ( var i = 0 ; i < quotes.length; i++ ) {
        var basename = getBasename(i);
        if (fs.existsSync("htdocs/data/" + basename + ".json")) {
            var data = JSON.parse(fs.readFileSync("htdocs/data/" + basename + ".json", "utf8"));
            for (var attrname in data) { quotes[i][attrname] = data[attrname]; }
        }
    }
}

function setupNLPInner( akey ) {

    var corpora = "";

    for ( var i = 0 ; i < quotes.length; i++ ) {

        corpora = corpora + quotes[i][akey] + " ";

    }

    corpora = corpora.trim().toLowerCase().replace(/[^\w\s\'\.\,]/gim, '');

    var aog = corpora.split(/[\s\,\.]+/);
    var abg = [];

    for (var i = 0, j = aog.length - 1; i < j; i++) {

        // allow dot in right, comma in left.
        if ( abg[i] != "." && abg[i + 1] != "," ) {

            abg[i] = aog[i] + " " + aog[i + 1]

        }

    }

    abg = abg.length ? abg : aog;

    return { bg: abg, og: aog};

}

function buildQuote() {

    return  {
                'quote': {
                            'text': generateString( og, bg, 13, 6 ) + ".",
                            'track': generateString( og.concat(ogt), bg.concat(bgt), 9, 4 ),
                            'album': generateString( og.concat(oga), bg.concat(bga), 7, 4 ),
                            'year': Math.floor(Math.random() * (new Date().getFullYear() - 1994 + 1)) + 1994
                         }
            };

}

function generateString( aog, abg, alenmin, alenmax ) {

    var sWord = aog[Math.floor(Math.random() * aog.length-1) + 1];
    var sLength = Math.floor(Math.random() * (alenmax - alenmin + 1)) + alenmin;
    var sTokens = [];

    var searchWord = sWord;

    for (var i=0; i < sLength; i++) {

        var tokenList = [];

        for (var j = 0 ; j < abg.length; j++) {

            var token = abg[j].split(" ");
            if (token[0] == searchWord) {

                tokenList.push(token);

            }

        }

        var lToken = tokenList[Math.floor(Math.random() * tokenList.length-1) + 1];
        sTokens.push(lToken[0]);
        searchWord = lToken[1];

        if (i == sLength - 1 && lToken[0].length < 4) {

            sLength++;

        }

        // Quit if we encounter period.
        if (searchWord == ".") {

            break;

        }

    }

    return sTokens.join(" ");

}

function getBasename( aQuoteIndex ) {
    return crypto.createHash('sha1').update(quotes[aQuoteIndex].year + "-" + quotes[aQuoteIndex].album).digest('hex');
}
