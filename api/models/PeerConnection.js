/**
 * PeerConnection.js
 *
 * @description :: Represents a single connection between two peers
 * @docs	:: http://sailsjs.org/#!documentation/models
 */

var _ = require('lodash');

const PeerConnectionStates = [ 'reserved', 'connecting',
			       'init_established', 'recv_established',
			       'established' ];

var PeerConnection = {
  adapter: 'memory',

  types: {
    state: function(state) {
      return _.contains(PeerConnectionStates, state);
    }
  },

  attributes: {
    state: {
      type: 'string',
      state: true,
      required: true
    },

    endpoint: {
      model: 'peer',
      via: 'id',
      required: true
    },

    initiator: {
      model: 'peer',
      via: 'id',
      required: true
    }

  },

  getOppositePeer: function getOppositePeer(peerConnection, localPeer) {
    var oppositePeer = peerConnection.endpoint;

    if (oppositePeer === localPeer.id) {
      oppositePeer = peerConnection.initiator;
    }

    return Peer.findOneById(oppositePeer)
      .populate('connections');
  },

  afterUpdate: function afterPeerConnectionUpdate(values, cb) {
    sails.log.verbose('PeerConnection#afterUpdate: values', values);
    cb();
  },

  afterDestroy: function afterPeerConnectionDestroy(values, cb) {
    sails.log.verbose('PeerConnection#afterDestroy: values', values);
    cb();
  },

  // this callback is executed when a peer is removed
  // this can happen when either the socket associated with the peer is destroyed
  // or for some reason they are removed from this peer connection
  afterPublishRemove: function afterPeerConnectionPublishRemove(id, alias, idRemoved, req) {
    sails.log.verbose('PeerConnection#afterPublishRemove: id', id, /*'attribute', attribute,*/ 'alias', alias/*, 'req', req*/);
  },

  afterPublishDestroy: function afterPeerConnectionPublishDestroy(id, req, options) {
    sails.log.verbose('PeerConnection#afterPublishDestroy: id', id, /*'attribute', attribute,*/ 'options', options/*, 'req', req*/);
  }
};

module.exports = PeerConnection;
