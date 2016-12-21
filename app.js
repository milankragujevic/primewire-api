var express = require('express');
var qs = require('querystring');
var cheerio = require('cheerio');
var get = require('simple-get');
var findEpisode = require('episode');

var app = express();

/*** CONFIG ***/
var base_url = 'http://primewire.ag';
var port = 8080;

/*** ROUTES ***/
// home
app.get('/', function(req, res) {
	var text = '<h1>PrimeWire.AG API project</h1><p>This is just a scraper, if you have content you wish to be removed, please contact them (primewire.ag), not me, at their email: <a href="mailto:admin@primewire.ag">admin@primewire.ag</a>.</p><p>Full source code available on Github: <a href="https://www.github.com/milankragujevic/primewire-api/" target="_blank">primewire-api.git</a>. </p><hr><p>Copyright &copy; 2017 Milan Kragujević. Some rights reserved. By using this API you may be committing copyright infringement. I am not responsible for the contents of the API. </p>'; 
	res.send(text);
});

// popular movies, with pagination
app.get('/:type/:sort/:genre/:page', function(req, res) {
	var page = parseInt(req.params.page);
	if(page < 1 || page > 50) {
		res.status(500).send('PAGE_OUT_OF_RANGE[1-50]');
		return;
	}
	var genre = "" + req.params.genre;
	if(genre == '') {
		res.status(500).send('INVALID_GENRE[all]');
		return;
	}
	if(genre == 'all') { genre = ''; }
	var sort = "" + req.params.sort;
	if(sort == '') {
		res.status(500).send('INVALID_SORT[featured]');
		return;
	}
	var type = "" + req.params.type;
	if(type == '') {
		res.status(500).send('INVALID_TYPE[movies]');
		return;
	}
	var url = 'http://www.primewire.ag/index.php?sort=' + sort + '&genre=' + genre + '&page=' + page;
	if(type == 'series') {
		url += '&tv=1';
	}
	function done(response) {
		if(!response) {
			res.status(500).send('INTERNAL_ERRROR');
			return;
		}
		res.status(200).send({ success: true, page: page, genre: genre, sort: sort, type: type, data: response });
	}
	get.concat(url, function (a,b,c) {
        if (a) {
            return done(false);
        }
        try {
            var $ = cheerio.load(c.toString());
        } catch (e) {
            return done(false);
        }
		
		var items = [];

        $('.index_item > a').each(function () {
            var title = $(this).attr('title');
            var id = $(this).attr('href');

            id = id.match(/\d+/g);
            id = id ? id[0] : null;
			
			var picture = $(this).find('img').attr('src');
			picture = 'https:' + picture;

            var year = title.match(/\((\d+)\)/);
            year = year ? +year[1] : null;

            title = title.slice(6, -7);

            items.push({ id: id, title: title, year: year, picture: picture });
        });
		
        done(items);
    });
});

/*** LISTEN ***/
app.listen(port);
console.log('Listening on localhost:'+ port);