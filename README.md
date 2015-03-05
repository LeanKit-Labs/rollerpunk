# Rollerpunk

Rollerpunk is a rotating file adapter for [Whistlepunk](https://github.com/LeanKit-Labs/whistlepunk).

## Usage

Use it just like you would any `whistlepunk` adapter. After you've installed it, `rollerpunk` will be required automatically by `whistlepunk`.

```javascript
var postal = require( "postal" );
var wp = require( "whistlepunk" )( postal, {
	adapters: {
		rollerpunk: {
			level: 4,
			logFolder: "/var/log/myapp", // Folder where logs will live
			fileName: "whistlepunk.log",
			maxSize: 500, // Maximum file size in KB
			maxLogFiles: 0 // Limit the number of archived files in your directory. 0 == unlimited
		}
	}
});
```