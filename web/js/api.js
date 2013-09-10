
var API = {
  DEBUG: true,
  fql: function _fql (query, callback) {
    callback = callback || API.printJSON;
    return FB.api({
      method: 'fql.query',
      query: query,
      //HACK: FOR DEBUG ONLY!!
      limit: 10
    }, callback);
  },
  location: {
    distance: function _distance (lat1, lon1, lat2, lon2) {
      var radlat1 = Math.PI * lat1/180;
      var radlat2 = Math.PI * lat2/180;
      var radlon1 = Math.PI * lon1/180;
      var radlon2 = Math.PI * lon2/180;
      var theta = lon1-lon2;
      var radtheta = Math.PI * theta/180;
      var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
      dist = Math.acos(dist);
      dist = dist * 180/Math.PI;
      dist = dist * 60 * 1.1515;
      unit = "K";
      if (unit=="K") { dist = dist * 1.609344; }
      if (unit=="N") { dist = dist * 0.8684; }
      return dist;
    },
    getPostsLocation: function _get_location_posts (placeId, userObj) {
      FB.api("/"+search.id, "GET",
      {
        "type": "location",
        "place": placeId,
        "fields": "",

      }, function (resp){

      });
    }
  },
  friends: {
    /**
     * Stores all the cached data about friends
     */
    _info: null,
    _places: null,
    _details: null,
    nearby: function _friends_nearby (latitude, longitude, threshold, callback){
      if (!API.friends._info) {
        console.warn('[API] Friends not initialized!');
        callback(null);
        return;
      }
      var in_range = [];
      threshold = threshold || 100;
      for (var key in API.friends._info) {
        var distance = API.location.distance(
          latitude,
          longitude,
          API.friends._info[key].location.latitude,
          API.friends._info[key].location.longitude
        );
        if (distance > threshold) { continue; }
        in_range.push(API.friends._info[key]);
      }
      callback(in_range);
    },
    _fetchInfo: function _fetch_friends_info (userId, callback){
      return FB.api('/'+userId.toString(),
        {
          fields: 'address,name,location,picture,username,id'
        }, function (response){
            response.profileURL = 'http://www.facebook.com/';
            response.profileURL += response.username ?  response.username : response.id;
            callback(response);
        });
    },
    getInformation: function _get_friends_information (userId, callback){
       API.friends._fetchInfo(userId, function(){
        var html = "";

        callback(userHTML)
      });
    },

    _fetchMultiple: function _fetch_multiple_info (userIDS, callback){
      API.friends._details = {};
      API.friends._details.data = [];
      var batches = [];
      var maxCount = parseInt(userIDS.length/50, 10);
      var count = 0;
      while(count <= maxCount) {
        for(var i=0; i < userIDS.length && i < 50*(count+1); i++){
          var userReq = {
                          "method":"GET",
                          "relative_url":userIDS[i].toString()+"?fields=address,name,location,picture,username,id"
                        };
          batches.push(userReq);
        }

        FB.api('/', 'POST', {batch: batches}, function(responses){
          for(var i=0; i<responses.length; i++){
            var userInfo = JSON.parse(responses[i].body);
            userInfo.profileURL = 'http://www.facebook.com/';
            userInfo.profileURL += userInfo.username ?  userInfo.username : userInfo.id;
            userInfo.pictureURL = userInfo.picture.data.url;
            delete userInfo.picture;
            API.friends._details.data.push(userInfo);
          }
          if(count === maxCount)
            callback(API.friends._details.data);
        });
      }
    },
    withinRadius: function _friends_withinRadius (latitude, longitude, threshold, callback) {
      threshold = threshold || 10000;
      // For some reason aliasing the distance function does not work :|.
      var query = 'SELECT name, description, page_id, type, distance(latitude, longitude, ' +
                                    "'"+latitude+"', '"+longitude+"') " +
                    'FROM place ' +
                    'WHERE distance(latitude, longitude, ' +
                                    "'"+latitude+"', '"+longitude+"')" +
                            ' < ' + threshold;
      return API.fql(query, callback);
    },
    places: function _friends_places (callback) {
      if (!API.friends._info) {
        console.warn('[API] Friends not initialized!');
        return;
      }
      var places = [];
      for (var key in API.friends._info) {
        if (!API.friends._info[key].location) {
          continue;
        }
        places.push("'"+API.friends._info[key].location.id+"'");
      }
      var fields = 'checkin_count, content_age, description, display_subtext, geometry, is_city, '+
                    'is_unclaimed, latitude, longitude, name, page_id, pic, pic_big, pic_crop, '+
                    'pic_large, pic_small, pic_square, search_type, type';
      var query = "SELECT "+fields+" FROM place WHERE page_id IN ("+places.join(',')+")";
      API.friends._places = API.friends._places || {};
      API.fql(query, function (response) {
        console.log(response);
        for (var i=0; i<response.length; ++i) {
          API.friends._places[response.type] = API.friends._places[response.type] || {};
          API.friends._places[response.type][response[i].page_id] = response[i];
        }
        callback();
      });
    },
    /**
     * Get the current location of all of the user's friends
     * @param {Function} callback
     */
    location: function _friends_location (callback) {
      var query = 'SELECT uid,name,pic_square,profile_url,' +
                          'hometown_location,current_location ' +
                    'FROM user WHERE uid=me() OR uid IN ' +
                        '(SELECT uid2 FROM friend WHERE uid1 = me())';
      return API.fql(query, function _on_friends_location (response) {
        var places = {};
        for (var i=0; i<response.length; ++i) {
          response[i].location = response[i].current_location ||
                                 response[i].hometown_location;
          delete response[i].hometown_location;
          delete response[i].current_location;
          if (response[i].location) {
            places[response[i].location.id] = response[i].location;
          }
        }
        API.friends._update(response);
        callback(response);
      });
    },
    /**
     * Retrieve all the cached data about friends
     */
    get: function _get () {
      return API.friends._info;
    },
    /**
     *
     */
    _update: function __update (friends) {
      API.friends._info = API.friends._info || {};
      for (var i=0; i<friends.length; ++i) {
        if (API.friends._info[friends[i].uid]) {
          for (var key in friends[i]) {
            API.friends._info[friends[i].uid][key] = friends[i][key];
          }
        } else {
          API.friends._info[friends[i].uid] = friends[i];
        }
      }
    }
  },
  posts: {
    locationPosts: function _get_location_posts (latitude, longitude, threshold, callback) {
      threshold = threshold || 10000;
      var rqst = '/search?type=location&center='+latitude.toString()+','+longitude.toString()+'&distance='+threshold.toString();
      FB.api(rqst, function (response){
        callback(response);
      });
    }
  },
  printJSON: function _print (data) {
    var str = JSON.stringify(data, null, 2);
    console.log(str);
  },
  me: {
    _info: null,
    getBasicInfo: function _request_name_image (callback) {
      FB.api('/me', {
          fields: 'name, picture'
      }, function(response){
          API.me._update(response);
          callback(response);
      });
    },
    _update: function (user) {
      API.me._info = user;
    },
    get: function _get(){
      return API.me._info;
    }
  }
};
