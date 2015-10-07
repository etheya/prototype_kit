var express = require('express'),
  q = require('q'),
  path = require('path'),
  glob = require('glob-all'),
  hjs = require('hjs'),

  app = express();

var viewdirs = [
  __dirname + '/views',
  __dirname + '/govuk_elements/views',
  __dirname + '/app/**/views'
];

var viewext = 'html';

// This adds every template in the project
// as a partial that can be referenced by
// any other template.

// TODO: https://github.com/wolfendale/prototype_kit/issues/2
app.locals.partials = 
  glob.sync(viewdirs.map(function (e) {
    return e + '/**/*.' + viewext;
  })).reduce(function (m, file) {
      var relpath = file.replace(/^.*views\/(.*?)\.html/, '$1');
      m[relpath] = relpath;
      return m;
  }, {});

// console.log(app.locals.partials);

app.engine('html', hjs.__express);
app.set('view engine', viewext);
app.set('views', glob.sync(viewdirs));

// As the express.static middleware does not
// take an array of args, in order to serve the
// global assets and sprint assets, we need to
// loop over the glob of dirs
glob.sync([
  __dirname + 'govuk_elements/public',
  __dirname + '/public',
  __dirname + '/app/**/assets'
]).map(function (e) {
  app.use('/', express.static(e));
});

app.get('/', function (req, res) {
  res.render('index');
});

app.listen(process.env.port || 3000);