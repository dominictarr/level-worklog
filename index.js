'use-strict';

var pull = require('pull-stream')
var pl   = require('pull-level')
var timestamp = require('monotonic-timestamp')

function isString (s) {
  return 'string' === typeof s
}

module.exports = function (db, logDb) {

  if(isString(logDb)) logDb = db.sublevel(logDb)

  var doneDb = logDb.sublevel('done')

  db.pre(function (op, add) {
    add({
      key: timestamp(), value: op.key,
      //TODO: set the value encoding to be the
      //db's keyEncoding
      type: 'put', prefix: logDb
    })
  })

  var workers = {}

  db.job = function (name, work) {
    workers[name] = work
    recover(name)
    return db
  }

  //rebuild the index for every value.
  function rebuild (name) {
    ready(function () {
      doneDb.put(name, 0, function () {
        recover(name)
      })
    })
  }

  var todo = 0
  var done = 0

  function ready(cb) {
    if(db.isOpen()) cb()
    else db.on('open', function () {
      //level emits the events before the callbacks,
      //which creates some race conditions in databases
      //that havn't opened yet.
      setTimeout(cb)
    })
  }

  function recover (name) {
    ready(function () {
      doneDb.get(name, function (err, timestamp) {
        pull(
          pl.read(logDb, {start: timestamp | 0, tail: true}),
          pull.through(function (d) {
            todo++
          }),
          //read ahead, so that we knowm when there are queued jobs.
          pull.highWaterMark(2),
          pull.asyncMap(function (data, cb) {
            workers[name](data.value, function (err) {
              if(err) return cb(err)
              doneDb.put(name, data.key, function () {
                if(todo === ++done)
                  db.emit('drain', done)
                cb()
              })
            })
          }),
          pull.drain(null, function (err) {
            if(err) return db.emit('error', err)
            db.emit('drain', done)
          })
        )
      })
    })
  }

  for(var k in workers) recover(k)

  db.rebuild = rebuild

  db.rebuildAll = function () {
    for(var k in workers) rebuild(k)
  }

  return db
}

