/* Author:

*/

// storing markers etc.
var MAP;
var MC;
var GeoMarker;
var drawingManager;

var waypoints = [];
var circles = [];

(function(exp, $){

  // used to calculate and display the directions
  var directionsDisplay;
  var directionsService = new google.maps.DirectionsService();

  // basic setup for the map
  var mapOptions = {
    center: new google.maps.LatLng(52.542955, 13.41568),
    zoom: 6,
    disableDefaultUI: true,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };

  // initializes map and directionsDisplay
  function initialize_map () {
    return;
    directionsDisplay = new google.maps.DirectionsRenderer();
    MAP = new google.maps.Map(document.getElementById("map"), mapOptions);
    directionsDisplay.setMap(MAP);
    set_location();
  }

  function set_location () {
    GeoMarker = new GeolocationMarker();
    GeoMarker.setCircleOptions({
      fillColor: '#808080'
    });

    google.maps.event.addListenerOnce(GeoMarker, 'position_changed', function(){
      MAP.setCenter(this.getPosition());
    });

    google.maps.event.addListener(GeoMarker, 'geolocation_error', function(e) {
      console.warn('Could not get geolocation: ' + e.message);
    });

    GeoMarker.setMap(MAP);
  }

  function showFriends () {
    for (var i=0; i<waypoints.length; ++i) {
      var pos = waypoints[i].getPosition();
      API.friends.nearby(pos.ob, pos.pb, null, handleShowFriends);
    }
    for (var i=0; i<circles.length; ++i) {
      console.log(circles[i]);
      API.friends.nearby(
        circles[i].center.ob,
        circles[i].center.pb,
        circles[i].radius / 1000,
        handleShowFriends
      );
    }
  }

  var infowindow = new google.maps.InfoWindow({
    maxWidth: 260
  });

  function handleShowFriends (response) {
    var friend_markers = [];
    for (var i=0; i<response.length; ++i) {
      var city = API.friends._cities[response[i].location.id];
      var myLatlng = new google.maps.LatLng(city.latitude, city.longitude);
      marker = new google.maps.Marker({
        position: myLatlng
      });
      marker.user_data = response[i];
      friend_markers.push(marker);
    }
    MC = new MarkerClusterer(MAP, friend_markers);
    MC.setZoomOnClick(false);
    google.maps.event.addListener(MC, 'click', function(event) {
      var markers = event.getMarkers();
      var html = '';
      for (var i=0; i<markers.length; ++i) {
        html += friend_list_small_item(markers[i].user_data);
      }
      html = '<ul class="friend-list-small">' + html + '</ul>';

      infowindow.setContent(html);
      infowindow.setPosition(
        new google.maps.LatLng(event.getCenter().ob, event.getCenter().pb)
      );
      infowindow.open(MAP);
    });
  }

  function friend_list_detailed_item (data) {
    return '' +
      '<li>' +
        '<a class="user-photo" href="'+data.profile_url+'" target="_blank">' +
          '<img src="'+data.pic_square+'" alt="img" height="36" />' +
        '</a>' +
        '<div class="story-data">' +
          '<a class="user-name" href="'+data.profile_url+'" target="_blank">' +
            data.user_name +
          '</a>' +
          '<div class="story-text">' +
            data.story_text +
          '</div>' +
          '<div class="story-location">' +
            '<span class="story-time">'+data.story_time+'</span>,' +
            'near <span class="story-position">'+data.story_position+'</span>' +
          '</div>' +
        '</div>'
      '</li>';
  }

  function friend_list_small_item (data) {
    return '' +
      '<li>' +
        '<a href="'+data.profile_url+'" target="_blank">' +
          '<img src="'+data.pic_square+'" alt="img" height="36" />' +
        '</a>'
      '</li>';
  }

  $(function(){
    initLayout();
    initialize_map();

    drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.POLYLINE,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [
          google.maps.drawing.OverlayType.MARKER,
          google.maps.drawing.OverlayType.POLYLINE,
          google.maps.drawing.OverlayType.CIRCLE
        ]
      },
      circleOptions: {
        fillColor: '#422BC2',
        fillOpacity: 0.2,
        strokeWeight: 1,
        clickable: false,
        zIndex: 1,
        editable: false /* TODO: set this to true and handle edits */
      },
      polylineOptions: {
        strokeColor: '#422BC2',
        strokeOpacity: 0.7,
        editable: false /* TODO: set this to true and handle edits */
      }
    });
    drawingManager.setMap(MAP);

    google.maps.event.addListener(drawingManager, 'polylinecomplete', function (polyline) {
      var dots = polyline.getPath().getArray();
      for (var i=0; i<dots.length; ++i) {
        (function (index, location) {
          setTimeout(function () {
            addWaypoint(MAP, location)
          }, index * 200);
        })(i, dots[i]);
      }
    });

    google.maps.event.addListener(drawingManager, 'circlecomplete', function (circle) {
      circles.push(circle);
    });

    $("#getDirection").click(function () {
      drawingManager.setDrawingMode(null);
      showFriends();
    });
  });

  function addWaypoint (map, location) {
    var marker = new google.maps.Marker({
      position: location,
      map: map,
      animation: google.maps.Animation.DROP
    });
    waypoints.push(marker);
    addWaypointView(marker);
  }

  /**
   * Adds the information about the recently placed marker in the control panel
   * @param marker
   */
  function addWaypointView (marker) {
    $('#waypoints').append(
      jqElement('li')
        .addClass('marker')
        .addClass('alert alert-info')
        .append(
          jqElement('span').html(marker.position.ob),
          jqElement('span').html(', '),
          jqElement('span').html(marker.position.pb),
          jqElement('button').attr({
            type: 'button',
            'class': 'close',
            'data-dismiss': 'alert'
          }).html('x').on('click', function () {
            marker.setMap(null);
          })
        )
    );
  }

  function initLayout () {

  }

  function jqElement (type) {
    return $(document.createElement(type));
  }

})(window, jQuery);