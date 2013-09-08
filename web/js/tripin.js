window.fbAsyncInit = function() {
  FB.init({
    appId      : '135724333240350', // App ID
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

$(function () {
  $('a[href="#"]').attr('href', 'javascript:void(0)');
});

function handle_login(response) {
  if(!response.error){
    API.me.getBasicInfo(function(response){
      if(!response.error){
        var user = API.me.get();
        $(".user_name").html(user.name);
        $(".user_img").html("<img class=\"img-polaroid\" src=\""+ user.picture.data.url + "\" alt=\"Profile Picture\">");
        $(".login").hide();
        API.init();
      } else {
        setTimeout(get_user_data, 100);
      }
    });
  }
}
