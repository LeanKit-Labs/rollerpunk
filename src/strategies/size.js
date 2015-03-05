var debug = require( "debug" )( "wp:strategy:size" );
var moment = require( "moment" );
var _ = require( "lodash" );
var path = require( "path" );
var config;
var maxSize;
var extension;
var baseName;
var stampFormat = "YYYY-MM-DD_HH-mm-SSS";
var stampMatcher = /(\d{4}\-\d{2}\-\d{2}_\d{2}\-\d{2}\-\d{3})/;
var stampLength = stampFormat.length;
var stampSlice = -1 * stampLength;

function parsePath( filePath ) {
	var ext = path.extname( filePath );
	var base = path.basename( filePath, ext );

	return {
		extension: ext,
		basename: base
	};
}

function getStampString( parsed ) {
	var found = parsed.basename.match( stampMatcher );
	return found ? found[ 0 ] : null;
}

function getTimeStamp( timestampString ) {
	return moment( timestampString, stampFormat ).valueOf();
}

var timestampSort = _.compose( getTimeStamp, getStampString, parsePath );

var strategy = {

	verify: function( fileStats, _currentStats ) { // The function for checking the filesize
		var currentStats = _currentStats || {};
		var size = currentStats.size || fileStats.size;

		return size <= maxSize;
	},

	getArchivedFileName: function() { // Function for generating log filename
		var stamp = moment().format( stampFormat );

		return baseName + "_" + stamp + extension;
	},

	getRemoveableFiles: function( fileList ) {
		if ( !config.maxLogFiles ) {
			return when( true );
		}
		return when.promise( function( resolve, reject ) {

			if ( fileList.length <= config.maxLogFiles ) {
				return resolve( null );
			}

			var removeCount = fileList.length - config.maxLogFiles;
			var sorted = _.sortBy( fileList, timestampSort );
			var toRemove = sorted.slice( 0, removeCount );

			resolve( toRemove );
		} );
	}

};

module.exports = function( _config ) {
	config = _config;

	maxSize = config.maxSize * 1024; // Convert given maxSize to bytes

	var parsed = parsePath( config.fileName );

	extension = parsed.extension;
	baseName = parsed.basename;

	debug( "Loading size strategy" );
	debug( "Max File Size: %s", maxSize );

	return strategy;
};