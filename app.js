#!/usr/bin/env node

import express from 'express'
import qs from 'querystring'
import cheerio from 'cheerio'
import get from 'simple-get'
import mcache from 'memory-cache'

const app = express()

/** CONFIG **/
const baseUrl = 'http://primewire.ag'
const port = process.env.PORT || 3000

const requestCache = (duration) => {
  return (req, res, next) => {
    let key = `__express__${req.originalUrl}` || req.url
    let cachedBody = mcache.get(key)
    if (cachedBody) {
      res.send(cachedBody)
    } else {
      res.sendResponse = res.send
      res.send = (body) => {
        mcache.put(key, body, duration)
        res.sendResponse(body)
      }
      next()
    }
  }
}

/** ROUTES **/
/* home */
app.get('/', (req, res) => {
  const text = '<h1>PrimeWire.AG API project</h1><p>This is just a scraper, if you have content you wish to be removed, please contact them (primewire.ag), not me, at their email: <a href="mailto:admin@primewire.ag">admin@primewire.ag</a>.</p><p>Full source code available on Github: <a href="https://www.github.com/milankragujevic/primewire-api/" target="_blank">primewire-api.git</a>. </p><hr><p>Copyright &copy; 2018 Milan Kragujević. Some rights reserved. By using this API you may be committing copyright infringement. I am not responsible for the contents of the API. </p>'
  res.send(text)
})

/* popular items, with pagination */
app.get('/:type/popular/:genre/:page', requestCache(60 * 60 * 6), (req, res) => {
  const page = parseInt(req.params.page)
  if (page < 1 || page > 50) {
    res.send({ success: false, error: `Page out of range (min. 1, max. 50)` })
    return
  }
  let genre = `${req.params.genre}`
  if (genre === '') {
    res.send({ success: false, error: `Please provide a genre (or 'all' for all genres)` })
    return
  }
  if (genre === 'all') { genre = '' }
  const type = `${req.params.type}`
  if (type === '' || (type !== 'movies' && type !== 'series')) {
    res.send({ success: false, error: `Invalid type provided, it can be either 'movies' or 'series'.` })
    return
  }
  let sort = 'featured'
  if (type === 'series') {
    sort = 'views'
  }
  let url = `${baseUrl}/?sort=${sort}&genre=${genre}&page=${page}`
  if (type === 'series') {
    url += '&tv=1'
  }
  function done (response) {
    if (!response) {
      res.send({ success: false, error: `Cannot fetch remote origin!` })
      return
    }
    if (genre === '') { genre = 'all' }
    res.send({ success: true, page, genre, sort, type, data: response })
  }
  get.concat(url, (a, b, c) => {
    if (a) {
      return done(false)
    }
    try {
      var $ = cheerio.load(c.toString())
    } catch (e) {
      return done(false)
    }

    const items = []

    $('.index_item > a').each(function () {
      let title = $(this).attr('title')
      let id = $(this).attr('href')

      id = id.match(/\d+/g)
      id = id ? id[0] : null

      let picture = $(this).find('img').attr('src')
      picture = `https:${picture}`

      let year = title.match(/\((\d+)\)/)
      year = year ? +year[1] : null

      title = title.slice(6, -7)

      items.push({ id, title, year, picture })
    })

    done(items)
  })
})

/*
 single item, both movies and series
 for movie: returns info + links
 for serie: returns info (-trailer) + episodes
 */
app.get('/item/:id', requestCache(60 * 60 * 6), (req, res) => {
  const id = req.params.id
  const url = `${baseUrl}/watch-${id}-X`

  function done (response) {
    if (!response) {
      res.send({ success: false, error: `Cannot fetch remote origin!` })
      return
    }
    res.send({ success: true, id, data: response })
  }

  get.concat(url, (a, b, c) => {
    if (a) {
      return done(false)
    }
    try {
      var $ = cheerio.load(c.toString())
    } catch (e) {
      return done(false)
    }

    const item = {}

    let type = 'movie'

    if ($('.tv_show_status').length) {
      type = 'serie'
    }

    const title = $('.movie_navigation h1.titles span a').text().split(' ( ')[0]
    const year = $('.movie_navigation h1.titles span a').text().split(' ( ')[1].replace(' )', '')
    const poster = `https:${$('.movie_thumb img').attr('src')}`

    const plotFull = $('.movie_info p').text()
    let plot = plotFull.replace(`${title}: `, '')
    plot = plot.replace('\n', '')

    const warningMessage = $('.warningMessage').text()

    let trailerUrl

    if ($('.movie_info_trailer iframe').length) {
      const trailerData = $('.movie_info_trailer iframe').attr('src')
      trailerUrl = `https://www.youtube.com/watch?v=${trailerData.replace('https://www.youtube.com/embed/', '')}`
    } else {
      trailerUrl = ''
    }

    const imdbID = $('.mlink_imdb a').attr('href').replace('http://www.imdb.com/title/', '').split('/')[0].split('?')[0]

    item.type = type
    item.title = title
    item.year = year
    item.poster = poster
    item.plot = plot
    item.warningMessage = warningMessage
    item.trailerUrl = trailerUrl
    item.imdbID = imdbID

    if (type === 'movie') {
      const links = []

      $('.movie_version').each(function () {
        const label = $(this).find('.version_host script').html()

        /* ignore advertisement links */
        if (/Promo|Sponsor/.test(label)) {
          return
        }

        let url = $(this).find('a[href^="/gohere.php"]').attr('href')
        if (typeof url === 'undefined') { return }
        url = url.slice(url.indexOf('?') + 1)
        url = qs.parse(url).url
        url = Buffer.from(url, 'base64').toString()

        links.push(url)
      })

      item.links = links
    } else {
      const episodes = []

      $('.tv_episode_item a').each(function () {
        const url = $(this).attr('href')
        const season = url.split('season-')[1].split('-')[0]
        const episode = url.split('episode-')[1].split('/')[0].split('?')[0]
        const title = $(this).find('.tv_episode_name').text().replace(' - ', '')
        const aired = $(this).find('.tv_episode_airdate').text().replace(' - ', '')

        if (season === 0 || season === 100 || episode === 0 || episode === 100 || /do not link/.test(title)) {
          return
        }

        episodes.push({
          episode,
          season,
          title,
          aired
        })
      })

      item.episodes = episodes
    }

    /* some code here */

    done(item)
  })
})

/* serie episode */
app.get('/item/:id/season/:season/episode/:episode', requestCache(60 * 60 * 6), (req, res) => {
  const id = req.params.id
  const season = req.params.season
  const episode = req.params.episode
  const url = `${baseUrl}/tv-${id}-X/season-${season}-episode-${episode}`

  function done (response) {
    if (!response) {
      res.send({ success: false, error: `Cannot fetch remote origin!` })
      return
    }
    res.send({ success: true, id, season, episode, type: 'episode', links: response })
  }

  get.concat(url, (a, b, c) => {
    if (a) {
      return done(false)
    }
    try {
      var $ = cheerio.load(c.toString())
    } catch (e) {
      return done(false)
    }

    const links = []

    $('.movie_version').each(function () {
      const label = $(this).find('.version_host script').html()

      /* ignore advertisement links */
      if (/Promo|Sponsor/.test(label)) {
        return
      }

      let url = $(this).find('a[href^="/gohere.php"]').attr('href')
      if (typeof url === 'undefined') { return }
      url = url.slice(url.indexOf('?') + 1)
      url = qs.parse(url).url
      url = Buffer.from(url, 'base64').toString()

      links.push(url)
    })

    done(links)
  })
})

/** LISTEN **/
app.listen(port)
console.log(`Listening on: ${port}`)
