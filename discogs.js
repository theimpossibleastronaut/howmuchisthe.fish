var quotes = require('./model.js').model;
var crypto = require('crypto');
var Discogs = require('disconnect').Client;
var dis,db;
var fs = require('fs');

fs.readFile('.gstoken', 'utf-8', function(err,data) {
    if (err) {
        console.log(err);
    }

    setupDiscogs(data.trim());
    process(0);
});

function setupDiscogs(apiKey) {
    dis = new Discogs('HowMuchIsTheFish/1.0', {userToken: apiKey});
    db = dis.database();
}

function getBasename( aQuoteIndex ) {
    return crypto.createHash('sha1').update(quotes[aQuoteIndex].year + "-" + quotes[aQuoteIndex].album).digest('hex');
}

var procesIndex = 0;
var processed = [];
function process(aQuoteIndex) {

    myInterval = 4000;

    console.log("Processing " + quotes[aQuoteIndex].year + "-" + quotes[aQuoteIndex].album);

    var basename = getBasename(aQuoteIndex);
    console.log(basename);

    if (!fs.existsSync("htdocs/data/" + basename + ".dat")) {
        console.log("annotating");
        annotateQuote(aQuoteIndex);
    } else {
        console.log("skipping");
        myInterval = 25;
    }

    procesIndex = aQuoteIndex + 1;

    if (procesIndex < quotes.length) {
        setTimeout(function(){
            process(procesIndex)
        }, myInterval);
    }

}

function annotateQuote( aQuoteIndex ) {
    db.search(
    quotes[aQuoteIndex].album,
    {
        "per_page": 1,
        "page": 1,
        "type": "release",
        "artist": "scooter",
        "year": quotes[aQuoteIndex].year
    }, function(err, data) {
        if (err) {
            console.log(err);
        } else {
            db.release(data.results[0].id, function(err,data) {
                var basename = getBasename(aQuoteIndex);
                var datFile = "htdocs/data/" + basename;
                fs.writeFileSync(datFile + ".dat", JSON.stringify(data));
                var dataparsed = {
                    "album_information": data.uri,
                    "album_cover": data.images[0].resource_url,
                    "album_thumb": data.thumb,
                    "releasedate": data.released
                }
                fs.writeFileSync(datFile + ".json", JSON.stringify(dataparsed));
            });

        }
    });

}


