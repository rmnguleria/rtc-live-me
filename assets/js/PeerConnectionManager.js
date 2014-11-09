var _ = require('lodash');

function PeerConnectionManager() {
  // all peer connections
  this._peerconns = Object.create(null);
}

PeerConnectionManager.prototype.get = function get(peerConn) {
  var id = _.isObject(peerConn) ? peerConn.id : peerConn;
  return this._peerconns[peerConn.id];
};

PeerConnectionManager.prototype.exists = function exists(peerConn) {
  return _.isObject(this.get(peerConn));
};

PeerConnectionManager.prototype.set = function set(peerConn) {
  if (!this.exists(peerConn)) {
    this._peerconns[peerConn.id] = peerConn;
  }

  return this.get(peerConn);
};

PeerConnectionManager.prototype.remove = function remove(peerConn) {
  if (this.exists(peerConn)) {
    var id = _.isObject(peerConn) ? peerConn.id : peerConn;
    this._peerconns[id] = null;
    delete this._peerconns[id];
  }

  return this.get(peerConn);
};

PeerConnectionManager.prototype.getChildren = PeerConnectionManager.prototype.getLocals = function getRemotes() {
  return _.where(this._peerconns, { type: 'initiator' });
};

PeerConnectionManager.prototype.getParents = PeerConnectionManager.prototype.getRemotes = function getRemotes() {
  return _.where(this._peerconns, { type: 'receiver' });
};

module.exports = PeerConnectionManager;
