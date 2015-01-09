var restify = require( 'restify' );
var bindIp = '0.0.0.0', bindPort = '8080';
var quotes = require('./model.js').model;
var ua = require('universal-analytics');
var visitor = ua('UA-2158627-15');

var og = [];
var bg = [];

var server = restify.createServer( {

    name: 'howmuchisthe.fish',
    handleUpgrades: true

} );

server.use( restify.queryParser() );
server.use( restify.bodyParser() );
server.use( restify.CORS() );

server.get( {path: '/json'}, noRequest );
server.get( {path: '/json/random'}, randomQuote );
server.get( {path: '/json/random/generate'}, generateQuote );
server.get( {path: '/json/daily'}, dailyQuote );
server.get( {path: '/json/perma/:quoteId'}, fixedQuote );

server.get(/.*/, restify.serveStatic({

    'directory': 'htdocs',
    'default': 'index.html'

}));

server.listen( bindPort, bindIp, function() {

    console.log( '%s listening at %s ', server.name , server.url );
    console.log( '#Quotes %s', quotes.length );
    console.log( 'Generating data for generation callback' );

    setupNLP();

    console.log( 'Ready.' );

});

function randomQuote( req, res, next ) {

    res.setHeader('Access-Control-Allow-Origin','*');

    var index = Math.floor(Math.random() * (quotes.length)) ;

    visitor.pageview("/json/quote/" + index).send();
    visitor.event("Return Quote", "Random Quote").send()

    res.send( 200, getQuote(index) );
    return next();

}


function dailyQuote( req, res, next ) {

    res.setHeader('Access-Control-Allow-Origin','*');

    var dat = new Date();
    var index = parseInt(dat.getFullYear() + dat.getMonth() + dat.getDay()) % quotes.length;

    visitor.pageview("/json/quote/" + index).send();
    visitor.event("Return Quote", "Daily Quote").send()

    res.send( 200, getQuote(index) );
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

    res.send( 200, getQuote(index) );
    return next();

}

function generateQuote( req, res, next ) {

    res.setHeader('Access-Control-Allow-Origin','*');

    visitor.pageview("/json/quote/generated").send();
    visitor.event("Return Quote", "Generate Quote").send()

    res.send( 200, buildQuote() );
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

    var corpora = "";

    for ( var i = 0 ; i < quotes.length; i++ ) {

        corpora = corpora + quotes[i].text + " ";

    }

    corpora = corpora.toLowerCase().replace(/[^\w\s\']/gim, '');

    og = corpora.split(" ");
    bg = [];

    for (var i = 0, j = og.length - 1; i < j; i++) {

        bg[i] = og[i] + " " + og[i + 1]

    }

    bg =  bg.length ? bg : og;

}

function buildQuote() {

    var sWord = og[Math.floor(Math.random() * og.length-1) + 1];
    var sLength = Math.floor(Math.random() * (15 - 9 + 1)) + 9;
    var sQuote = ""; var sTokens = [];

    var searchWord = sWord;

    for (var i=0; i < sLength; i++) {

        var tokenList = [];

        for (var j = 0 ; j < bg.length; j++) {

            var token = bg[j].split(" ");
            if (token[0] == searchWord) {
                tokenList.push(token);
            }

        }

        var lToken = tokenList[Math.floor(Math.random() * tokenList.length-1) + 1];
        sTokens.push(lToken[0]);
        searchWord = lToken[1];

        if (i == sLength-1 && lToken[0].length < 4) {
            sLength++;
        }

    }

    sQuote = sTokens.join(" ") + ".";

    return { 'quote': { 'text': sQuote } };

}