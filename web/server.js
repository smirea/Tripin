
var PORT = 5000;

var connect = require('connect');

var app = connect.createServer(
  connect.static( __dirname + '/' )
).listen(PORT);

var io = require('socket.io').listen(app);

console.log(' >> Server started on port `%s`', PORT);

io.sockets.on('connection', function(socket){

  socket.on('init', function (info) {
  });

  socket.on('disconnect', function () {
  });

});