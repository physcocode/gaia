'use strict';
/* global module, __dirname */
var fork = require('child_process').fork;
var fs = require('fs');

/**
issue a POST request via marionette
*/
function post(client, url, json) {
  // must run in chrome so we can do cross domain xhr
  client = client.scope({ context: 'chrome' });
  return client.executeAsyncScript(function(url, json) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
      marionetteScriptFinished(xhr.response);
    };
    xhr.send(json);
  }, [url, JSON.stringify(json)]);
}

function AppServer(marionette, port, proc) {
  this.marionette = marionette;
  this.url = 'http://localhost:' + port;
  this.process = proc;

  this.manifest = JSON.parse(
    fs.readFileSync(__dirname + '/../fixtures/app/manifest.webapp', 'utf8')
  );
}

AppServer.prototype = {

  /**
  Indicate to the server that all requests to the given url should be
  given a response with headers but then the socket should be closed shortly
  after that time.

  @param {String} url to ban (/index.html).
  */
  fail: function(url) {
    return post(this.marionette, this.url + '/settings/fail', url);
  },

  /**
  Allow requests to the given url to proceed without failure after calling
  `.fail`.

  @param {String} url to unban.
  */
  unfail: function(url) {
    return post(this.marionette, this.url + '/settings/unfail', url);
  },

  /**
  Cork the response body of the given url while allowing headers.

  @param {String} url to cork.
  */
  cork: function(url) {
    return post(this.marionette, this.url + '/settings/cork', url);
  },

  /**
  Allow the body to be sent after calling `.cork`.

  @param {String} url to uncork.
  */
  uncork: function(url) {
    return post(this.marionette, this.url + '/settings/uncork', url);
  },

  close: function(callback) {
    this.process.kill();
    this.process.once('exit', callback.bind(this, null));
  },

  /**
  URI where the application zip lives this defined in child.js
  */
  get applicationZipUri() {
    return '/app.zip';
  },

  get manifestURL() {
    return this.url + '/manifest.webapp';
  },

  get packageManifestURL() {
    return this.url + '/package.manifest';
  }
};

module.exports = function create(client, callback) {
  var proc = fork(__dirname + '/child.js');

  proc.once('error', callback);
  proc.on('message', function(msg) {
    if (msg.type !== 'started') {
      return;
    }
    proc.removeListener('error', callback);
    callback(null, new AppServer(client, msg.port, proc));
  });
};

module.exports.AppServer;
