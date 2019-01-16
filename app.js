var restify = require( 'restify' );
var bindIp = '0.0.0.0', bindPort = '8080';
var quotes = require('./model.js').model;
var crypto = require('crypto');
var ua = require('universal-analytics');
var visitor = ua('UA-2158627-15');
var fs = require('fs');
var rita = require('rita');
var testNLP = false;
var rms;

var { graphql, buildSchema } = require( 'graphql' );
var gqlSchema = buildSchema( fs.readFileSync( './htdocs/schema.gql', 'utf8' ) );
var gqlImpl = {
    random: function () {

        var index = Math.floor(Math.random() * (quotes.length)) ;

        visitor.pageview("/graphql/quote/" + index).send();
        visitor.event("Return Quote", "Random Quote").send()

        var quote = flattenQuote( getQuote(index) );

        return quote;
    },
    video: function () {
        var theObject = {
            "title": null,
            "link": null
        };

        var index;
        var theQuote;

        while(theObject.title === null) {
            index = Math.floor(Math.random() * (quotes.length)) ;
            theQuote = getQuote(index);

            if (theQuote.quote.videos && theQuote.quote.videos.length > 0) {
                var video = theQuote.quote.videos[Math.floor(Math.random() * (theQuote.quote.videos.length))];
                theObject.title = video.title;
                theObject.link = video.link;
            }
        }

        visitor.pageview("/json/random/video/" + index).send();
        visitor.event("Return Video", "Random Video").send()

        return theObject;
    },
    daily: function () {
        var dat = new Date();
        var index = parseInt(dat.getFullYear() + dat.getMonth() + dat.getDay()) % quotes.length;

        visitor.pageview("/graphql/quote/" + index).send();
        visitor.event("Return Quote", "Daily Quote").send()

        var quote = flattenQuote( getQuote(index) );

        return quote;

    },
    quote: function ( params ) {
        var quote = {};

        if ( typeof( quotes[ parseInt( params.id ) ] ) !== 'undefined' ) {
            visitor.pageview("/graphql/quote/" + params.id).send();
            visitor.event("Return Quote", "Fixed Quote").send()

            quote = flattenQuote( getQuote( parseInt( params.id ) ) );
        } else {
            throw new Error( "Quote doesn't exist" );
        }

        return quote;
    }
};

var server = restify.createServer( {

    name: 'howmuchisthe.fish',
    handleUpgrades: true,
    version: '1.2.0'

} );

server.use( restify.plugins.queryParser() );
server.use( restify.plugins.bodyParser() );

server.get( {path: '/json'}, noRequest );
server.get( {path: '/json/random'}, randomQuote );
server.get( {path: '/json/random/generate'}, generateQuote );
server.get( {path: '/json/random/video'}, randomVideo );
server.get( {path: '/json/daily'}, dailyQuote );
server.get( {path: '/json/perma/:quoteId'}, fixedQuote );

server.get( {path: '/graphql'}, noGql );
server.post( {path: '/graphql'}, parseGql );
server.opts( {path: '/graphql'}, optsGql );

server.get( {path: '/*'}, restify.plugins.serveStatic({
    directory: './htdocs',
    default: '/index.html'
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

function randomVideo( req, res, next ) {

    res.setHeader('Access-Control-Allow-Origin','*');

    var theObject = {
        "quote": {
            "videos": []
        }
    };

    var index;
    var theQuote;

    while(theObject.quote.videos.length < 1) {
        index = Math.floor(Math.random() * (quotes.length)) ;
        theQuote = getQuote(index);

        if (theQuote.quote.videos && theQuote.quote.videos.length > 0) {
            theObject.quote.videos.push(theQuote.quote.videos[Math.floor(Math.random() * (theQuote.quote.videos.length))]);
        }
    }

    visitor.pageview("/json/random/video/" + index).send();
    visitor.event("Return Video", "Random Video").send()

    res.json( 200, theObject );
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
        'hash': getBasename(index),
        'quote': quotes[index]
    };

    return output;
}

function flattenQuote( obj ) {
    var output = obj.quote;
    output.id = obj.id;
    output.permalink = obj.permalink;
    output.hash = obj.hash;

    return output;
}

function noRequest( req, res, next ) {

    res.setHeader('Access-Control-Allow-Origin','*');

    var error = { 'error': 'no method' };

    res.send( 404, error );
    return next();

}

function optsGql ( req, res, next ) {
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');

    var error = { 'ok': 'ok' };

    res.send( 200, error );
    return next();
}

function noGql ( req, res, next ) {
    res.setHeader('Access-Control-Allow-Origin','*');

    var error = { 'error': 'Please POST GraphQL queries' };

    res.send( 400, error );
    return next();
}

function parseGql( req, res, next ) {
    res.setHeader('Access-Control-Allow-Origin','*');

    if ( req.body ) {
        var response = {};
        graphql(
            gqlSchema,
            req.body.query,
            gqlImpl
        ).then( result => {
            res.send( 200, result );

        });

    } else {
        res.send( 400, { "error": "Bad request" } );
    }

    return next();
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

function setupNLP() {
    rms = {
        'text': new rita.RiMarkov(3),
        'track': new rita.RiMarkov(3),
        'album': new rita.RiMarkov(3)
    };

    for ( var i = 0 ; i < quotes.length; i++ ) {
        rms.text.loadText( quotes[i]['text'] );

        var filtered = quotes[i]['text'].replace(/[^A-Za-z\-0-9\s]/g,'');

        rms.track.loadText( filtered );
        rms.album.loadText( filtered );

        filtered = quotes[i]['track'].replace(/[^A-Za-z\-0-9\s]/g,'');
        rms.track.loadText( filtered );

        filtered = quotes[i]['album'].replace(/[^A-Za-z\-0-9\s]/g,'');
        rms.album.loadText( filtered );
    }

    if (testNLP == true) {

        for ( var i = 0; i < 25; i++ ) {

            console.log( generateString( 'text' ) );

        }

    }

}

function buildQuote() {

    return  {
                'quote': {
                            'text': generateString( 'text' ),
                            'track': generateString( 'track' ),
                            'album': generateString( 'album' ),
                            'year': Math.floor(Math.random() * (new Date().getFullYear() - 1994 + 1)) + 1994
                         }
            };

}

function generateString( aKey ) {
    var minLength = 7;
    var maxLength = 12;

    if ( aKey === 'track' ) {
        minLength = 2;
        maxLength = 6;
    } else if ( aKey == 'album' ) {
        minLength = 3;
        maxLength = 7;
    }

    var length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    var tokenList = rms[aKey].generateTokens( length ).filter(word => word.length > 1).join(' ').toLowerCase();
    tokenList = tokenList.charAt(0).toUpperCase() + tokenList.slice(1);

    return tokenList;
}

function getBasename( aQuoteIndex ) {
    return crypto.createHash('sha1').update(quotes[aQuoteIndex].year + "-" + quotes[aQuoteIndex].album + "-" + quotes[aQuoteIndex].track).digest('hex');
}
