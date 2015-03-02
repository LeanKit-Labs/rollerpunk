var debug = require( "debug" )( "wp:strategy:size" );
var moment = require( "moment" );
var path = require( "path" );
var config;
var maxSize;


var strategy = {

	verify: function( fileStats, _currentStats ) { // The function for checking the filesize
		var currentStats = _currentStats || {};
		var size = currentStats.size || fileStats.size;

		return size <= maxSize;
	},

	getArchivedFileName: function() { // Function for generating log filename
		var extension = path.extname( config.fileName );
		var baseName = path.basename( config.fileName, extension );
		var stamp = moment().format( "YYYY-MM-DD_HH-MM-SSS" );

		return baseName + "_" + stamp + extension;
	}

};

module.exports = function( _config ) {
	config = _config;

	maxSize = config.maxSize * 1024; // Convert given maxSize to bytes

	debug( "Loading size strategy" );
	debug( "Max File Size: %s", maxSize );

	return strategy;
};