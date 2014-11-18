'use strict';

var rewire = require('rewire');
var img = rewire('../lib/image.js');
var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var path = require('path');
var sinon = require('sinon');
var FakeDocker = require('./fakeDocker.js');
var FakeStream = require('./fakeStream.js');

describe('image', function() {

  var mockImage = {
      name: 'myimagename',
      src: '/my/path/1/'
    };
  var fakeDocker = new FakeDocker();
  var sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
    fakeDocker.restore();
  });

  img.__set__('docker', fakeDocker);

  describe('#pull()', function() {

    it('Should call Docker.pull with the correct args.', function() {
      // setup stubs
      var spyPull = sandbox.spy(fakeDocker, 'pull');
      var spyOn = sandbox.spy(fakeDocker.getStream(), 'on');

      // run unit being tested
      img.pull(mockImage, function() {});

      // verify
      sinon.assert.calledWithExactly(spyPull, 'myimagename', sinon.match.func);
      sinon.assert.callCount(spyPull, 1);

      sinon.assert.calledWithExactly(spyOn, 'data', sinon.match.func);
      sinon.assert.calledWithExactly(spyOn, 'end', sinon.match.func);
      sinon.assert.callCount(spyOn, 2);
    });

    it('Should throw an error when Docker.pull returns an error.', function() {
      // setup stubs
      var spy = sandbox.spy(fakeDocker, 'pull');
      fakeDocker.setPullError(new Error('Test Error!'));
      // run unit being tested
      var fn = function() {
        img.pull(mockImage, function() {});
      };
      // verify
      expect(fn).to.throw('Test Error!');
    });

    it('should complete after stream.on(end) is called.', function(done) {
      // setup stubs
      var spyPull = sandbox.spy(fakeDocker, 'pull');
      fakeDocker.setPullHook(function() {
        fakeDocker.getStream().end();
      });
      var spyOn = sandbox.spy(fakeDocker.getStream(), 'on');
      // run unit being testing
      img.pull(mockImage, function(err, data) {
        // verify
        expect(err).to.equal(null);
        expect(data).to.equal(undefined);
        sinon.assert.callCount(spyOn, 2);
        sinon.assert.calledWithExactly(spyOn, 'data', sinon.match.func);
        sinon.assert.calledWithExactly(spyOn, 'end', sinon.match.func);
        done();
      });
    });

    it('should throw an error when dockerode streams back an error.', function() {
      // setup stubs
      //var onData;
      var spyPull = sandbox.spy(fakeDocker, 'pull');
      fakeDocker.setPullHook(function(stream) {
        stream.data('{"errorDetail":{"message":"elvis lives!"}}');
        stream.end();
      });
      var spyOn = sandbox.spy(fakeDocker.getStream(), 'on');
      // run unit being tested
      var fn = function() {
        img.pull(mockImage, function() {});
      };
      // verify
      expect(fn).to.throw(Error, /elvis lives/);
    });

    it('should not throw an error when dockerode stream returns partial data.', function(done) {
      // setup spys
      var spyPull = sandbox.spy(fakeDocker, 'pull');
      fakeDocker.setPullHook(function(stream) {
        stream.data('{"errorDetail":{"message":"incomplete json -->"');
        stream.end();
      });
      var spy = sandbox.spy();
      img.pull(mockImage, spy);
      sinon.assert.callCount(spy, 1);
      sinon.assert.calledWithExactly(spy, null, undefined);
      sinon.assert.callCount(spyPull, 1);
      sinon.assert.calledWithExactly(spyPull, 'myimagename', sinon.match.func);
      done();
    });

  });

  describe('#build()', function() {

    it('Should call Docker.buildImage with the correct args.', function() {
      // mocks
      var mockPath = {
          resolve: function() {}
        };
      var mockProcess = {
          chdir: function() {}
        };
      var mockFs = {
          createReadStream: function() {}
        };

      // setup
      var spyBuildImage = sandbox.spy(fakeDocker, 'buildImage');
      var stubResolve = sandbox.stub(mockPath, 'resolve', path.join);
      var stubChdir = sandbox.stub(mockProcess, 'chdir');
      var stubFs = sandbox.stub(mockFs, 'createReadStream');
      var spyOn = sandbox.spy(fakeDocker.getStream(), 'on');

      // setup injected mocks
      img.__set__('path', mockPath);
      img.__set__('process', mockProcess);
      img.__set__('fs', mockFs);
      img.__set__('exec', function(cmd, cb) {
        cb(null, null, null);
      });

      // run unit being tested
      img.build(mockImage, function(err, data) {
        expect(err).to.equal(null);
        expect(data).to.equal(undefined);
      });

      // verify
      sinon.assert.calledWithExactly(stubResolve, '/my/path/1/', 'archive.tar');
      sinon.assert.callCount(stubResolve, 1);

      sinon.assert.calledWithExactly(stubChdir, '/my/path/1/');
      sinon.assert.callCount(stubChdir, 1);

      sinon.assert.calledWithExactly(stubFs, '/my/path/1/archive.tar');
      sinon.assert.callCount(stubFs, 1);

      sinon.assert.calledWithExactly(spyBuildImage,
        sinon.match.undefined, {
          t: 'myimagename'
        },
        sinon.match.func
      );
      sinon.assert.callCount(spyBuildImage, 1);

      sinon.assert.calledWithExactly(spyOn, 'data', sinon.match.func);
      sinon.assert.calledWithExactly(spyOn, 'end', sinon.match.func);
      sinon.assert.callCount(spyOn, 2);
    });

  });

});
