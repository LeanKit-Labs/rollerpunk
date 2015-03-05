require( "../setup.js" );

var FileWriter;
var FileStream;
var fs;
var archiver;
var path = require( "path" );
var logFolder = __dirname + "../../log-tests";
var logName = "fileWriter.log";
var errors = require( "../../src/errors.js" );
function getFw( strategy, config ) {

	var defaultConfig = {
		initialState: "stopped",
		strategy: {
			verify: sinon.stub(),
			getArchivedFileName: sinon.stub(),
			getRemoveableFiles: sinon.stub()
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

	var fwConfig = _.merge( defaultConfig, toMerge );

	var fsm = new FileWriter( fwConfig );
	patchFsmTransition( fsm );

	return fsm;
}

describe( "FileWriter", function() {

	before( function() {
		FileStream = require( "../filestream.mock.js" );
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
		var removeCurrent;
		var archivedName = "test_123.log";
		before( function() {
			archive = sinon.stub( archiver, "archive" ).returns( when( true ) );
			writer = getFw();
			getArchive = writer.strategy.getArchivedFileName.returns( archivedName );
			removeCurrent = sinon.stub( writer, "_removeCurrentLog" ).returns( when( true ) );
			writer._archive();
		} );

		after( function() {
			archive.restore();
			removeCurrent.restore();
			getArchive.reset();
		} );

		it( "should forward the correct paths to the archiver", function() {
			var log = path.resolve( logFolder, logName );
			var a = path.resolve( logFolder, archivedName );
			archive.should.have.been.calledWith( log, a );
		} );

		it( "should remove the current log file", function() {
			removeCurrent.should.have.been.called;
		} );

	} );

	describe( "when removing the current log file", function() {
		var remove;
		var writer;

		before( function( done ) {
			remove = sinon.stub( fs, "remove" ).returns( when( true ) );
			writer = getFw();
			writer._removeCurrentLog()
				.then( function() {
					done();
				} );
		} );

		after( function() {
			remove.restore();
		} );

		it( "should try to remove the correct file", function() {
			remove.should.have.been.calledWith( path.resolve( logFolder, logName ) );
		} );
	} );

	describe( "when resetting the reboot count", function() {
		var writer;

		before( function() {
			writer = getFw();
			writer.rebootCount = 15;
			writer._resetRebootCount();
		} );

		it( "should set the count to 0", function() {
			writer.rebootCount.should.equal( 0 );
		} );
	} );

	describe( "when opening the file handle", function() {

		describe( "when there is an error opening file", function() {
			var stream;
			var writer;
			var createStream;
			var expectedError = new Error( "Can't open" );
			var reboot;
			var p;

			before( function() {
				stream = new FileStream();
				createStream = sinon.stub( fs, "createWriteStream" ).returns( stream );
				writer = getFw();
				reboot = sinon.stub( writer, "reboot" );
				p = writer._openHandle();

				stream.emit( "error", expectedError );
			} );

			after( function() {
				reboot.restore();
				createStream.restore();
				stream.end();
			} );

			it( "should reject with the file error", function() {
				p.should.eventually.be.rejectedWith( expectedError );
			} );

			it( "should attempt to reboot", function() {
				reboot.should.have.been.called;
			} );

		} );

		describe( "when there is an error with the file after it has been opened", function() {
			var stream;
			var writer;
			var createStream;
			var expectedError = new Error( "Can't open" );
			var reboot;
			var p;
			var log;

			before( function( done ) {
				log = sinon.stub( console, "error" );
				stream = new FileStream();
				createStream = sinon.stub( fs, "createWriteStream" ).returns( stream );
				writer = getFw();
				reboot = sinon.stub( writer, "reboot" );
				p = writer._openHandle();

				stream.emit( "open" );

				_.delay( function() {
					stream.emit( "error", expectedError );
					done();
				}, 100 );

			} );

			after( function() {
				log.restore();
				reboot.restore();
				createStream.restore();
				stream.end();
			} );

			it( "should reject with the file error", function() {
				p.should.eventually.be.resolved;
			} );

			it( "should attempt to reboot", function() {
				reboot.should.have.been.called;
			} );

			it( "should log the error", function() {
				log.should.have.been.calledWith( "File Stream Error" );
				log.should.have.been.calledWith( expectedError.toString() );
			} );
		} );

		describe( "when the file opens successfully", function() {
			var stream;
			var writer;
			var createStream;
			var p;

			before( function() {
				stream = new FileStream();
				createStream = sinon.stub( fs, "createWriteStream" ).returns( stream );
				writer = getFw();

				p = writer._openHandle();

				stream.emit( "open" );
			} );

			after( function() {
				createStream.restore();
				stream.end();
			} );

			it( "should resolve successfully", function() {
				p.should.eventually.be.resolved;
			} );

		} );

	} );

	describe( "when closing the file handle", function() {
		var stream;
		var writer;
		var p;

		before( function() {
			stream = new FileStream();
			writer = getFw();
			writer.logStream = stream;
			writer.logFileSize = 72;
			p = writer._closeHandle();
		} );

		after( function() {
			stream.end();
		} );

		it( "should resolve successfully", function() {
			p.should.eventually.be.resolved;
		} );

		it( "should reset the internal log file size", function( done ) {
			p.then( function() {
				writer.logFileSize.should.equal( 0 );
				done();
			} );
		} );

		it( "should reset the internal log stream", function( done ) {
			p.then( function() {
				should.not.exist( writer.logFileStream );
				done();
			} );
		} );
	} );

	describe( "when cleaning up log folder", function() {

		describe( "when cleanup fails", function() {
			var writer;
			var read;
			var expectedError = new Error( "READ FAILED" );
			var log;
			before( function( done ) {
				writer = getFw( {}, { maxLogFiles: 5 } );
				log = sinon.stub( console, "error" );
				read = sinon.stub( fs, "readdir" ).returns( when.reject( expectedError ) );
				writer._cleanupLogFolder()
					.done( function() {
						done();
					} );
			} );

			after( function() {
				log.restore();
				read.restore();
			} );

			it( "should log the error", function() {
				log.should.have.been.calledWith( "Log folder could not be cleaned up" );
				log.should.have.been.calledWith( expectedError.toString() );
			} );
		} );

		describe( "when max log files configuration is set to 0", function() {
			var writer;
			var read;
			before( function() {
				writer = getFw( {}, { maxLogFiles: 0 } );
				read = sinon.stub( fs, "readdir" );
				writer._cleanupLogFolder();
			} );

			after( function() {
				read.restore();
			} );

			it( "should not attempt to read the directory", function() {
				read.should.not.have.been.called;
			} );
		} );
		describe( "when max log file is set", function() {
			var writer;
			var read;
			var dirList = [
				"testing.log",
				"testing_2015-03-04_22-15-642.log.gz",
				"testing_2015-03-05_22-15-642.log.gz",
				"testing_2015-03-06_22-15-642.log.gz"
			];
			var remove;
			before( function() {
				writer = getFw( {}, { maxLogFiles: 3 } );
				writer.strategy.getRemoveableFiles.returns( when( dirList[ 3 ] ) );
				remove = sinon.stub( writer, "_removeFiles" ).returns( when( true ) );
				read = sinon.stub( fs, "readdir" ).returns( when( dirList ) );
				writer._cleanupLogFolder();
			} );

			after( function() {
				read.restore();
			} );

			it( "should give only the archived files to the strategy", function() {
				var args = _.map( dirList.slice( 1 ), function( f ) {
					return path.resolve( writer.logFolder, f );
				} );

				writer.strategy.getRemoveableFiles.should.have.been.calledWith( args );
			} );

			it( "should forward the correct files to remove", function() {
				remove.should.have.been.calledWith( dirList[ 3 ] );
			} );

		} );
	} );

	describe( "when writing", function() {
		var writer;
		var handle;
		var msg = "SOME LOG MESSAGE";

		before( function() {
			writer = getFw();
			handle = sinon.stub( writer, "handle" );
			writer.write( msg );
		} );

		after( function() {
			handle.restore();
		} );

		it( "should pass the message to the write handler", function() {
			handle.should.have.been.calledWith( "write", msg );
		} );
	} );

	describe( "when rebooting", function() {

		describe( "when reboots are remaining", function() {
			var writer;
			var delay;
			var transition;

			before( function() {
				writer = getFw();
				delay = sinon.stub( _, "delay" );
				writer.reboots = 1;
				writer.rebootInterval = 100;
				writer.maxConsecutiveReboots = 5;

				writer.reboot();
			} );

			after( function() {
				delay.restore();
				writer.transition.reset();
			} );

			it( "should increment the reboot counter", function() {
				writer.reboots.should.equal( 2 );
			} );

			it( "should transition to stopped", function() {
				writer.transition.should.be.calledWith( "stopped" );
			} );

			it( "should delay booting for the duration of the reboot interval", function() {
				delay.getCall( 0 ).args[ 1 ].should.equal( 100 );
			} );

			it( "should attempt to transition to booting", function() {
				var cb = delay.getCall( 0 ).args[ 0 ];
				cb();
				writer.transition.should.be.calledWith( "booting" );
			} );
		} );

		describe( "when there are no reboots remaining", function() {
			var writer;
			var delay;
			var transition;
			var error;

			before( function() {
				error = sinon.stub( console, "error" );
				writer = getFw();
				delay = sinon.stub( _, "delay" );

				writer.reboots = 10;
				writer.rebootInterval = 100;
				writer.maxConsecutiveReboots = 5;

				writer.reboot();
			} );

			after( function() {
				error.restore();
				delay.restore();
				writer.transition.reset();
			} );

			it( "should increment the reboot counter", function() {
				writer.reboots.should.equal( 11 );
			} );

			it( "should transition to stopped", function() {
				writer.transition.should.be.calledWith( "stopped" );
			} );

			it( "should not delay booting", function() {
				delay.should.not.have.been.called;
			} );

			it( "should log the errors", function() {
				error.should.have.been.calledWith( "File logger has exceeded maximum retries (5)" );
				error.should.have.been.calledWith( "File logger shutting down." );
			} );

		} );
	} );

	describe( "FileWriter States", function() {

		describe( "when not in ready state", function() {
			var writer;
			var writes;
			var defer;

			before( function() {
				writer = getFw();
				defer = sinon.stub( writer, "deferUntilTransition" );
				writes = _.reduce( writer.states, function( memo, state, key ) {
					if ( key === "ready" ) {
						return memo;
					}
					memo.push( state.write.bind( writer ) );

					return memo;
				}, [] );

				_.each( writes, function( fn ) {
					fn();
				} );

			} );

			after( function() {
				defer.restore();
			} );

			it( "should have 5 states", function() {
				writes.length.should.equal( 5 );
			} );
			it( "should defer all writes until ready", function() {
				defer.should.have.callCount( 5 );
				defer.should.always.have.been.calledWith( "ready" );
			} );
		} );

		describe( "when in booting state", function() {
			var writer;
			var verify;

			before( function() {
				writer = getFw();

				verify = sinon.stub( writer, "_verifyDirectory" );
			} );
			describe( "when directory verification fails", function() {
				var error;
				var log;
				var reboot;
				before( function( done ) {
					log = sinon.stub( console, "error" );
					error = new Error( "REJECTED!" );
					verify.returns( when.reject( error ) );
					reboot = sinon.stub( writer, "reboot" );

					writer.states.booting._onEnter.call( writer )
						.done( function() {
							done();
						} );

				} );

				after( function() {
					log.restore();
					verify.reset();
					reboot.restore();
					writer.transition.reset();
				} );

				it( "should try to reboot", function() {
					reboot.should.have.been.called;
				} );

				it( "should log the errors", function() {
					log.should.have.been.calledWith( "Problem loading file logger" );
					log.should.have.been.calledWith( error.toString() );
				} );
			} );
			describe( "when directory verification succeeds", function() {
				var cleanup;
				before( function( done ) {
					cleanup = sinon.stub( writer, "_cleanupLogFolder" ).returns( when( true ) );
					writer.transition.reset();
					verify.returns( when( true ) );
					writer.states.booting._onEnter.call( writer )
						.done( function() {
							done();
						} );

				} );

				after( function() {
					cleanup.restore();
					verify.reset();
					writer.transition.reset();
				} );

				it( "should transition to acquiring", function() {
					writer.transition.should.have.been.calledWith( "acquiring" );
				} );

				it( "should try to cleanup the log folder", function() {
					cleanup.should.have.been.called;
				} );
			} );
		} );

		describe( "when in acquiring state", function() {

			describe( "when opening log fails with unknown error", function() {
				var writer;
				var openLog;
				var error;
				var log;
				var reboot;
				before( function( done ) {
					writer = getFw();

					openLog = sinon.stub( writer, "_openLog" );
					log = sinon.stub( console, "error" );
					error = new Error( "REJECTED!" );
					openLog.returns( when.reject( error ) );
					reboot = sinon.stub( writer, "reboot" );

					writer.states.acquiring._onEnter.call( writer )
						.done( function() {
							done();
						} );

				} );

				after( function() {
					log.restore();
					openLog.reset();
					reboot.restore();
					writer.transition.reset();
				} );

				it( "should try to reboot", function() {
					reboot.should.have.been.called;
				} );

				it( "should log the errors", function() {
					log.should.have.been.calledWith( "Problem acquiring log file." );
					log.should.have.been.calledWith( error.toString() );
				} );
			} );
			describe( "when opening log succeeds", function() {
				var writer;
				var openLog;
				before( function( done ) {
					writer = getFw();

					openLog = sinon.stub( writer, "_openLog" );
					openLog.returns( when( true ) );
					writer.states.acquiring._onEnter.call( writer )
						.done( function() {
							done();
						} );

				} );

				after( function() {
					openLog.reset();
					writer.transition.reset();
				} );

				it( "should transition to acquiring", function() {
					writer.transition.should.have.been.calledWith( "ready" );
				} );
			} );

			describe( "when opening log fails with invalid log exception", function() {
				var myWriter;
				var openLog;
				var exception;

				before( function( done ) {
					myWriter = getFw();
					exception = new errors.InvalidLogException( "NOPE" );
					openLog = sinon.stub( myWriter, "_openLog" );
					openLog.returns( when.reject( exception ) );
					myWriter.states.acquiring._onEnter.call( myWriter )
						.done( function() {
							done();
						} );

				} );

				after( function() {
					openLog.restore();
					myWriter.transition.reset();
				} );

				it( "should transition to archiving", function() {
					myWriter.transition.should.have.been.calledWith( "archiving" );
				} );
			} );
		} );

		describe( "when in archiving state", function() {
			var writer;

			before( function() {
				writer = getFw();

			} );

			describe( "when pre-archiving has not happened", function() {
				var prior;
				before( function() {
					writer.transition.reset();
					prior = writer.priorState;
					writer.priorState = "ready";
					writer._transition( "archiving" );
				} );

				after( function() {
					writer.priorState = prior;
					writer.transition.reset();
				} );

				it( "should transition to pre-archiving", function() {
					writer.transition.should.have.been.calledWith( "pre-archiving" );
				} );

			} );

			describe( "when archiving fails", function() {
				var archive;
				var error = new Error( "Can't archive" );
				var log;
				var reboot;
				before( function( done ) {
					writer.transition.reset();
					archive = sinon.stub( writer, "_archive" ).returns( when.reject( error ) );
					reboot = sinon.stub( writer, "reboot" );
					log = sinon.stub( console, "error" );
					writer.priorState = "pre-archiving";
					writer.states.archiving._onEnter.call( writer )
						.done( function() {
							done();
						} );
				} );

				after( function() {
					archive.restore();
					reboot.restore();
					log.restore();
					writer.transition.reset();
				} );

				it( "should reboot", function() {
					reboot.should.have.been.called;
				} );

				it( "should log the error", function() {
					log.should.have.been.calledWith( error.toString() );
				} );
			} );

			describe( "when archiving succeeds", function() {
				var archive;
				var cleanup;
				before( function( done ) {
					writer.transition.reset();
					archive = sinon.stub( writer, "_archive" ).returns( when( true ) );
					cleanup = sinon.stub( writer, "_cleanupLogFolder" ).returns( when( true ) );
					writer.priorState = "pre-archiving";
					writer.states.archiving._onEnter.call( writer )
						.done( function() {
							done();
						} );
				} );

				after( function() {
					cleanup.restore();
					archive.restore();
					writer.transition.reset();
				} );

				it( "should transition to acquiring", function() {
					writer.transition.should.have.been.calledWith( "acquiring" );
				} );

				it( "should call cleanup", function() {
					cleanup.should.have.been.called;
				} );
			} );

		} );

		describe( "when in pre-archiving state", function() {

			describe( "when the log stream does not exist", function() {
				var writer;
				before( function() {
					writer = getFw();

					writer._transition( "pre-archiving" );
				} );

				after( function() {
					writer.transition.reset();
				} );

				it( "should transition to archiving", function() {
					writer.transition.should.have.been.calledWith( "archiving" );
				} );
			} );

			describe( "when the log stream does exist", function() {
				var writer;
				var stream;
				var end;
				before( function() {
					writer = getFw();

					stream = new FileStream();
					end = sinon.spy( stream, "end" );
					writer.logStream = stream;
					writer.transition.reset();

					writer._transition( "pre-archiving" );

				} );

				after( function() {
					end.restore();
					writer.transition.reset();
				} );

				it( "should wait for the stream to end", function() {
					end.should.have.been.calledWith( "" );
				} );

				it( "should transition to archiving", function() {
					writer.transition.should.have.been.calledWith( "archiving" );
				} );
			} );
		} );

		describe( "when in stopped state", function() {
			describe( "when entering", function() {
				var writer;
				var close;
				before( function() {
					writer = getFw();
					close = sinon.stub( writer, "_closeHandle" );
					writer.states.stopped._onEnter.call( writer );
				} );

				it( "should close the file handle", function() {
					close.should.have.been.called;
				} );

			} );

			describe( "when writing", function() {
				describe( "when there are too many writes queued up", function() {
					var writer;
					var queue;
					var process = function( m ) {
						return {
							type: "transition",
							untilState: "ready",
							args: [ {}, m ]
						};
					};
					before( function() {
						writer = getFw();

						queue = [ "m1", "m2", "m3", "m4", "m5" ];

						writer._transition( "stopped" );
						writer.maxUnwritten = 5;
						writer.inputQueue = queue.map( process );

						writer.write( "m6" );
					} );

					it( "should get rid of the oldest message in the queue", function() {
						var messages = _.map( writer.inputQueue, function( q ) {
							return q.args[ 1 ];
						} );

						messages.should.eql( [ "m2", "m3", "m4", "m5", "m6" ] );
					} );

				} );
			} );

		} );

		describe( "when in ready state", function() {

			describe( "when entering ready", function() {
				var writer;
				var ready = false;
				before( function( done ) {
					writer = getFw();
					writer.on( "ready", function() {
						ready = true;
					} );
					writer.rebootCount = 15;
					writer._transition( "ready" );

					_.defer( function() {
						done();
					} );
				} );

				it( "should reset the reboot count", function() {
					writer.rebootCount.should.equal( 0 );
				} );

				it( "should emit a ready event", function() {
					ready.should.be.ok;
				} );

			} );

			describe( "when writing", function() {

				describe( "when message fits into current log file", function() {
					var writer;
					var msg;
					var stream;
					var verify;
					before( function( done ) {
						stream = new FileStream();
						msg = "HERE I AM";
						writer = getFw( {}, {
							maxSize: 25
						} );

						verify = sinon.stub( writer, "_verifyLogFile" ).returns( true );

						writer.logStream = stream;
						writer.logFileSize = 10;

						writer._transition( "ready" );
						writer.write( msg );

						stream.end( "", function() {
							done();
						} );
					} );

					it( "should write the message to the log stream", function() {
						stream.data.should.equal( msg + "\n" );
					} );

					it( "should increase the log file size", function() {
						writer.logFileSize.should.equal( 20 );
					} );

					it( "should not try to archive", function() {
						writer.transition.should.not.have.been.calledWith( "archiving" );
					} );

					it( "should try to verify file with the current file size", function() {
						verify.should.have.been.calledWith( {}, { size: 20 } );
					} );

				} );

				describe( "when message fills up log file", function() {
					var writer;
					var msg;
					var stream;
					var verify;
					before( function( done ) {
						stream = new FileStream();
						msg = "HERE I AM";
						writer = getFw( {}, {
							maxSize: 15
						} );

						verify = sinon.stub( writer, "_verifyLogFile" ).returns( false );

						writer.logStream = stream;
						writer.logFileSize = 10;

						writer._transition( "ready" );
						writer.write( msg );

						stream.end( "", function() {
							done();
						} );
					} );

					it( "should write the message to the log stream", function() {
						stream.data.should.equal( msg + "\n" );
					} );

					it( "should increase the log file size", function() {
						writer.logFileSize.should.equal( 20 );
					} );

					it( "should try to archive", function() {
						writer.transition.should.have.been.calledWith( "archiving" );
					} );

					it( "should try to verify file with the current file size", function() {
						verify.should.have.been.calledWith( {}, { size: 20 } );
					} );
				} );

			} );

		} );

	} );

} );