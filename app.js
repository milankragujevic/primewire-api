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
app.get('/:type/popular/:genre/:page', function(req, res) {
	var page = parseInt(req.params.page);
	if(page < 1 || page > 50) {
		res.status(500).send('PAGE_OUT_OF_RANGE[1...50]');
		return;
	}
	var genre = "" + req.params.genre;
	if(genre == '') {
		res.status(500).send('INVALID_GENRE[all,...]');
		return;
	}
	if(genre == 'all') { genre = ''; }
	var type = "" + req.params.type;
	if(type == '' || (type != 'movies' && type != 'series')) {
		res.status(500).send('INVALID_TYPE[movies,series]');
		return;
	}
	var sort = 'featured';
	if(type == 'series') {
		sort = 'views';
	}
	var url = base_url + '/?sort=' + sort + '&genre=' + genre + '&page=' + page;
	if(type == 'series') {
		url += '&tv=1';
	}
	function done(response) {
		if(!response) {
			res.status(500).send('INTERNAL_ERRROR');
			return;
		}
		if(genre == '') { genre = 'all'; }
		res.status(200).send({ success: true, page: page, genre: genre, sort: sort, type: type, data: response });
		return;
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

// single item, both movies and series
// for movie: returns info + links 
// for serie: returns info (-trailer) + episodes
app.get('/item/:id', function(req, res) {
	var id = req.params.id;
	var url = base_url + '/watch-' + id + '-X';

	function done(response) {
		if(!response) {
			res.status(500).send('INTERNAL_ERRROR');
			return;
		}
		res.status(200).send({ success: true, id: id, data: response });
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
		
		var item = {};
		
		var type = 'movie';
		
		if($('.tv_show_status').length) {
			type = 'serie';
		}
		
		var title = $('.movie_navigation h1.titles span a').text().split(' ( ')[0];
		var year = $('.movie_navigation h1.titles span a').text().split(' ( ')[1].replace(' )', '');
		var poster = 'https:' + $('.movie_thumb img').attr('src');
		
		var plot_full = $('.movie_info p').text();
		var plot = plot_full.replace(title + ': ', '');
		plot = plot.replace("\n", '');
		
		var warning_message = $('.warning_message').text();
		
		if($('.movie_info_trailer iframe').length) {
			var trailer_data = $('.movie_info_trailer iframe').attr('src');
			var trailer_url = 'https://www.youtube.com/watch?v=' + trailer_data.replace('https://www.youtube.com/embed/', '');
		} else {
			var trailer_url = '';
		}
		
		var imdbID = $('.mlink_imdb a').attr('href').replace('http://www.imdb.com/title/', '').split('/')[0].split('?')[0];
		
		item.type = type;
		item.title = title;
		item.year = year;
		item.poster = poster;
		item.plot = plot;
		item.warning_message = warning_message;
		item.trailer_url = trailer_url;
		item.imdbID = imdbID;
		
		if(type == 'movie') {
			var links = [];

			$('.movie_version').each(function () {
				var label = $(this).find('.version_host script').html();

				// ignore advertisement links
				if (/Promo|Sponsor/.test(label)) {
					return;
				}

				var url = $(this).find('a[href^="/goto.php"]').attr('href');
				if(typeof url == 'undefined') { return; }
				url = url.slice(url.indexOf('?') + 1);
				url = qs.parse(url).url;
				url = new Buffer(url, 'base64').toString();

				links.push(url);
			});
			
			item.links = links;
		} else {
			
			var episodes = [];
			
			$('.tv_episode_item a').each(function () {
				var url = $(this).attr('href');
				var season = url.split('season-')[1].split('-')[0];
				var episode = url.split('episode-')[1].split('/')[0].split('?')[0];
				var title = $(this).find('.tv_episode_name').text().replace(' - ', '');
				var aired = $(this).find('.tv_episode_airdate').text().replace(' - ', '');
				
				if(season == 0 || season == 100 || episode == 0 || episode == 100 || /do not link/.test(title)) {
					return; 
				}
				
				episodes.push({
					episode: episode,
					season: season,
					title: title,
					aired: aired
				});
			});
			
			item.episodes = episodes;
			
		}

		// some code here
		
        done(item);
    });
});

// serie episode
app.get('/item/:id/season/:season/episode/:episode', function(req, res) {
	var id = req.params.id;
	var season = req.params.season;
	var episode = req.params.episode;
	var url = base_url + '/tv-' + id + '-X/season-' + season + '-episode-' + episode;
	
	function done(response) {
		if(!response) {
			res.status(500).send('INTERNAL_ERRROR');
			return;
		}
		res.status(200).send({ success: true, id: id, season: season, episode: episode, type: 'episode', links: response });
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
	
		var links = [];

		$('.movie_version').each(function () {
			var label = $(this).find('.version_host script').html();

			// ignore advertisement links
			if (/Promo|Sponsor/.test(label)) {
				return;
			}

			var url = $(this).find('a[href^="/goto.php"]').attr('href');
			if(typeof url == 'undefined') { return; }
			url = url.slice(url.indexOf('?') + 1);
			url = qs.parse(url).url;
			url = new Buffer(url, 'base64').toString();

			links.push(url);
		});

		done(links);
	});
});

/*** LISTEN ***/
app.listen(port);
console.log('Listening on localhost:'+ port);