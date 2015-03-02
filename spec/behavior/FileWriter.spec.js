require( "../setup.js" );

var FileWriter;
var fs;
var archiver;
var path = require( "path" );
var logFolder = __dirname + "../../log-tests";
var logName = "fileWriter.log";
function getFw( strategy, config ) {

	var defaultConfig = {
		initialState: "stopped",
		strategy: {
			verify: sinon.stub(),
			getArchivedFileName: sinon.stub()
		},
		config: {
			maxSize: 5,
			logFolder: logFolder,
			fileName: logName
		}
	};

	var toMerge = {};

	if ( strategy ) {
		toMerge.strategy = strategy;
	}

	if ( config ) {
		toMerge.config = config;
	}

	var fwConfig = _.merge( defaultConfig, fwConfig );

	return new FileWriter( fwConfig );
}

describe( "FileWriter", function() {

	before( function() {
		FileWriter = require( "../../src/FileWriter.js" );
		fs = require( "../../src/filesystem.js" );
		archiver = require( "../../src/archiver.js" );
	} );

	describe( "when initializing", function() {

		var writer;

		before( function() {
			writer = getFw();
		} );

		it( "should attach the strategy", function() {
			writer.strategy.should.exist;
		} );

	} );

	describe( "when getting current log file info", function() {
		var writer;
		var stat;
		var stats = { size: 500 };

		before( function() {
			writer = getFw();
		} );

		describe( "when the current log file exists", function() {
			var p;
			var result;
			before( function( done ) {
				stat = sinon.stub( fs, "stat" ).returns( when( stats ) );
				writer._getCurrentLogStats()
					.then( function( res ) {
						result = res;
						done();
					} );
			} );

			after( function() {
				stat.restore();
			} );

			it( "should resolve with the file stats", function() {
				result.should.eql( stats );
			} );

			it( "should try to load the current file", function() {
				stat.should.be.calledOnce;
				stat.should.be.calledWith( path.resolve( logFolder, logName ) );
			} );



		} );

		describe( "when the current file does not exist", function() {
			var error = new Error( "File not found" );
			error.code = "ENOENT";
			var result;
			before( function( done ) {
				stat = sinon.stub( fs, "stat" ).returns( when.reject( error ) );
				writer._getCurrentLogStats()
					.then( function( res ) {
						result = res;
						done();
					} );
			} );

			after( function() {
				stat.restore();
			} );

			it( "should resolve with null", function() {
				should.not.exist( result );
			} );
		} );

		describe( "when there is some other error checking the file", function() {
			var error = new Error( "hahalol" );
			var receivedError;
			before( function( done ) {
				stat = sinon.stub( fs, "stat" ).returns( when.reject( error ) );
				writer._getCurrentLogStats()
					.then( null, function( err ) {
						receivedError = err;
						done();
					} );
			} );

			after( function() {
				stat.restore();
			} );

			it( "should reject with the error", function() {
				receivedError.should.eql( error );
			} );
		} );

	} );

	describe( "when opening the log", function() {
		var writer;
		var getStats;
		before( function() {
			writer = getFw();
		} );

		describe( "when there is an error getting the file stats", function() {
			var error = new Error( "No stats for you" );
			before( function() {
				getStats = sinon.stub( writer, "_getCurrentLogStats" ).returns( when.reject( error ) );
			} );

			after( function() {
				getStats.restore();
			} );

			it( "should reject with the error", function() {
				writer._openLog().should.eventually.be.rejectedWith( error );
			} );

		} );

		describe( "when the log file doesn't exist yet", function() {
			var verify;
			var open;
			var results = "hey, you did it";
			var received;
			before( function( done ) {
				getStats = sinon.stub( writer, "_getCurrentLogStats" ).returns( when( null ) );
				verify = sinon.stub( writer, "_verifyLogFile" );
				open = sinon.stub( writer, "_openHandle" ).returns( when( results ) );

				writer._openLog()
					.then( function( res ) {
						received = res;
						done();
					} );
			} );

			after( function() {
				getStats.restore();
				verify.restore();
				open.restore();
			} );

			it( "should return the results of opening the filestream", function() {
				received.should.eql( results );
			} );

			it( "should not try to verify the file", function() {
				verify.should.not.be.called;
			} );

		} );

		describe( "when the log file already exists", function() {

			describe( "when the log file passes verification", function() {
				var verify;
				var open;
				var stats = { size: 700 };
				var results = "END RESULT GOES HERE";
				var received;
				before( function( done ) {
					getStats = sinon.stub( writer, "_getCurrentLogStats" ).returns( when( stats ) );
					verify = sinon.stub( writer, "_verifyLogFile" ).returns( true );
					open = sinon.stub( writer, "_openHandle" ).returns( when( results ) );

					writer._openLog()
						.then( function( res ) {
							received = res;
							done();
						} );
				} );

				after( function() {
					getStats.restore();
					verify.restore();
					open.restore();
				} );

				it( "should return the results of opening the filestream", function() {
					received.should.eql( results );
				} );

				it( "should verify the file", function() {
					verify.should.be.calledWith( stats );
				} );
			} );

			describe( "when the log file does not pass verification", function() {
				var verify;
				var open;
				var stats = { size: 700 };
				var verificationError = new errors.InvalidLogException();
				var results = "END RESULT GOES HERE";
				var received;
				before( function( done ) {
					getStats = sinon.stub( writer, "_getCurrentLogStats" ).returns( when( stats ) );
					verify = sinon.stub( writer, "_verifyLogFile" ).returns( false );
					open = sinon.stub( writer, "_openHandle" ).returns( when( results ) );

					writer._openLog()
						.then( null, function( err ) {
							received = err;
							done();
						} );
				} );

				after( function() {
					getStats.restore();
					verify.restore();
					open.restore();
				} );

				it( "should return the verification error", function() {
					received.should.eql( verificationError );
				} );

				it( "should not try to open the filestream", function() {
					open.should.not.be.called;
				} );
			} );


		} );

	} );

	describe( "when verifying the log directory", function() {
		var ensureDir;

		before( function() {
			ensureDir = sinon.stub( fs, "ensureDir" );
			var writer = getFw();
			writer._verifyDirectory();
		} );

		after( function() {
			ensureDir.restore();
		} );

		it( "should ensure the directory exists", function() {
			ensureDir.should.have.been.calledWith( logFolder );
		} );

	} );

	describe( "when verifying the log file", function() {

		var writer;
		var stats;
		var otherData;

		before( function() {
			writer = getFw();
			stats = { size: 10 };
			otherData = { size: 20 };
			writer._verifyLogFile( stats, otherData );
		} );

		after( function() {
			writer.strategy.verify.reset();
		} );

		it( "should forward its arguments to the strategy", function() {
			writer.strategy.verify.should.have.been.calledWith( stats, otherData );
		} );

	} );

	describe( "when archiving the current log", function() {
		var archive;
		var writer;
		var getArchive;
		var archivedName = "test_123.log";
		before( function() {
			archive = sinon.stub( archiver, "archive" );
			writer = getFw();
			getArchive = writer.strategy.getArchivedFileName.returns( archivedName );
			writer._archive();
		} );

		after( function() {
			archive.restore();
			getArchive.reset();
		} );

		it( "should forward the correct paths to the archiver", function() {
			var log = path.resolve( logFolder, logName );
			var a = path.resolve( logFolder, archivedName );
			archive.should.have.been.calledWith( log, a );
		} );

	} );

} );