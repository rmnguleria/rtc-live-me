var _ = require('lodash');
var Promise = require('bluebird');
var io = require('sails.io.js')(require('socket.io-client'));

var getUserMedia = require('getusermedia');
var getUserMediaAsync = Promise.promisify(getUserMedia);

var PeerConnectionManager = require('./PeerConnectionManager');
var PeerConnection = require('./PeerConnection');

global._enableFirehose = false;

// start connecting immediately
global.socket = io.connect();

Promise.promisifyAll(socket);

const getUserMediaConfig = { video: true, audio: false };

console.log('Connecting Socket.io to Sails.js...');

var _setupCallbacks = false;

var _channelId = null;
var _isBroadcaster = false;
var _isLive = false;

// object of your local peer and peer connection from server
var _localPeerModel = null;

// stores all peer connections
var _pcManager = new PeerConnectionManager();

var _upstream = null;

function setUpstream(stream) {
  console.info('SETTING UPSTREAM', stream);
  _upstream = stream;
}

function getUpstream() {
  return _upstream;

  console.info('SELECTING UPSTREAM', _pcManager.getRemotes());

  return _.shuffle(_.where(_pcManager.getRemotes(), { 'state': 'established' }))[0].stream;
}

function addRemotePeerConnection(addedPeerConn) {
  if (_pcManager.exists(addedPeerConn)) return;

  var newPc = PeerConnection.createFromRemote(socket, _pcManager, addedPeerConn);
  newPc.createConnection();

  var upstream = getUpstream();
  console.info('got upstream', upstream, 'for remote peer connection', newPc.id);
  newPc.pc.addStream(upstream);
}

function removeRemotePeerConnection(removedPeerConn) {
  if (!_pcManager.exists(removedPeerConn)) return;

  if (_pcManager.exists(removedPeerConn)) {
    var pc = _pcManager.get(removedPeerConn);
    pc.destroy(_pcManager);
  }
}

function setupCallbacks() {
  if (_setupCallbacks) return;
  else _setupCallbacks = true;

  socket.on('peer', function gotPeerPub(message) {
    console.info('peer pubsub', message);

    if (!_localPeerModel) return;

    switch (message.verb) {
    case 'addedTo':
      if (message.id === _localPeerModel.id
          && message.attribute === 'connections') {
        addRemotePeerConnection(message.addedId);
      }
      break;

    case 'removedFrom':
      if (message.id === _localPeerModel.id
          && message.attribute === 'connections') {
        removeRemotePeerConnection(message.removedId);
      }
      break;

    default:
      console.info('unhandled peer pubsub', message.verb);
      break;
    }
  });

  socket.on('peerconnection', function gotPeerConnectionPub(message) {
    console.info('peerconnection pubsub', message);

    switch (message.verb) {
    case 'message':
      //handlePeerConnectionMessage(message);
      break;

    case 'updated':
      if (_pcManager.exists(message) && message.data.state) {
        _pcManager.get(message).state = message.data.state;
        //handlePeerConnectionUpdated(message);
      }
      break;

    default:
      console.info('unhandled peerconnection pubsub', message.verb);
      break;
    }
  });
}

function postPeer() {
  // first, we need to post as a new peer, and store it in local peer
  var step1 = function(channelId, isBroadcaster) {
    return new Promise(function(resolve, reject) {
      socket.post('/peer/create', { channel: channelId, broadcaster: isBroadcaster }, function gotPeerCreate(peerModel) {
        if (!peerModel.id) {
          return reject(new Error('Could not create peer model'));
        }

        return resolve(peerModel);
      });
    });
  };

  step1(_channelId, _isBroadcaster)
    .then(function(peerModel) {
      setupCallbacks();

      _localPeerModel = peerModel;
      return PeerConnection.createFromLocal(socket, _pcManager, { model: peerModel });
    })
    .then(function(localPeerConn) {
      console.info('created local peer connection', localPeerConn.id,
                   'in store?', _pcManager.exists(localPeerConn),
                   'type?', localPeerConn.type);
      localPeerConn.createConnection();
    })
    .error(function(err) {
      console.error('postPeer error', err);
    })
    .catch(function(e) {
      console.error('postPeer catch', e);
    });
}

