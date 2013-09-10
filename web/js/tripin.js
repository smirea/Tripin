window.socket = io.connect();

var config;

$(function () {
  $('a[href="#"]').attr('href', 'javascript:void(0)');
});

function handle_login(response) {
  if(!response.error){
    window.accessToken = response.authResponse.accessToken;

    socket.emit('extendToken', accessToken);
    socket.emit('newLogin', accessToken);
  }
}

socket.on('init', function (data) {
  config = data.config;
  fb_login();
});

socket.on('userData', function(data) {
  API.me._update(data.me);

  $(".user_name").html(data.me.name);
  $(".user_img").html("<img class=\"img-polaroid\" src=\""+ data.me.pictureURL + "\" alt=\"Profile Picture\">");
  $(".login").hide();

  API.friends._places = API.friends._places || {all:{}};
  for (var i = 0; i < data.locations.length; i++) {
    var loc = data.locations[i];
    loc.page_id = loc.id;
    API.friends._places[loc.type] = API.friends._places[loc.type] || {};
    API.friends._places[loc.type][loc.id] = loc;
    API.friends._places.all[loc.id] = loc;
  }

  for (var i = 0; i < data.friends.length; i++) {
    if (data.friends[i].locationID) {
      data.friends[i].location = API.friends._places.all[data.friends[i].locationID];
    }

    data.friends[i].uid = data.friends[i].id;
    data.friends[i].pic_square = data.friends[i].pictureURL;
    data.friends[i].profile_url = data.friends[i].profileURL;
  }
  API.friends._update(data.friends);
});

function fb_login () {
  window.fbAsyncInit = function() {
    FB.init({
      appId      : config.app.id,
      channelUrl : '/channel.html', // Channel File
      status     : true, // check login status
      cookie     : true, // enable cookies to allow the server to access the session
      xfbml      : true // parse XFBML
    });

    FB.Event.subscribe('auth.authResponseChange', function(response){
      handle_login(response);
    });

    FB.Canvas.setAutoGrow();
  };

  // Load the SDK Asynchronously
  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = "//connect.facebook.net/en_US/all.js";
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'facebook-jssdk'));
}
