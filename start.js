var express = require('express'),
  favicon = require('serve-favicon'),
  bodyParser = require('body-parser'),
  q = require('q'),
  path = require('path'),
  glob = require('glob-all'),
  hjs = require('hjs'),
  auth = require('basic-auth'),

  // for auth middleware
  username = process.env.USERNAME,
  password = process.env.PASSQORD,
  env = process.env.NODE_ENV || 'development',

  app = express();

app.use(favicon( path.join(__dirname, 'global', 'public', 'images', 'favicon.ico')));

app.use(bodyParser.urlencoded({ extended : true }));

app.use(function (username, password, req, res, next) {
  var creds = auth(req);

  if (env === 'production') {
    if (!creds || !creds.name !== username || !creds.pass !== password) {
      res.statusCode = 401;
      res.setHeader('WWW-Authenticate', 'Basic realm=Authorization Required');
      res.end('Access denied');
    }
    else {
      next();
    }
  }
});

function crunchTemplates(viewdirs) {
  return glob.sync(viewdirs.map(function (e) {
    return e + '/**/*.html';
  })).reduce(function (m, file) {
    var relpath = file.replace(/^.*(?:views|template)\/(.*?)\.html/, '$1');
    m[relpath] = relpath;
    return m;
  }, {});
}

// TODO: https://github.com/wolfendale/prototype_kit/issues/2
app.locals.partials = crunchTemplates([
  __dirname + '/global/views',
  __dirname + '/global/template',
]);

app.locals.assetPath = '/';
app.locals.localAssets = '/';
app.locals.isDev = app.get('env') === 'development';

app.engine('html', hjs.__express);
app.set('view engine', 'html');
app.set('views', glob.sync([
  __dirname,
  __dirname + '/global/views',
  __dirname + '/global/template',
]));

// as the express.static middleware does not
// take an array of args, in order to serve the
// global assets and sprint assets, we need to
// loop over the glob of dirs

// TODO: if we manage to include govuk_elements
// as a dependency, this can be reduced to just
// share the 'public' dir and a gulp task to
// move the right files around
glob.sync([
  __dirname + '/govuk_elements',
  __dirname + '/global/public',
]).map(function (e) {
  app.use('/', express.static(e));
});

// include the app file from each sub project
// as sub app mounted at the prefix of the name
// of the folder
glob.sync(__dirname + '/app/**/app.js')
  .map(function (e) {
    var p = './' + path.relative(
      __dirname, e
    ).replace(/\\/g, '/');
    var name = e.replace(/^.*app(\/.*?)\/.*$/, '$1');
    var sub = require(p);
    // if a get request falls through to this
    // point we check to see if we have a view
    // that matches the url and render that.
    // useful if people do not want to declare
    // routes
    sub.get('*', function (req, res, next) {
      try {
        res.render(req.path.substring(1));
      } catch (e) {
        next();
      }
    });
    // this adds a default post to every page
    // that checks whether the request body
    // contains a 'next-page' key, if so
    // we redirect the user to whatever the
    // value of that key is
    sub.post('*', function (req, res, next) {
      if (req.body['next-page']) {
        res.redirect(name + '/' + req.body['next-page']);
      } else {
        next();
      }
    });
    app.use(name, sub);
  });

// mount admin app
if (app.locals.isDev) {
  app.use('/admin', require('./global/admin/app.js'));
}

// global controllers
require('./lib/controllers/index.js')(app);

app.listen(process.env.PORT || 3000);