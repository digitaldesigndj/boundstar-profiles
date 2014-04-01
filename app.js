/**
 * Module dependencies.
 */

var express = require('express');
var MongoStore = require('connect-mongo')(express);
var flash = require('express-flash');
var path = require('path');
var mongoose = require('mongoose');
var passport = require('passport');
var expressValidator = require('express-validator');
var connectAssets = require('connect-assets');

var routes = require('./routes');
var profile = require('./routes/profile');
var player = require('./routes/player');
var http = require('http');
var path = require('path');
var fs = require('fs');

/**
 * Load controllers.
 */

var homeController = require('./controllers/home');
var rankController = require('./controllers/rank');
var localWorldsController = require('./controllers/local_worlds');
var playerController = require('./controllers/player');
var contactController = require('./controllers/contact');

/**
 * API keys + Passport configuration.
 */

var secrets = require('./config/secrets');
var passportConf = require('./config/passport');

/**
 * Create Express server.
 */

var app = express();

/**
 * Mongoose configuration.
 */

mongoose.connect(secrets.db);
mongoose.connection.on('error', function() {
  console.error('✗ MongoDB Connection Error. Please make sure MongoDB is running.');
});

/**
 * Express configuration.
 */

var hour = 3600000;
var day = (hour * 24);
var month = (day * 30);

app.set('port', process.env.PORT || 3001);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(connectAssets({
  paths: ['public/css', 'public/js'],
  helperContext: app.locals
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'out')));

app.use(express.compress());
app.use(express.favicon("public/img/StarryDex.ico")); 
app.use(express.logger('dev'));
app.use(express.cookieParser());
app.use(express.json());
app.use(express.urlencoded());
app.use(expressValidator());
app.use(express.methodOverride());
app.use(express.session({
  secret: secrets.sessionSecret,
  store: new MongoStore({
    url: secrets.db,
    auto_reconnect: true
  })
}));
app.use(express.csrf());
app.use(passport.initialize());
app.use(passport.session());
app.use(function(req, res, next) {
  res.locals.user = req.user;
  res.locals.token = req.csrfToken();
  res.locals.secrets = secrets;
  next();
});
app.use(flash());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: month }));
app.use(function(req, res, next) {
  // Keep track of previous URL
  if (req.method !== 'GET') return next();
  var path = req.path.split('/')[1];
  if (/(auth|login|logout|signup)$/.test(path)) return next();
  req.session.returnTo = req.path;
  next();
});
app.use(app.router);
app.use(function(req, res) {
  res.status(404);
  res.render('404');
});
app.use(express.errorHandler());
app.use(app.router);

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

/**
 * Application routes.
 */

app.get('/home', homeController.index);

app.get('/rank', passportConf.isAuthenticated, rankController.index);
app.post('/rank', passportConf.isAuthenticated, rankController.upgrade);

app.get('/worlds', passportConf.isAuthenticated, localWorldsController.index);
app.get('/worlds/:sector', passportConf.isAuthenticated, localWorldsController.sectorIndex);

app.get('/contact', contactController.getContact);
app.post('/contact', contactController.postContact);

app.get('/login', playerController.getLogin);
app.post('/login', playerController.postLogin);
app.get('/logout', playerController.logout);
app.get('/signup', playerController.getSignup);
app.post('/signup', playerController.postSignup);
app.get('/forgot', playerController.getForgot);
app.post('/forgot', playerController.postForgot);
app.get('/reset/:token', playerController.getReset);
app.post('/reset/:token', playerController.postReset);
app.get('/account', passportConf.isAuthenticated, playerController.getAccount);
app.post('/account/profile', passportConf.isAuthenticated, playerController.postUpdateProfile);
app.post('/account/password', passportConf.isAuthenticated, playerController.postUpdatePassword);
app.post('/account/delete', passportConf.isAuthenticated, playerController.postDeleteAccount);
app.get('/account/unlink/:provider', passportConf.isAuthenticated, playerController.getOauthUnlink);

/**
 * OAuth routes for sign-in.
 */

app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email', 'user_location'] }));
app.get('/auth/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/github', passport.authenticate('github'));
app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/google', passport.authenticate('google', { scope: 'profile email' }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/twitter', passport.authenticate('twitter'));
app.get('/auth/twitter/callback', passport.authenticate('twitter', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});
app.get('/auth/linkedin', passport.authenticate('linkedin', { state: 'SOME STATE' }));
app.get('/auth/linkedin/callback', passport.authenticate('linkedin', { failureRedirect: '/login' }), function(req, res) {
  res.redirect(req.session.returnTo || '/');
});

/**
 * Start Express server.
 */

server = http.createServer(app).listen(app.get('port'), function(){
  console.log("✔ Express server listening on port %d in %s mode", app.get('port'), app.get('env'));
});

/**
 * Start DocPad.
 */

var docpadInstanceConfiguration = {
  serverExpress: app,
  serverHttp: server,
  middlewareStandard: false
};
var docpadInstance = require('docpad').createInstance(docpadInstanceConfiguration, function(err){
  if (err)  return console.log(err.stack);
  // Tell DocPad to perform a generation, extend our server with its routes, and watch for changes
  docpadInstance.action('generate server watch', function(err){
    if (err)  return console.log(err.stack);
  });
});

module.exports = app;
