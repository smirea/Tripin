
var PORT = 5000;
var DIR_CACHE = 'cache';

var config = require('./config.json');
var clientConfig = getClientConfig(cloneObject(config));

var connect = require('connect');
var http = require('http');
var orm = require('orm');
var fs = require('fs');

var ModuleFBScrape = function (graph, db) {
  var FBScrape = {};

  var _insertOrUpdate = function _insertOrUpdate (model, key, list, callback) {
    callback = callback || function () {};

    var ids = {};
    for (var i = 0; i < list.length; i++) {
      ids[key(list[i])] = list[i];
    }

    list = [];
    for (var id in ids) {
      list.push(ids[id]);
    }

    // FIXME: ZOMG, batch this
    // model.create(list) is retarded and stops at the first error apparently.
    function _iterative_insert(list) {
      if (list.length === 0) {
        callback();
        return;
      }
      var popped = list.pop();
      model.create([popped], function (err, items) {
        _iterative_insert(list);
      });
    }

    _iterative_insert(list);
  };

  var _fqlUserCallback = function _fqlUserCallback (err, response, callback) {
    // TODO: handle err
    response = response.data;

    var dbPersons = [];
    var dbFriends = [];
    var dbLocations = [];

    for (var i = 0; i < response.length; i++) {
      var location = response[i].current_location || response[i].hometown_location;
      var locationID;
      if (location) {
        locationID = location.id;

        var dbLocation = {
          id:           location.id,
          name:         location.name,
          latitude:     location.latitude,
          longitude:    location.longitude
        };
        dbLocations.push(dbLocation);
      }

      var dbPerson = {
        id:             response[i].uid,
        name:           response[i].name,
        pictureURL:     response[i].pic_square,
        pictureCached:  DIR_CACHE + '/' + response[i].uid + '.jpg',
        locationID:     locationID,
        profileURL:     response[i].profile_url,
        username:       response[i].username,
      };
      dbPersons.push(dbPerson);

      // Cache picture url locally if they aren't cached yet.
      if (response[i].pic_square && fs.existsSync(response[i].pictureCached)) {
        var url = response[i].pic_square.match(/^([a-z]+):\/\/([^\/]+)(\/.*)?$/);
        http.get({
          host: url[2],
          port: 80,
          path: url[3]
        }, function (person, result) {
          console.log('Caching: `' + person.pictureCached + '`');
          var file = fs.createWriteStream(person.pictureCached);
          result.pipe(file);
        }.bind(this, dbPerson)).on('error', function(person, e) {
          console.warn('Could not load profile pic for `'+person.id+'`, error:' + e.message);
        }.bind(this, dbPerson));
      }
    }

    _insertOrUpdate(db.models.person, function (i) { return i.id; }, dbPersons,
      function () {
        _insertOrUpdate(db.models.location, function(i) { return i.id; }, dbLocations,
          function () {
            callback(dbPersons, dbLocations);
          });
      });
  };

  /**
  * Get basic user information including location.
  * @param {Function} callback
  */
  FBScrape.myInfo = function _myInfo(callback) {
    callback = callback || function () {};
    var query = 'SELECT uid, name, pic_square, profile_url, hometown_location, ' +
                '       current_location, username FROM user ' +
                'WHERE uid = me()';

    return graph.fql(query, function _onFriendList (err, response) {
      _fqlUserCallback(err, response, function (dbPersons, dbLocations) {
        FBScrape.me = dbPersons[0];
        FBScrape.me.accessToken = graph.getAccessToken();
        db.models.person.get(FBScrape.me.id, function (err, myself) {
          myself.save({ accessToken: FBScrape.me.accessToken });
        });
        callback(FBScrape.me);
      });
    });
  };

  /**
  * Get friends list with basic information including location.
  * @param {Function} callback
  */
  FBScrape.myFriendList = function _friendList (callback) {
    callback = callback || function () {};
    var query = 'SELECT uid, name, pic_square, profile_url, hometown_location, ' +
                '       current_location, username FROM user ' +
                'WHERE uid IN (SELECT uid2 FROM friend WHERE uid1 = me())';

    return graph.fql(query, function _onFriendList (err, response) {
      _fqlUserCallback(err, response, function (dbPersons, dbLocations) {
        dbFriends = [];
        for (var i = 0; i < dbPersons.length; i++) {
          dbFriends.push({
            id1: FBScrape.me.id,
            id2: dbPersons[i].id
          });
          dbFriends.push({
            id1: dbPersons[i].id,
            id2: FBScrape.me.id
          });
        }

        _insertOrUpdate(db.models.friend, function(i) { return i.id1 + ' ' + i.id2; }, dbFriends,
          function () {
            callback(dbPersons);
          });
      });
    });
  };

  /**
   * Gets extended information on all cities in our DB.
   **/
  FBScrape.updateCities = function(callback) {
    callback = callback || function () {};
    db.models.location.all(function (err, items) {
      var ids = '';
      for (var i = 0; i < items.length; i++) {
        if (ids) {
          ids += ',';
        }
        ids += items[i].id;
      }

      var query = 'SELECT page_id, name, description, latitude, longitude, type FROM place ' +
                  'WHERE page_id IN (' + ids + ')';

      graph.fql(query, function (err, items) {
        dbLocations = [];
        items = items.data;
        for (var i = 0; i < items.length; i++) {
          dbLocation = {
            'id':           items[i].page_id,
            'name':         items[i].name,
            'description':  items[i].description,
            'latitude':     items[i].latitude,
            'longitude':    items[i].longitude,
            'type':         items[i].type
          };

          dbLocations.push(dbLocation);
        }

        function _update_iter(list) {
          if (list.length == 0) {
            callback();
            return;
          }
          var popped = list.pop();
          db.models.location.get(popped.id, function (err, item) {
            if (!err) {
              item.name         = popped.name;
              item.description  = popped.description;
              item.latitude     = popped.latitude;
              item.longitude    = popped.longitude;
              item.type         = popped.type;
              item.save(function (err) {
                _update_iter(list);
              });
            }
          });
        }

        _update_iter(dbLocations);
      });
    });
  };

  /* Send data to client. */
  FBScrape.getData = function(callback) {
    callback = callback || function () {};
    data = {
      me: FBScrape.me
    };

    db.models.friend.find({ id1: FBScrape.me.id }, function (err, friends) {
      var friendIDs = [];
      for (var i = 0; i < friends.length; i++) {
        friendIDs.push(friends[i].id2);
      }

      db.models.person.find({ id: friendIDs }, function (err, friends) {
        data.friends = friends || [];

        var locationIDs = [];
        for (var i = 0; i < data.friends.length; i++) {
          locationIDs.push(data.friends[i].locationID);
        }

        db.models.location.find({ id: locationIDs }, function (err, locations) {
          data.locations = locations || [];

          callback(data);
        });
      });
    });
  };

  return FBScrape;
};

