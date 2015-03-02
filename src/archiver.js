var debug = require( "debug" )( "wp:archiver" );
var when = require( "when" );
var zlib = require( "zlib" );
var fs = require( "./filesystem.js" );

function archive( originalPath, targetPath ) {
	return when.promise( function( resolve, reject ) {
		var gzip = zlib.createGzip();

		var zippedPath = targetPath + ".gz";

		debug( "GZipping %s to %s", originalPath, zippedPath );

		var input = fs.createReadStream( originalPath );
		var output = fs.createWriteStream( zippedPath );

		var stream = input
			.pipe( gzip )
			.pipe( output );

		stream.on( "error", function( err ) {
			reject( err );
		} );

		stream.on( "close", function() {
			resolve();
		} );


	} );
}

module.exports = {
	archive: archive
};