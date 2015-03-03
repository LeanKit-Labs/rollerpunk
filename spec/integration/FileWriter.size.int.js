require( "../setup.js" );

var fileLogger;
var logFolder = __dirname + "/../logs";
var logName = "fw-size-integration.log";

var line = "Line #"; // 5 byte log line
var maxSize = 0.025; // 25.6 byte max log files
//var maxSize = 1;

describe( "FileWriter Size Strategy Integration Tests", function() {

	before( function() {
		fileLogger = require( "../../src/fileLogger.js" );
	} );

	describe( "filling up log files", function() {

		var fw;

		var archiveCount = 0;

		before( function( done ) {
			this.timeout( 5000 );
			fw = fileLogger( {
				strategy: "size",
				maxSize: maxSize,
				logFolder: logFolder,
				fileName: logName
			} );

			_.times( 25, function( n ) { // Write 125 bytes (25 lines)
				fw.write( line + n );
			} );

			setTimeout( function() {
				done();
			}, 4000 );

		} );

		it( "should write some logs", function( done ) {
			console.log( archiveCount );
			done();
		} );

	} );

} );