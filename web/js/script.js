/* Author:

*/

// storing markers etc.
var MAP;
var OMS;
var GeoMarker;
var drawingManager;

var waypoints = [];
var circles = [];
var polylines = [];

var unique_markers = {};

(function(exp, $){

  // used to calculate and display the directions
  var directionsDisplay;
  var directionsService = new google.maps.DirectionsService();

  // basic setup for the map
  var mapOptions = {
    center: new google.maps.LatLng(37.76202988573211, -122.4481201171875),
    zoom: 10,
    disableDefaultUI: true,
    mapTypeId: google.maps.MapTypeId.ROADMAP
  };

  var oms_options = {
    // nearbyDistance: 200,
    // circleSpiralSwitchover: 9,
  };

  // initializes map and directionsDisplay
  function initialize_map () {
    directionsDisplay = new google.maps.DirectionsRenderer();
    MAP = new google.maps.Map(document.getElementById("map"), mapOptions);
    directionsDisplay.setMap(MAP);
    OMS = new OverlappingMarkerSpiderfier(MAP, oms_options);
    // set_location();
  }

  var IB = new InfoBox({
    content: 'yolo',
    disableAutoPan: false,
    maxWidth: 0,
    pixelOffset: new google.maps.Size(25, -40),
    zIndex: 0,
    boxStyle: {
      background: 'transparent',
      opacity: 0.85,
      minWidth: '150px',
      maxWidth: '300px'
    },
    closeBoxMargin: '10px 2px 2px 2px',
    closeBoxURL: '',
    infoBoxClearance: new google.maps.Size(1, 1),
    isHidden: false,
    pane: "floatPane",
    enableEventPropagation: false,
  });

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
    var i;
    for (i=0; i<waypoints.length; ++i) {
      var pos = waypoints[i].getPosition();
      API.friends.nearby(pos.lat(), pos.lng(), null, handleShowFriends);
    }
    for (i=0; i<circles.length; ++i) {
      API.friends.nearby(
        circles[i].center.lat(),
        circles[i].center.lng(),
        circles[i].radius / 1000,
        handleShowFriends
      );
    }
  }

  // var infowindow = new google.maps.InfoWindow({
  //   maxWidth: 260
  // });

  function fuzzyPos (pos, fuzz) {
    fuzz = fuzz || 6e-2;
    return new google.maps.LatLng(
      // pos.lat() + (Math.random() > 0.5 ? 1 : -1) * Math.random() * fuzz,
      // pos.lng() + (Math.random() > 0.5 ? 1 : -1) * Math.random() * fuzz
      pos.lat() - Math.random() * fuzz,
      pos.lng() - Math.random() * fuzz
    );
  }

  var makePinImage = (function makePinImage_wrapper () {
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');

    var tmp_canvas = document.createElement('canvas');
    var tmp_context = tmp_canvas.getContext('2d');

    return function draw_pin (img, type, pin) {
      type = type || 'image/png';
      pin = pin || {w:25, h:25};
      pin.y = -3;
      var x = 0;
      var y = 0;
      var r = Math.min(img.width, img.height) / 2;
      var pad = 4;
      var dim = {
        x: x + r + pad,
        y: y + r + pad,
        r: r + pad,
        w: pin.w,
        h: pin.h
      };

      canvas.width = img.width + pad * 2;
      canvas.height = img.height + pad * 2 + pin.h + pin.y;

      var stats = {
        url: null,
        w: canvas.width,
        h: canvas.height,
        anchor: {
          x: dim.x + dim.w / 2,
          y: dim.y + dim.h
        },
        shape: {
          type: 'poly',
          coord: [canvas.width * 1/3, 0, canvas.width * 2/3, 0,
                  canvas.width, dim.r * 2/3, canvas.width, dim.r * 4/3,
                  canvas.width / 2, canvas.height, 0, dim.r * 4/3,
                  0, dim.r * 2/3 ]
        }
      };

      context.fillStyle = '#000';
      draw_pin_bottom(context, dim.x, dim.y + dim.r + pin.y, dim.w, dim.h);
      context.beginPath();
      context.arc(dim.x, dim.y, dim.r, 0, Math.PI * 2);
      context.fill();
      dim.r -= 1;
      dim.w -= 1;
      dim.h -= 1;
      context.fillStyle = '#fff';
      draw_pin_bottom(context, dim.x, dim.y + dim.r + pin.y, dim.w, dim.h);
      context.beginPath();
      context.arc(dim.x, dim.y, dim.r, 0, Math.PI * 2);
      context.fill();

      tmp_canvas.width = img.width;
      tmp_canvas.height = img.height;

      tmp_context.arc(r, r, r, 0, Math.PI * 2);
      tmp_context.drawImage(img, 0, 0);
      tmp_context.globalCompositeOperation = 'destination-in';
      tmp_context.fill();

      context.drawImage(tmp_canvas, x + pad, y + pad);

      stats.url = canvas.toDataURL(type);
      return  stats;

      function draw_pin_bottom (context, x, y, w, h) {
        x = x - w/2;
        var shape = [
          { mid: [x + w / 2, y + h / 2],
            end: [x + w / 2, y + h], },
          { mid: [x + w / 2, y + h / 2],
            end: [x + w, y], },
        ];
        shape.start = [x, y];

        context.beginPath();
        context.moveTo.apply(context, shape.start);
        for (var i=0; i<shape.length; ++i) {
          context.quadraticCurveTo(shape[i].mid[0], shape[i].mid[1], shape[i].end[0], shape[i].end[1]);
        }
        context.closePath();
        context.fill();
      }
    }
  })();

  function make_infobox_content (person) {
    var elem = jqElement('div');
    elem.css({
      position: 'relative',
    }).append(
      jqElement('a').
      attr({
        href: person.profile_url,
        target: '_blank'
      }).
      css({
        display: 'block',
        background: 'rgba(60, 60, 60, 1)',
        padding: '3px 6px',
        textDecoration: 'none'
      }).
      append(
        jqElement('div').html(person.name).css({
          fontSize: '10pt',
          fontWeight: 'bold',
          color: '#fff'
        })
      )
    );
    return elem[0];
  }

  function handleShowFriends (response) {
    response.forEach(function (resp) {
      if (unique_markers[resp.id]) {
        return;
      }
      unique_markers[resp.id] = true;

      var img = new Image();
      img.onload = function () {
        var city = API.friends._cities[resp.location.id];
        var myLatlng = new google.maps.LatLng(city.latitude, city.longitude);
        var pin = makePinImage(img, null, {w:25, h:25});
        marker = new google.maps.Marker({
          map: MAP,
          position: fuzzyPos(myLatlng),
          icon: {
            url: pin.url,
            size: new google.maps.Size(pin.w, pin.h),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(pin.anchor.x, pin.anchor.y),
          },
          shape: pin.shape,
          shadow: '',
        });
        marker.user_data = resp;
        google.maps.event.addListener(marker, 'click', function () {
          IB.close();
          IB.setContent(make_infobox_content(this.user_data));
          IB.open(MAP, this);
        });
        // OMS.addMarker(marker);
      };
      img.setAttribute('width', 40);
      img.src = resp.pictureCached;
    });


    // OMS.addListener('click', function (marker, event) {
    //   infowindow.setContent(marker.desc);
    //   infowindow.open(MAP, marker);
    // });

    // OMS.addListener('spiderfy', function(markers) {
    //   infowindow.close();
    // });
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
        '</div>'+
      '</li>';
  }

  function friend_list_small_item (data) {
    return '' +
      '<li>' +
        '<a href="'+data.profile_url+'" target="_blank">' +
          '<img src="'+data.pic_square+'" alt="img" height="36" />' +
        '</a>'+
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
            addWaypoint(MAP, location);
          }, index * 200);
        })(i, dots[i]);
      }
      polylines.push(polyline);
    });

    google.maps.event.addListener(drawingManager, 'circlecomplete', function (circle) {
      circles.push(circle);
    });

    $("#getDirection").click(function () {
      unique_markers = {};
      drawingManager.setDrawingMode(null);
      waypoints.forEach(function (pt) {
        // pt.setMap(null);
      });
      polylines.forEach(function (pl) {
        // pl.setMap(null);
      });
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
    var $pos = jqElement('span').addClass('location-coordinates');
    API.friends.withinRadius(marker.position.lat(), marker.position.lng(), 50000, function (res) {
      try {
        res.sort(function (a, b) {
          return a.distance_meters - b.distance_meters;
        });
        $pos.append(res[0].name);
      } catch (ex) {
        console.warn(ex.message, res);
        $pos.append(
          jqElement('span').html(marker.position.lat()),
          jqElement('span').html(', '),
          jqElement('span').html(marker.position.lng())
        );
      }
      $('#waypoints').append(
        jqElement('li')
          .addClass('marker')
          .append(
            jqElement('a').
              attr('href', 'javascript:void(0)').
              append(
                jqElement('i').addClass('icon-location-arrow'),
                $pos,
                jqElement('span').
                  addClass('close').
                  attr('close', 2).
                  html('&times;').
                  on('click', function () {
                    marker.setMap(null);
                  })
              )
          )
      );
    });
  }

  function initLayout () {
    $('a[href="#"]').attr('href', 'javascript:void(0)');

    $(window).on('click', '.toggle .handle', function (event) {
      event.preventDefault();
      $(this).siblings('.target').slideToggle();
    });

    // $(window).on('mouseleave', '.toggle .target', function (event) {
    //   event.preventDefault();
    //   $(this).hide();
    // });

    $(window).on('click', '.toggle .close', function (event) {
      event.preventDefault();
      var p = $(this);
      var c = $(this).attr('close');
      c = c || 1;
      for (var i=0; i < c; ++i, p = p.parent()) {}
      p.slideUp('fast', function () { $(this).remove(); });
    });
  }

  function jqElement (type) {
    return $(document.createElement(type));
  }

})(window, jQuery);
