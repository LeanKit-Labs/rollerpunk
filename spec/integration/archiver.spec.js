require( "../setup.js" );
var path = require( "path" );
var zlib = require( "zlib" );
var fs = require( "../../src/filesystem.js" );
var testDir = path.resolve( __dirname, "../../tmp/archiver" );
var origFile = path.resolve( __dirname, "../../package.json" );
var testFile = path.resolve( testDir, "package.json" );

var archiver;

describe( "Archiver", function() {

	before( function() {
		archiver = require( "../../src/archiver.js" );
		fs.ensureDirSync( testDir );
	} );

	describe( "when compressing a file", function() {
		var archivedFile;
		var zippedFile;

		before( function( done ) {
			archivedFile = path.resolve( testDir, "package_today.json" );
			zippedFile = archivedFile + ".gz";
			fs.copySync( origFile, testFile );
			archiver.archive( testFile, archivedFile )
				.then( function() {
					done();
				} );
		} );

		after( function() {
			fs.remove( zippedFile );
			fs.remove( testFile );
		} );

		it( "should create the archived file", function() {
			fs.existsSync( zippedFile ).should.be.ok;
		} );

		it( "should archive file with the contents correctly", function( done ) {
			var expectedContents = fs.readFileSync( origFile );
			var zippedContents = fs.readFileSync( zippedFile );
			zlib.gunzip( zippedContents, function( err, unzipped ) {
				unzipped.toString().should.equal( expectedContents.toString() );
				done();
			} );

		} );


	} );

} );