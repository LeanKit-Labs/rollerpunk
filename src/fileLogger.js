var FileWriter = require( "./FileWriter.js" );
var strategies = {
	size: require( "./strategies/size.js" ),
	time: require( "./strategies/time.js" )
};

module.exports = function( config ) {
	var strategyName = config.strategy;

	var strategyFactory = strategies[ strategyName ];

	if ( !strategyFactory ) {
		throw new Error( "Invalid Whistlepunk File Logger Strategy: " + strategyName );
	}

	var strategy = strategyFactory( config );

	return new FileWriter( {
			strategy: strategy,
			config: config
		} );

};