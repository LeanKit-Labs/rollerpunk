var util = require( "util" );

function InvalidLogException( msg ) {
	Error.call( this );
	this.name = "InvalidLogException";
	this.message = msg;
}

util.inherits( InvalidLogException, Error );

module.exports = {
	InvalidLogException: InvalidLogException
};