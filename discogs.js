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
    dis = new Discogs('HowMuchIsTheFishAnnotator/1.1', {userToken: apiKey});
    db = dis.database();
}

function getBasename( aQuoteIndex ) {
    return crypto.createHash('sha1').update(quotes[aQuoteIndex].year + "-" + quotes[aQuoteIndex].album + "-" + quotes[aQuoteIndex].track).digest('hex');
}

var procesIndex = 0;
var processed = [];
function process(aQuoteIndex) {

    myInterval = 15000;

    console.log("------------------------------------------");
    console.log("Processing " + quotes[aQuoteIndex].year + "-" + quotes[aQuoteIndex].album + "-" + quotes[aQuoteIndex].track);

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

var dataset = {
    basename: false,
    datFile: false,
    album: false,
    track: false
}

function annotateQuote( aQuoteIndex ) {
    dataset = {
        basename: getBasename(aQuoteIndex),
        quoteindex: aQuoteIndex,
        album: false,
        track: false
    }

    dataset.datFile = "htdocs/data/" + dataset.basename,

    setTimeout(function() {
        db.search(
        quotes[dataset.quoteindex].album,
        {
            "per_page": 1,
            "page": 1,
            "type": "release",
            "artist": "scooter",
            "year": quotes[dataset.quoteindex].year
        }, function(err, data) {
            if (err) {
                console.log(err);
            } else {
                if (typeof(data.results) != "undefined" && data.results.length > 0 ){
                    db.release(data.results[0].id, function(err,data) {
                        dataset.album = data;
                        isAnnotationComplete();
                    });
                } else {
                    console.log("Album lookup failed");
                    dataset.album = undefined;
                    isAnnotationComplete();
                }
            }
        });
    }, 1000);

    setTimeout(function() {
        db.search(
        "",
        {
            "per_page": 1,
            "page": 1,
            "track": quotes[aQuoteIndex].track,
            "type": "release",
            "artist": "scooter",
            "year": quotes[aQuoteIndex].year
        }, function(err, data) {
            if (err) {
                console.log(err);
            } else {
                if (typeof(data.results) != "undefined" && data.results.length > 0 ){
                    db.release(data.results[0].id, function(err,data) {
                        dataset.track = data;
                        isAnnotationComplete();
                    });
                } else {
                    console.log("Track lookup failed");
                    dataset.track = undefined;
                    isAnnotationComplete();
                }
            }
        });
    }, 2250);

}

function isAnnotationComplete() {
    if (dataset.album !== false && dataset.track !== false) {
        var dataparsed = {
            "album_information": dataset.album.uri,
            "album_cover": dataset.album.images[0].resource_url,
            "album_thumb": dataset.album.thumb,
            "releasedate": dataset.album.released
        }

        if (typeof(dataset.track) != "undefined") {
            if (typeof(dataset.track.images) != "undefined" && dataset.track.images > 0) {
                dataparsed["track_cover"] = dataset.track.images[0].resource_url;
            }
            dataparsed["track_thumb"] = dataset.track.thumb;
            dataparsed["track_master"] = dataset.track.uri;

            if (typeof(dataset.track.videos) != "undefined" &&
                dataset.track.videos.length > 0) {
                dataparsed["videos"] = [];
                for (var i = 0; i < dataset.track.videos.length; i++) {
                    dataparsed["videos"].push({
                        title: dataset.track.videos[i].title,
                        link: dataset.track.videos[i].uri,
                    });
                }
            }
        }

        fs.writeFileSync(dataset.datFile + ".json", JSON.stringify(dataparsed));
        fs.writeFileSync(dataset.datFile + ".dat", JSON.stringify(dataset));
        console.log("Wrote json & dat file to disk");

        dataset = {
            basename: false,
            datFile: false,
            album: false,
            track: false
        }
    }
}

