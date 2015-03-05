require( "../setup.js" );

var proxyquire = require( "proxyquire" ).noPreserveCache();
var fileLogger;

describe( "Whistlepunk Adapter", function() {

	before( function() {
		fileLogger = sinon.stub();
	} );

	describe( "when initializing", function() {

		describe( "when not giving any configuration", function() {
			var adapter;
			var config;
			var factory;
			before( function() {
				fileLogger.reset();
				factory = proxyquire( "../../src/index.js", {
					"./fileLogger.js": fileLogger
				} );
				adapter = factory( {} );
				adapter.init();
			} );

			after( function() {
				fileLogger.reset();
			} );

			it( "should called the logger", function() {
				fileLogger.should.have.been.calledWith( {
					strategy: "size", // could be "time"
					maxSize: 500, // in KB; how large the file is allowed to grow before a new log is created [size strategy]
					maxLogFiles: 0, // number of days a log is allowed to live before it is deleted (0 == no deleting)
					logFolder: "/var/log", // Path to folder where logs should be kept
					fileName: "whistlepunk.log" // Base name to be used for naming log files
				} );
			} );
		} );

		describe( "when giving partial configuration", function() {
			var adapter;
			var config;
			var factory;
			before( function() {
				fileLogger.reset();
				factory = proxyquire( "../../src/index.js", {
					"./fileLogger.js": fileLogger
				} );
				adapter = factory( {
					maxSize: 1000
				} );
				adapter.init();
			} );

			after( function() {
				fileLogger.reset();
			} );

			it( "should call the logger", function() {
				fileLogger.should.have.been.calledWith( {
					strategy: "size", // could be "time"
					maxSize: 1000, // in KB; how large the file is allowed to grow before a new log is created [size strategy]
					maxLogFiles: 0, // number of days a log is allowed to live before it is deleted (0 == no deleting)
					logFolder: "/var/log", // Path to folder where logs should be kept
					fileName: "whistlepunk.log" // Base name to be used for naming log files
				} );
			} );
		} );

	} );

	describe( "when logging", function() {
		var adapter;
		var config;
		var factory;
		var logger = {
			msgs: [],
			write: function( msg ) {
				this.msgs.push( msg );
			}
		};
		before( function() {
			fileLogger.reset();
			fileLogger.returns( logger );
			factory = proxyquire( "../../src/index.js", {
				"./fileLogger.js": fileLogger
			} );
			adapter = factory( {
				maxSize: 1000
			} );
			adapter.init();

			adapter.onLog( {
				type: "debug",
				timestamp: Date.now(),
				msg: "Here you go",
				namespace: "somenamespace"
			} );
		} );

		after( function() {
			fileLogger.reset();
		} );
		// 16:01:10-05:00

		it( "should write the message", function() {
			var msg = logger.msgs[ 0 ];
			var timestamp = /^[\d]{4}\-[\d]{2}-[\d]{2}T[\d]{2}:[\d]{2}:[\d]{2}[-|+][\d]{2}:[\d]{2}/;
			msg.should.match( timestamp );
			msg.should.match( /somenamespace \[debug\] Here you go$/ );
		} );
	} );

} );