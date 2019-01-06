/*jslint node: true */
/*jshint esnext: true */
"use strict";

/**
 * Module dependencies.
 */
const Prismic = require('prismic-javascript');
const PrismicDOM = require('prismic-dom');
const app = require('./config');
const Cookies = require('cookies');
const PrismicConfig = require('./prismic-configuration');
const PORT = app.get('port');

var getDomain = function(req){
  // Figure out what domain user is on
  var domain;
  var host = req.get('host');

  if (host.indexOf("local") != -1) {
    domain = "hypnosis"
  }
  // On herokuapp domain use the 'hypnosis' home page
  else if (host.indexOf("heroku") != -1){
    domain="hypnosis"
  }
  else {
    domain = host.split(".")[1].split("a1")[1];
  }
  return domain;
};

app.listen(PORT, () => {
  process.stdout.write(`Point your browser to: http://localhost:${PORT}\n`);
});

// Middleware to inject prismic context
app.use((req, res, next) => {
  res.locals.ctx = {
    endpoint: PrismicConfig.apiEndpoint,
    linkResolver: PrismicConfig.linkResolver,
  };
  // add PrismicDOM in locals to access them in templates.
  res.locals.PrismicDOM = PrismicDOM;
  Prismic.api(PrismicConfig.apiEndpoint, {
    accessToken: PrismicConfig.accessToken,
    req,
  }).then((api) => {
    req.prismic = { api };
    res.locals.Txt = PrismicDOM.RichText;
    res.locals.Link = PrismicDOM.Link;
    res.locals.Date = PrismicDOM.Date;
    next();
  }).catch((error) => {
    next(error.message);
  });
});

// Query the site layout with every route
app.route('*').get((req, res, next) => {
  req.prismic.api.getSingle('menu')
  .then(function(menuContent){

    // Define the layout content
    var domain = getDomain(req);
    res.locals.domain = domain;
    res.locals.domainTitle = domain.charAt(0).toUpperCase() + domain.slice(1);
    res.locals.menuContent = menuContent;
    next();
  });
});


/*
 * -------------- Routes --------------
 */

/*
 * Preconfigured prismic preview
 */
app.get('/preview', (req, res) => {
  const token = req.query.token;
  if (token) {
    req.prismic.api.previewSession(token, PrismicConfig.linkResolver, '/')
    .then((url) => {
      const cookies = new Cookies(req, res);
      cookies.set(Prismic.previewCookie, token, { maxAge: 30 * 60 * 1000, path: '/', httpOnly: false });
      res.redirect(302, url);
    }).catch((err) => {
      res.status(500).send(`Error 500 in preview: ${err.message}`);
    });
  } else {
    res.send(400, 'Missing token from querystring');
  }
});

/*
 * Page route
 */
app.get('/:uid', (req, res, next) => {
  // Store the param uid in a variable
  const uid = req.params.uid;

  // Get a page by its uid
  req.prismic.api.getByUID("page", uid)
  .then((pageContent) => {
    if (pageContent) {
      res.render('page', { pageContent });
    } else {
      res.status(404).render('404');
    }
  })
  .catch((error) => {
    next(`error when retriving page ${error.message}`);
  });
});

/*
 * Homepage route
 */
app.get('/', (req, res, next) => {
  var domain = getDomain(req); 
  // Serve the correct homepage for the domain
  var homepageUID = 'a1-'+ domain +'-home';
  console.log(homepageUID);
  req.prismic.api.getByUID('page', homepageUID)
  .then((pageContent) => {
    if (pageContent) {
      res.render('homepage', { pageContent });
    } else {
      res.status(404).send('Could not find a homepage document. Make sure you create and publish a homepage document in your repository.');
    }
  })
  .catch((error) => {
    next(`error when retriving page ${error.message}`);
  });
});


