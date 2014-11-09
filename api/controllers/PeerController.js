/**
 * PeerController.js
 *
 * @description ::
 * @docs        :: http://sailsjs.org/#!documentation/controllers
 */

var Promise = require('bluebird');

var PeerController = {
  create: function(req, res) {
    if (!req.isSocket) {
      return res.badRequest('Peer management only supported with sockets');
    }

    var socketId = req.socket.id;
    var channelId = req.param('channel');
    var canBroadcast = false;
    var isBroadcaster = req.param('broadcaster') || false;

    // check the channel exists
    var checkChannel = Promise.method(function(channelId) {
      return Channel.findOneById(channelId)
	.populate('owner')
	.then(function(channel) {
	  if (!channel) {
	    return Promise.reject(res.notFound('Can not be a peer for a nonexistent channel'));
	  }

	  if (req.session.user && req.session.user.id === channel.owner.id) {
	    canBroadcast = true;
	  }

	  if (!canBroadcast && isBroadcaster) {
	    return Promise.reject(res.forbidden('You are not an allowed broadcaster'));
	  }

	  return [channel, socketId];
	});
    });

    // create the peer given the channel and socket id
    var createPeer = Promise.method(function(channel, socketId) {
      return Peer.findOrCreate({ socketId: socketId, channel: channelId },
			       { socketId: socketId, channel: channelId, broadcaster: isBroadcaster })
	.then(function(peer) {
	  if (!peer) {
	    return Promise.reject(new Error('findOrCreate could neither find or create, simultaneously'));
	  }

	  return peer;
	})
	.then(function(peer) {
	  // update broadcaster
	  return Peer.update({ id: peer.id }, { broadcaster: isBroadcaster })
	    .then(function(upd) {
	      if (upd.length !== 1) {
		return Promise.reject(new Error('DB error, hit race condition updating peer',
						peer.id, 'with broadcaster as', isBroadcaster));
	      }

	      return upd[0];
	    });
	});
    });

    checkChannel(channelId).spread(createPeer)
      .then(function(peer) {
	// subscribe them
	Peer.subscribe(req.socket, peer);

	return res.json(peer);
      })
      .error(function(err) {
        sails.log.error('PeerController#create: DB error', e);
        return res.serverError('DB error');
      })
      .catch(Error, function(e) {
        sails.log.error('PeerController#create: Internal server error', e);
        return res.serverError('Internal server error');
      })
      .catch(function(e) {
	return res.serverError('Other internal server error');
      });
  },

  destroy: function(req, res) {
    if (!req.isSocket) {
      return res.badRequest('Peer management only supported with sockets');
    }

    var socketId = req.socket.id;
    var peerId = req.param('id');

    var findPeer = Promise.method(function(peerId) {
      return Peer.findOneById(peerId)
	.then(function(peer) {
	  if (!peer) {
            sails.log.warn('Socket', socketId, 'requested to destroy nonexistent peer', peerId);
            return Promise.reject(res.notFound('Can not destroy peer that does not exist'));
	  }

	  if (peer.socketId != socketId) {
            sails.log.warn('Socket', socketId, 'requested to destroy peer', peerId, 'that is not owned by him');
            return Promise.reject(res.forbidden('Can not destroy peers not your own'));
	  }

	  return peer;
	});
    });

    var destroyPeer = Promise.method(function(peer) {
      return Peer.destroy({ id: peer.id })
	.then(function() {
	  return peer;
	});
    });

    findPeer(peerId)
      .then(function(peer) {
	// destroy it
	return Peer.destroy({ id: peer.id })
          .then(function() {
            return peer;
          });
      })
      .then(function(peer) {
	// publicate his death
	Peer.publishDestroy(peer.id, null, { previous: peer });
	return peer;
      })
      .error(function(err) {
        sails.log.error('PeerController#destroy: DB error', e);
        return res.serverError('DB error');
      })
      .catch(Error, function(e) {
        sails.log.error('PeerController#destroy: Internal server error', e);
        return res.serverError('Internal server error');
      })
      .catch(function(e) {
        return res.serverError('Other internal server error');
      });

  }
};

module.exports = PeerController;
