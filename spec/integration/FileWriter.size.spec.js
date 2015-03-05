require( "../setup.js" );

var path = require( "path" );
var zlib = require( "zlib" );
var fs = require( "../../src/filesystem.js" );
var fileLogger;
var logFolderBase = __dirname + "/../../tmp/size-integration";
var logName = "fw-size-integration.log";
var moment = require( "moment" );

var line = "Line #"; // 7 or 8 byte line after index is appended
var maxSize = 0.03; // 30.72 byte max log files

// 6 archive files with 4 lines per file
// 1 active file with 1 line

var unzip = function( zippedFile ) {
	return when.promise( function( resolve, reject ) {
		var zippedContents = fs.readFileSync( zippedFile );
		zlib.gunzip( zippedContents, function( err, unzipped ) {
			resolve( unzipped.toString() );
		} );
	} );
};

describe( "FileWriter Size Strategy Integration Tests", function() {

	before( function() {
		fileLogger = require( "../../src/fileLogger.js" );
		fs.removeSync( logFolderBase );
	} );

	after( function() {
		fs.removeSync( logFolderBase );
	} );

	describe( "filling up log files", function() {
		describe( "with cleanup turned off", function() {
			var fw;

			var archives;
			var active = false;
			var lines = [];
			var logFolder = path.resolve( logFolderBase, "./nocleanup" );
			before( function( done ) {
				this.timeout( 5000 );
				fw = fileLogger( {
					strategy: "size",
					maxSize: maxSize,
					logFolder: logFolder,
					fileName: logName
				} );

				_.times( 25, function( n ) { // Write 125 bytes (25 lines)
					lines.push( line + n );
					fw.write( line + n );
				} );

				setTimeout( function() {
					var files = fs.readdirSync( logFolder );

					active = _.contains( files, logName );

					archives = _.filter( files, function( f ) {
						return f.slice( -3 ) === ".gz";
					} );

					archives = _.map( archives, function( name ) {
						return path.resolve( logFolder, name );
					} );

					archives = _.sortBy( archives, function( name ) {
						var stamp = name.slice( -27 ).slice( 0, -7 );
						var time = moment( stamp, "YYYY-MM-DD_HH-mm-SSS" );
						return time.valueOf(); // Have to sort it on the millisecond
					} );

					done();
				}, 1000 );

			} );

			it( "should produce an active log file", function() {
				active.should.be.ok;
			} );

			it( "should put the last line in the active log file", function() {
				fs.readFileSync( path.resolve( logFolder, logName ), "utf-8" ).should.equal( "Line #24\n" );
			} );

			it( "should produce 6 archives", function() {
				archives.length.should.equal( 6 );
			} );

			it( "should archive the messages in order", function( done ) {

				var chunked = _.chunk( lines, 4 );

				var tasks = when.all( _.map( archives, function( filepath ) {
					return unzip( filepath );
				} ) ).then( function( results ) {

					_.each( results, function( r, index ) {
						r.should.equal( chunked[ index ].join( "\n" ) + "\n" );
					} );

					done();
				} );

			} );

		} );

		describe( "with cleanup turned on", function() {
			var fw;

			var archives;
			var active = false;
			var lines = [];
			var logFolder = path.resolve( logFolderBase, "./withcleanup" );
			before( function( done ) {
				this.timeout( 5000 );
				fw = fileLogger( {
					strategy: "size",
					maxSize: maxSize,
					maxLogFiles: 3,
					logFolder: logFolder,
					fileName: logName
				} );

				_.times( 25, function( n ) { // Write 125 bytes (25 lines)
					lines.push( line + n );
					fw.write( line + n );
				} );

				setTimeout( function() {
					var files = fs.readdirSync( logFolder );

					active = _.contains( files, logName );

					archives = _.filter( files, function( f ) {
						return f.slice( -3 ) === ".gz";
					} );

					archives = _.map( archives, function( name ) {
						return path.resolve( logFolder, name );
					} );

					archives = _.sortBy( archives, function( name ) {
						var stamp = name.slice( -27 ).slice( 0, -7 );
						var time = moment( stamp, "YYYY-MM-DD_HH-mm-SSS" );
						return time.valueOf(); // Have to sort it on the millisecond
					} );

					done();
				}, 1000 );

			} );

			it( "should produce an active log file", function() {
				active.should.be.ok;
			} );

			it( "should put the last line in the active log file", function() {
				fs.readFileSync( path.resolve( logFolder, logName ), "utf-8" ).should.equal( "Line #24\n" );
			} );

			it( "should produce 3 archives", function() {
				archives.length.should.equal( 3 );
			} );

			it( "should archive the messages in order", function( done ) {

				var chunked = _.chunk( lines, 4 );

				var tasks = when.all( _.map( archives, function( filepath ) {
					return unzip( filepath );
				} ) ).then( function( results ) {

					_.each( results, function( r, index ) {
						r.should.equal( chunked[ index + 3 ].join( "\n" ) + "\n" );
					} );

					done();
				} );

			} );

		} );
	} );

} );