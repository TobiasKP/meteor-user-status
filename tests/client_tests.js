/* globals navigator, Package, Tinytest */

import { Meteor } from 'meteor/meteor';
import { TimeSync } from 'meteor/mizzao:timesync';
import { InsecureLogin } from './insecure_login';

// The maximum tolerance we expect in client-server tests
// TODO why must this be so large?
const timeTol = 1000;
let loginTime = null;
let idleTime = null;

// Monitor tests will wait for timesync, so we don't need to here.
Tinytest.addAsync('status - login', (test, next) => InsecureLogin.ready(() => {
  test.ok();
  loginTime = new Date(TimeSync.serverTime());
  return next();
}));

// Check that initialization is empty
Tinytest.addAsync('status - online recorded on server', (test, next) => Meteor.call('grabStatus', function (err, res) {
  test.isUndefined(err);
  test.length(res, 1);

  const user = res[0];
  test.equal(user._id, Meteor.userId());
  test.equal(user.status.online, true);

  test.isTrue(Math.abs(user.status.lastLogin.date - loginTime) < timeTol);

  // TODO: user-agent doesn't seem to match up in phantomjs for some reason
  if (Package['test-in-console'] == null) {
    test.equal(user.status.lastLogin.userAgent, navigator.userAgent);
  }

  test.equal(user.status.idle, false);
  test.isFalse(user.status.lastActivity != null);

  return next();
}));

Tinytest.addAsync('status - session recorded on server', (test, next) => Meteor.call('grabSessions', function (err, res) {
  test.isUndefined(err);
  test.length(res, 1);

  const doc = res[0];
  test.equal(doc.userId, Meteor.userId());
  test.isTrue(doc.ipAddr != null);
  test.isTrue(Math.abs(doc.loginTime - loginTime) < timeTol);

  // This shit doesn't seem to work properly in PhantomJS on Travis
  if (Package['test-in-console'] == null) {
    test.equal(doc.userAgent, navigator.userAgent);
  }

  test.isFalse(doc.idle != null); // connection record, not user
  test.isFalse(doc.lastActivity != null);

  return next();
}));

Tinytest.addAsync('status - online recorded on client', (test, next) => {
  test.equal(Meteor.user().status.online, true);
  return next();
});

Tinytest.addAsync('status - idle report to server', (test, next) => {
  const now = TimeSync.serverTime();
  idleTime = new Date(now);

  return Meteor.call('user-status-idle', now, (err) => {
    test.isUndefined(err);

    // Testing grabStatus should be sufficient to ensure that sessions work
    return Meteor.call('grabStatus', function (err, res) {
      test.isUndefined(err);
      test.length(res, 1);

      const user = res[0];
      test.equal(user._id, Meteor.userId());
      test.equal(user.status.online, true);
      test.equal(user.status.idle, true);
      test.isTrue(user.status.lastLogin != null);
      // This should be the exact date we sent to the server
      test.equal(user.status.lastActivity, idleTime);

      return next();
    });
  });
});

Tinytest.addAsync('status - active report to server', (test, next) => {
  const now = TimeSync.serverTime();

  return Meteor.call('user-status-active', now, (err) => {
    test.isUndefined(err);

    return Meteor.call('grabStatus', function (err, res) {
      test.isUndefined(err);
      test.length(res, 1);

      const user = res[0];
      test.equal(user._id, Meteor.userId());
      test.equal(user.status.online, true);
      test.isTrue(user.status.lastLogin != null);

      test.equal(user.status.idle, false);
      test.isFalse(user.status.lastActivity != null);

      return next();
    });
  });
});

Tinytest.addAsync('status - idle report with no timestamp', (test, next) => {
  const now = TimeSync.serverTime();
  idleTime = new Date(now);

  return Meteor.call('user-status-idle', undefined, (err) => {
    test.isUndefined(err);

    return Meteor.call('grabStatus', function (err, res) {
      test.isUndefined(err);
      test.length(res, 1);

      const user = res[0];
      test.equal(user._id, Meteor.userId());
      test.equal(user.status.online, true);
      test.equal(user.status.idle, true);
      test.isTrue(user.status.lastLogin != null);
      // This will be approximate
      test.isTrue(Math.abs(user.status.lastActivity - idleTime) < timeTol);

      return next();
    });
  });
});

Tinytest.addAsync('status - active report with no timestamp', (test, next) => Meteor.call('user-status-active', undefined, (err) => {
  test.isUndefined(err);

  return Meteor.call('grabStatus', function (err, res) {
    test.isUndefined(err);
    test.length(res, 1);

    const user = res[0];
    test.equal(user._id, Meteor.userId());
    test.equal(user.status.online, true);
    test.isTrue(user.status.lastLogin != null);

    test.equal(user.status.idle, false);
    test.isFalse(user.status.lastActivity != null);

    return next();
  });
}));

Tinytest.addAsync('status - logout', (test, next) => Meteor.logout((err) => {
  test.isUndefined(err);
  return next();
}));

Tinytest.addAsync('status - offline recorded on server', (test, next) => Meteor.call('grabStatus', function (err, res) {
  test.isUndefined(err);
  test.length(res, 1);

  const user = res[0];
  test.isTrue(user._id != null);
  test.equal(user.status.online, false);
  // logintime is still maintained
  test.isTrue(user.status.lastLogin != null);

  test.isFalse(user.status.idle != null);
  test.isFalse(user.status.lastActivity != null);

  return next();
}));

Tinytest.addAsync('status - session userId deleted on server', (test, next) => Meteor.call('grabSessions', function (err, res) {
  test.isUndefined(err);
  test.length(res, 1);

  const doc = res[0];
  test.isFalse(doc.userId != null);
  test.isTrue(doc.ipAddr != null);
  test.isFalse(doc.loginTime != null);

  test.isFalse(doc.idle); // === false
  test.isFalse(doc.lastActivity != null);

  return next();
}));
