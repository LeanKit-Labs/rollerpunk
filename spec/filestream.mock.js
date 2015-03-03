var Writable = require( "stream" ).Writable;
var util = require( "util" );

function FileStream() {
	Writable.apply( this, arguments );
	this.data = "";
}

util.inherits( FileStream, Writable );

FileStream.prototype._write = function( data, encoding, callback ) {
	this.data += data.toString();
	callback();
};

FileStream.prototype.close = function() {
	this.emit( "close" );
};

module.exports = FileStream;