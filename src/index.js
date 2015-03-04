var _ = require( "lodash" );
var moment = require( "moment" );
var fileLogger = require( "./fileLogger.js" );
var logger;
var adapter;

var defaultOptions = {
	strategy: "size", // could be "time"
	maxSize: 500, // in KB; how large the file is allowed to grow before a new log is created [size strategy]
	maxAge: 5, // in days; how long the file is allowed to age before a new log is created [time strategy],
	maxLogFiles: 5, // number of days a log is allowed to live before it is deleted (0 == no deleting)
	logFolder: "/var/log", // Path to folder where logs should be kept
	fileName: "whistlepunk.log" // Base name to be used for naming log files
};

function configure( config ) {

	adapter = adapter || {

		init: function() {
			var _config = _.merge( defaultOptions, ( config || {} ) );

			logger = fileLogger( _config );
		},

		onLog: function( data ) {

			var message = moment( data.timestamp ).format();

			if ( data.namespace ) {
				message += " " + data.namespace;
			}

			message += " [" + data.type + "]" + " " + data.msg;

			logger.write( message );
		}
	};
}

module.exports = function( config ) {
	configure( config );
	return adapter;
};