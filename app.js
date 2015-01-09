var restify = require( 'restify' );
var bindIp = '0.0.0.0', bindPort = '8080';
var quotes = require('./model.js').model;
var ua = require('universal-analytics');
var visitor = ua('UA-2158627-15');

var server = restify.createServer( {

    name: 'howmuchisthe.fish',
    handleUpgrades: true

} );

server.use( restify.queryParser() );
server.use( restify.bodyParser() );
server.use( restify.CORS() );

server.get( {path: '/json'}, noRequest );
server.get( {path: '/json/random'}, randomQuote );
server.get( {path: '/json/daily'}, dailyQuote );
server.get( {path: '/json/perma/:quoteId'}, fixedQuote );

server.get(/.*/, restify.serveStatic({
    'directory': '.',
    'default': 'index.html'
}));

server.listen( bindPort, bindIp, function() {

    console.log( '%s listening at %s ', server.name , server.url );
    console.log( '#Quotes %s', quotes.length );

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
