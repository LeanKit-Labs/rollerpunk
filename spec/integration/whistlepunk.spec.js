require( "../setup.js" );
var fs = require( "../../src/filesystem.js" );
var postal = require( "postal" );
var wp = require( "whistlepunk" );
var path = require( "path" );
var config = {
	adapters: {}
};

var logFolder = path.resolve( __dirname + "/../../tmp/wp-integration" );
describe( "Whistlepunk Integration", function() {

	var logFactory;
	var log;

	before( function( done ) {
		fs.removeSync( logFolder );
		var adapterPath = path.resolve( __dirname + "/../../src/index.js" );
		config.adapters[ adapterPath ] = {
			level: 4,
			strategy: "size",
			maxSize: 0.08,
			logFolder: logFolder,
			fileName: "wp-integration.log"
		};
		logFactory = wp( postal, config );
		log = logFactory( "wp-test" );

		log.info( "Starting up now" );

		log.warn( "Something might be going on" );

		log.debug( "Here's something you should know about" );

		_.delay( function() {
			done();
		}, 100 );

	} );

	after( function() {
		fs.remove( logFolder );
	} );

	it( "should log some stuff", function() {
		true.should.be.ok;
	} );

} );