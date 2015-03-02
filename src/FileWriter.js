var debug = require( "debug" )( "wp:filewriter" );
var when = require( "when" );
var path = require( "path" );
var machina = require( "machina" );
var errors = require( "./errors.js" );
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
				self.logStream.removeAllListeners( "error" );
				self.logStream.removeAllListeners( "open" );
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

			self.logStream.removeAllListeners( "error" );
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
					return when.reject( new errors.InvalidLogException() );
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
			.then( function() {
				debug( "Removing current file." );
				return this._removeCurrentLog();
			}.bind( this ) );
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

				this._verifyDirectory().then( onSuccess, onError );

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
					if ( err instanceof errors.InvalidLogException ) {
						return self.transition( "archiving" );
					}
					console.error( "Problem acquiring log file." );
					console.error( err.toString() );
					self.reboot();
				};

				this._openLog().then( openSuccess, openError );
			},
			write: function() {
				this.deferUntilTransition( "ready" );
			}
		},

		archiving: {
			_onEnter: function() {
				this.emit( "archive" );
				var self = this;
				self._closeHandle()
					.then( self._archive.bind( self ) )
					.then( function() { // result is the archived file name
						self.transition( "acquiring" );
					}, function( err ) {
							console.log( err );
							self.reboot();
						} );
			},
			write: function() {
				console.log( "ARCHIVING WRITE" );
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
			setTimeout( function() {
				this.transition( "booting" );
			}.bind( this ), this.rebootInterval );
		} else {
			console.error( "File logger has exceeded maximum retries (" + this.maxConsecutiveReboots + ")" );
			console.error( "File logger shutting down." );
		}

	}

} );

module.exports = FileWriter;