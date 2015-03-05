var _ = require( "lodash" );
var lift = require( "when/node" ).lift;
var fsExtra = require( "fs-extra" );

var methods = [ "ensureDir", "stat", "remove", "readdir" ];


var fs = _.reduce( fsExtra, function( memo, val, key ) {

	if ( _.contains( methods, key ) ) {
		memo[ key ] = lift( val );
	} else {
		memo[ key ] = val;
	}

	return memo;

}, fsExtra );


module.exports = fs;