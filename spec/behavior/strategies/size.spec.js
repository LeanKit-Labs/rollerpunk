require( "../../setup.js" );

var strategyFactory;

describe( "Log Size Management Strategy", function() {

	before( function() {
		strategyFactory = require( "../../../src/strategies/size.js" );
	} );

	describe( "when verifying", function() {
		var strategy;
		before( function() {
			var config = {
				maxSize: 10, // KB
				logFolder: "../../logs-test",
				fileName: "size-test.log"
			};
			strategy = strategyFactory( config );
		} );


		describe( "when using only fileStats", function() {

			it( "should resolve if size is under limit", function() {
				strategy.verify( { size: 15 } ).should.be.ok;
			} );

			it( "should reject if size is over limit", function() {
				strategy.verify( { size: 10242 } ).should.not.be.ok;
			} );

		} );

		describe( "when using currentStats", function() {
			it( "should resolve if size is under limit", function() {
				strategy.verify( { size: 10245 }, { size: 1 } ).should.be.ok;
			} );

			it( "should reject if size is over limit", function() {
				strategy.verify( { size: 1 }, { size: 10242 } ).should.not.be.ok;
			} );
		} );

	} );

	describe( "when getting the archived file name", function() {
		var strategy;
		var result;
		before( function() {
			var config = {
				maxSize: 10, // KB
				logFolder: "../../logs-test",
				fileName: "size-test.log"
			};
			strategy = strategyFactory( config );
			result = strategy.getArchivedFileName();
		} );

		it( "should have a timestamp appended", function() {
			// size-test_2015-03-02_11:03:29.log
			var regex = /^size\-test_[\d]{4}\-[\d]{2}-[\d]{2}_[\d]{2}:[\d]{2}:[\d]{3}\.log$/;
			result.should.match( regex );
		} );

	} );

} );