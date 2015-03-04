var _ = require( "lodash" );
var debug = require( "debug" )( "wp:filewriter" );
var when = require( "when" );
var path = require( "path" );
var machina = require( "machina" );
var InvalidLogException = require( "./errors.js" ).InvalidLogException;
var fs = require( "./filesystem.js" );
var archiver = require( "./archiver.js" );
var os = require( "os" );
var EOL = os.EOL;


var FileWriter = machina.Fsm.extend( {

	initialize: function( options ) {
		this.config = options.config;
		this.strategy = options.strategy;

		this.logFolder = this.config.logFolder;
		this.logFilePath = path.resolve( this.logFolder, this.config.fileName );

		this.rebootInterval = 60000;
		this.rebootCount = 0;
		this.maxConsecutiveReboots = 20;

		this.logStream = null;
		this.logFileSize = 0;

		debug( "Initializing FileWriter" );
		debug( "Log Folder: %s", this.logFolder );
		debug( "Log File Path: %s", this.logFilePath );

	},

	_openHandle: function( _fileStats ) {
		var self = this;
		return when.promise( function( resolve, reject ) {
			var fileStats = _fileStats || {}; // _fileStats will be null if the file did not previously exist
			self.logFileSize = fileStats.size || 0;

			debug( "Opening log file. Current size: %s", self.logFileSize );

			self.logStream = fs.createWriteStream( self.logFilePath, {
				flags: "a"
			} );

			self.logStream.on( "error", function( err ) {
				self.logStream.removeAllListeners();
				reject( err );
			} );

			self.logStream.once( "open", function() {
				self.logStream.removeAllListeners( "error" );
				resolve();
			} );

		} );
	},

	_closeHandle: function() {
		var self = this;
		return when.promise( function( resolve, reject ) {
			if ( !self.logStream ) {
				return resolve();
			}

			debug( "Closing current file." );

			self.logStream.once( "close", function() {
				self.logFileSize = 0;
				self.logStream = null;
				debug( "File closed" );
				return resolve();
			} );

			self.logStream.close();
		} );

	},

	_verifyDirectory: function() {
		return fs.ensureDir( this.logFolder );
	},

	_verifyLogFile: function( stats, otherData ) {
		return this.strategy.verify( stats, otherData );
	},

	_getCurrentLogStats: function() {
		var self = this;
		return when.promise( function( resolve, reject ) {

			var statSuccess = function( stats ) {
				debug( "File stats retrieved successfully." );
				return resolve( stats );
			};

			var statError = function( err ) {
				if ( err.code === "ENOENT" ) {
					// File didn't exist, so we can safely create a new one
					debug( "Log file does not yet exist." );
					return resolve( null );
				}
				debug( "Error retrieving file stats." );
				return reject( err );
			};

			return fs.stat( self.logFilePath ).then( statSuccess, statError );

		} );
	},

	_openLog: function() {
		var self = this;
		var success = function( stats ) {
			if ( stats ) {
				// File exists, so we need to check if it's valid
				if ( self._verifyLogFile( stats ) ) {
					return self._openHandle( stats );
				} else {
					debug( "Log file is not in a valid state." );
					return when.reject( new InvalidLogException() );
				}

			} else {
				// File didn't exist, so we need to create new one
				return self._openHandle();
			}
		};

		return this._getCurrentLogStats().then( success );
	},

	_archive: function() {
		var targetName = this.strategy.getArchivedFileName();
		var targetPath = path.resolve( this.logFolder, targetName );
		debug( "Archiving current file to %s", targetPath );
		return archiver.archive( this.logFilePath, targetPath )
			.then( this._removeCurrentLog.bind( this ) );
	},

	_removeCurrentLog: function() {
		return fs.remove( this.logFilePath );
	},

	_resetRebootCount: function() {
		this.rebootCount = 0;
	},

	initialState: "booting",

	states: {
		booting: {
			_onEnter: function() {
				this.emit( "boot" );
				var self = this;
				var onSuccess = function() {
					self.transition( "acquiring" );
				};
				var onError = function( err ) {
					// You got problems cuz your log directory ain't good
					console.error( "Problem loading file logger" ); // Who will log the logger?
					console.error( err.toString() );
					self.reboot();
				};

				return this._verifyDirectory().then( onSuccess, onError );

			},
			write: function() {
				this.deferUntilTransition( "ready" );
			}
		},
		acquiring: {
			_onEnter: function() {
				this.emit( "acquire" );
				var self = this;

				var openSuccess = function() {
					self.transition( "ready" );
				};

				var openError = function( err ) {
					if ( err instanceof InvalidLogException ) {
						self.transition( "archiving" );
						return;
					}
					console.error( "Problem acquiring log file." );
					console.error( err.toString() );
					self.reboot();
				};

				return this._openLog().then( openSuccess, openError );
			},
			write: function() {
				this.deferUntilTransition( "ready" );
			}
		},

		archiving: {
			_onEnter: function() {

				if ( this.priorState !== "pre-archiving" ) {
					return this.transition( "pre-archiving" );
				}

				this.emit( "archive" );
				var self = this;

				var onSuccess = function() {
					self.transition( "acquiring" );
				};

				var onFail = function( err ) {
					console.error( err.toString() );
					self.reboot();
				};

				return self._closeHandle()
					.then( self._archive.bind( self ) )
					.then( onSuccess, onFail );
			},
			write: function() {
				this.deferUntilTransition( "ready" );
			}
		},

		"pre-archiving": {
			_onEnter: function() {
				debug( "Ensuring buffers are flushed" );
				if ( !this.logStream ) {
					debug( "Nothing in buffer" );
					return this.transition( "archiving" );
				}

				debug( "Ending stream" );

				this.logStream.end( "", function() {
					debug( "Stream has finished writing" );
					this.transition( "archiving" );
				}.bind( this ) );
			},

			write: function() {
				this.deferUntilTransition( "ready" );
			}
		},

		ready: {
			_onEnter: function() {
				this._resetRebootCount();
				this.emit( "ready" );
			},
			write: function( msg ) {
				debug( "Writing to log: %s", msg );
				var line = msg + EOL;
				var written = this.logStream.write( line );
				debug( "Write Status: %s", written );

				var size = unescape( encodeURIComponent( line ) ).length;
				this.logFileSize += size;

				// Perform check to see if we need to archive
				// Should we do this on every write?
				debug( "Validating file with size %s", this.logFileSize );
				var stillValid = this._verifyLogFile( {}, { size: this.logFileSize } );

				if ( !stillValid ) {
					debug( "Log file needs to be archived" );
					this.transition( "archiving" );
				}

			}

		},

		stopped: {
			_onEnter: function() {
				this.emit( "stop" );
				this._closeHandle();
			},
			write: function() {
				this.deferUntilTransition( "ready" );
			}
		}
	},

	write: function( msg ) {
		this.handle( "write", msg );
	},

	stop: function() {
		this.transition( "stopped" );
	},

	reboot: function() {
		this.reboots++;
		this.stop();

		if ( this.reboots <= this.maxConsecutiveReboots ) {
			_.delay( function() {
				this.transition( "booting" );
			}.bind( this ), this.rebootInterval );
		} else {
			console.error( "File logger has exceeded maximum retries (" + this.maxConsecutiveReboots + ")" );
			console.error( "File logger shutting down." );
		}

	}

} );

module.exports = FileWriter;