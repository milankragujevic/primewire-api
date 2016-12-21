var express = require('express');
var app = express();

// Routes
app.get('/', function(req, res) {
	res.send('Hello World!');
});

// Listen
var port = 8080;
app.listen(port);
console.log('Listening on localhost:'+ port);