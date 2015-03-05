var _ = require( "lodash" );
var moment = require( "moment" );
var fileLogger = require( "./fileLogger.js" );
var logger;
var adapter;

var defaultOptions = {
	strategy: "size", // could be "time"
	maxSize: 500, // in KB; how large the file is allowed to grow before a new log is created [size strategy]
	maxLogFiles: 0, // number archived log files allowed in the folder
	logFolder: "/var/log", // Path to folder where logs should be kept
	fileName: "whistlepunk.log", // Base name to be used for naming log files,
	maxUnwritten: 1000, // Maximum number of queued log writes when FileWriter is in an invalid state
	maxConsecutiveReboots: 25, // Number of times the log will try to restart itself consecutively before giving up
	rebootInterval: 60 // Number of seconds in between
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