function createOrGetPeer(channelId, isBroadcaster) {
  return new Promise(function(resolve, reject) {
    socket.post('/peer/create', { channel: channelId, broadcaster: isBroadcaster }, function gotPeerCreate(peerModel) {
      if (!peerModel.id) {
        return reject(new Error('Could not create peer model'));
      }

      return resolve(peerModel);
    });
  });
}

function createLocalPeerConnection(socket, manager, peerModel) {
  return PeerConnection.createFromLocal(socket, manager, { model: peerModel })
    .then(function(peerConn) {
      peerConn.createConnection();
      return peerConn;
    });
}

function injectUserMedia(peerConn) {
  return getUserMediaAsync(getUserMediaConfig)
    .then(function(stream) {
      return [stream, peerConn];
    });
}

function addStream(stream, peerConn) {
  peerConn.pc.addStream(stream);
}

// Attach a listener which fires when a connection is established:
socket.on('connect', function socketConnected() {
  console.log(
    'Socket is now connected and globally accessible as `socket`.\n' +
      'e.g. to send a GET request to Sails via Socket.io, try: \n' +
      '`socket.get("/foo", function (response) { console.log(response); })`'
  );

  // Sends a request to a built-in, development-only route which which
  // subscribes this socket to the firehose, a channel which reports
  // all messages published on your Sails models on the backend, i.e.
  // publishUpdate(), publishDestroy(), publishAdd(), publishRemove(),
  // and publishCreate().
  //
  // Note that these messages are received WHETHER OR
  // NOT the current socket is actually subscribed to them.  The firehose
  // is useful for debugging your app's pubsub workflow-- it should never be
  // used in your actual app.
  socket.get('/firehose', function nowListeningToFirehose () {
    // Attach a listener which fires every time Sails publishes
    // message to the firehose.
    socket.on('firehose', function newMessageFromSails ( message ) {
      if (_enableFirehose) console.log('FIREHOSE (debug): Sails published a message ::\n', message);
    });
  });

  if ($('#currentChannelId').length) {
    _channelId = parseInt($('#currentChannelId').text());
  }

  // we're only interested if we're on a channel
  if (!_channelId) return;

  // we're a broadcaster if this is here
  if ($('#addVideo').length) _isBroadcaster = true;

  // are we live?
  if ($('#liveness').data('status') === 'live') _isLive = true;
  else _isLive = false;

  // if we're a broadcaster we're not interested in continuing at this point
  // we'll come back later to add video
  // TODO can't open your own channel in multiple tabs
  setupCallbacks();

  if (_isBroadcaster) {
    $('#addVideo').click(function() {
      createOrGetPeer(_channelId, _isBroadcaster)
        .then(function(peerModel) {
          _localPeerModel = peerModel;
          return [peerModel, getUserMediaAsync(getUserMediaConfig)];
        })
        .spread(function(peerModel, stream) {
          peerModel.stream = stream;
          setUpstream(stream);
          $('#localVideo')[0].src = URL.createObjectURL(stream);
        })
        .error(function(err) {
          console.error(err);
        });
    });

    return;
  } else {
    createOrGetPeer(_channelId, _isBroadcaster)
      .then(function(peerModel) {
        _localPeerModel = peerModel;
        return createLocalPeerConnection(socket, _pcManager, peerModel);
      })
      .then(function(peerConn) {
        peerConn.pc.on('addStream', function(event) {
          /*
           _.forEach(_pcManager.getRemotes(), function(pc) {
           pc.pc.addStream(event.stream);
           });
           */
          setUpstream(event.stream);
          $('#localVideo')[0].src = URL.createObjectURL(event.stream);
        });
      });
  }

});
