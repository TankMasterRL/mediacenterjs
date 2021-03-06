var file_utils = require('../../lib/utils/file-utils')
    , os = require('os')
    , metafetcher = require('../../lib/utils/metadata-fetcher')
	, config = require('../../lib/handlers/configuration-handler').getConfiguration()
	, music_playback_handler = require('./music-playback-handler'); 

// Init Database
var dblite = require('dblite')
if(os.platform() === 'win32'){
    dblite.bin = "./bin/sqlite3/sqlite3";
}
var db = dblite('./lib/database/mcjs.sqlite');
db.on('info', function (text) { console.log(text) });
db.on('error', function (err) { console.error('Database error: ' + err) });

exports.loadItems = function(req, res){
    db.query('SELECT * FROM albums', {
        album 		    : String,
        artist  	    : String,
        year            : Number,
        cover           : String
    },
    function(rows) {
        var albumCount = Object.keys(rows).length;
        fetchMusicData(req, res);
    });
};

exports.playTrack = function(req, res, track, album){
	music_playback_handler.startTrackPlayback(res, track);
};

exports.nextTrack = function(req, res, track, album){
	console.log('track', track)
    var currentTrack = track;
    db.query('SELECT * FROM tracks WHERE album = $album AND CAST(track as integer) > (SELECT track FROM tracks WHERE filename = $track) LIMIT 1 ',{album: album, track:currentTrack}, {
            title       : String,
            track       : Number,
            album       : String,
            artist      : String,
            year        : Number,
            filename    : String,
			filepath	: String
        },
        function(rows) {
            if (typeof rows !== 'undefined' && rows.length > 0){
                var nextTrack = rows[0].filename;
                if(currentTrack === nextTrack){
                    return;
                } else{
                    console.log('NextTrack',nextTrack);
                    music_playback_handler.startTrackPlayback(res, nextTrack);
                }

            } else {
                console.log('error', rows)
            }
        }
    );
};

exports.randomTrack = function(req, res, track, album){
    db.query('SELECT * FROM $album ORDER BY RANDOM() LIMIT 1 ', { album: album }, {
            title   : String,
            track   : Number,
            album   : String,
            artist  : String,
            year    : Number,
            filename: String
        },
        function(rows) {
            if (typeof rows !== 'undefined' && rows.length > 0){
                var track = rows[0].filename;
                music_playback_handler.startTrackPlayback(res, track);
            } else {
                console.log('error', rows)
            }
        }
    );
};

/** Private functions **/


fetchMusicData = function(req, res) {
    var count = 0;
	var dataType = 'music';
    metafetcher.fetch(req, res, dataType, function(type){
        if(type){
		
			getAlbums(function(rows){
		
				var albums = [];

				count = rows.length;
				console.log('Found '+count+' albums, getting additional data...');
				rows.forEach(function(item, value){

					if(item !== null && item !== undefined){
						var album           = item.album
							, artist        = item.artist
							, year          = item.year
							, cover         = item.cover;

						getTracks(album, artist, year, cover, function(completeAlbum){
							count--;
							albums.push(completeAlbum);
							if(count === 0 ){
								console.log('Sending data to client');
								return res.json(albums);
								res.end();
							}
						});
					}

				});
			});
		}
	});
}

getAlbums = function(callback){
	db.query('SELECT * FROM albums ORDER BY album asc', {
		album 		    : String,
		artist  	    : String,
		year            : Number,
		cover           : String
	},
	function(rows) {
		if (typeof rows !== 'undefined' && rows.length > 0){
			callback(rows);
		}
	});
}

getTracks = function (album, artist, year, cover, callback){
    db.query('SELECT * FROM tracks WHERE album = $album ORDER BY track asc ', { album: album }, {
            title   : String,
            track   : Number,
            album   : String,
            artist  : String,
            year    : Number,
            filename: String
        },
        function(rows) {
            if (typeof rows !== 'undefined' && rows.length > 0){

                var completeAlbum ={
                    "album"     : album,
                    "artist"    : artist,
                    "year"      : year,
                    "cover"     : cover,
                    "tracks"    : rows
                }

                callback(completeAlbum);
            }
        }
    );
}