orm.connect('sqlite://db.sqlite3', function (err, db) {
  if (err) throw err;

  var Person = db.define("person", {
    name:           String,
    pictureURL:     String,
    locationID:     { type: 'number', rational: false },
    profileURL:     String,
    pictureCached:  String,
    username:       String,
    accessToken:    String
  }, {
    id:           'id',
    methods: {
    }
  });

  var Friend = db.define("friend", {
    id1:          { type: 'number', rational: false },
    id2:          { type: 'number', rational: false }
  }, {
    id:           ['id1', 'id2'],
    methods: {
    }
  });

  var Location = db.define("location", {
    name:         String,
    description:  String,
    latitude:     String,
    longitude:    String,
    type:         String
  }, {
    id:           'id',
    methods: {
    }
  });

  db.sync();

  var app = connect.createServer(
    function (req, res, next) {
      var url = require('url');
      if (config.forbidden_paths.indexOf(url.parse(req.originalUrl).pathname) > -1) {
        res.writeHead(404);
        return;
      }
      if (url.parse(req.originalUrl).pathname !== '/index.html') return next();

      var graph = require('fbgraph');
      var fs = require('fs');

      fs.readFile(__dirname + '/index.html', function(err, data) {
        res.end(data);
      });
    },
    connect.static(__dirname + '/')
  ).listen(PORT);
  var io = require('socket.io').listen(app, {log:false});

  var graph = require('fbgraph');

  console.log(' >> Server started on port `%s`', PORT);

  io.sockets.on('connection', function(socket) {
    var FBScrape = ModuleFBScrape(graph, db, socket);

    socket.emit('init', {
      config: clientConfig
    });

    socket.on('disconnect', function () {
    });

    socket.on('extendToken', function (accessToken) {
      graph.setAccessToken(accessToken);
      graph.extendAccessToken({
          "client_id":      config.app.id,
          "client_secret":  config.app.secret,
      }, function (err, facebookRes) {
        // TODO: log error and inspect facebookRes
      });
    });

    socket.on('newLogin', function (accessToken) {
      graph.setAccessToken(accessToken);
      FBScrape.myInfo(function () {
        FBScrape.getData(function (data) {
          socket.emit('userData', data);
        });

        FBScrape.myFriendList(function () {
          FBScrape.getData(function (data) {
            socket.emit('userData', data);
          });

          FBScrape.updateCities(function () {
            FBScrape.getData(function (data) {
              socket.emit('userData', data);
            });
          });
        });
      });
    });

  });

});

function getClientConfig (data) {
  if (!data.client_excludes) {
    return data;
  }
  data = cloneObject(data);
  var getNode = function (trail, data, index) {
    index = index || 0;
    if (index >= trail.length) { return data; }
    return trail[index] in data ? getNode(trail, data[trail[index]], index + 1) : undefined;
  };
  for (var i=0; i<data.client_excludes.length; ++i) {
    var ex = data.client_excludes[i].split('.');
    var key = ex.pop();
    var node = getNode(ex, data);
    if (!node) {
      console.warn(' [ERROR] Node does not exist: `'+data.client_excludes[i]+'`');
      continue;
    }
    delete node[key];
  }
  delete data.client_excludes;
  return data;
}

/**
 * Clones plain objects only.
 * If you pass in objects with loops, you're gonna have a bad time...
 *
 * @param  {Object} obj
 * @return {Object}
 */
function cloneObject (obj) {
  return JSON.parse(JSON.stringify(obj));
}