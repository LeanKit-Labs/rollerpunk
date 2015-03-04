var path = require( "path" );
var stack = require( "callsite" );

function requireNew( modulePath ) {
	var callerFile = stack()[ 1 ].getFileName();
	var realPath = path.resolve( path.dirname( callerFile ), modulePath );

	delete require.cache[ require.resolve( realPath ) ];
	return require( realPath );
}

function patchFsmTransition( fsm ) {
	fsm._transition = fsm.transition.bind( fsm );
	fsm.transition = sinon.stub();
}

global.__loaded__ = global.__loaded__ || false;

if ( !global.__loaded__ ) {

	var chai = require( "chai" );
	global._ = require( "lodash" );
	global.sinon = require( "sinon" );

	chai.use( require( "chai-as-promised" ) );
	chai.use( require( "sinon-chai" ) );
	global.should = chai.should();

	global.when = require( "when" );
	global.requireNew = requireNew;
	global.patchFsmTransition = patchFsmTransition;

	require( "sinon-as-promised" )( when );

	global.__loaded__ = true;
}