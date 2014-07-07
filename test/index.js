
var tape = require('tape')
var level = require('level-test')()
var trigger = require('../')
var sublevel = require('level-sublevel')

tape('simple', function (t) {

  var db = sublevel(level('trigger2-test', {encoding: 'json'}))
  var count = db.sublevel('count')
  trigger(db, 'trig')

  db.job('inc', function (data, cb) {
    count.get('count', function (err, value) {
      count.put('count', (value || 0) + 1, cb)
    })
  })

  db.on('drain', function (err) {
    count.get('count', function (err, value) {
      t.equal(value, 2)
      t.end()
    })
  })

  db.put('foo', 'bar', function () {
    db.put('bar', 'baz', function () {})
  })

})

tape('simple2', function (t) {

  var db = sublevel(level('trigger2-test2', {encoding: 'json'}))
  var count = db.sublevel('count')
  trigger(db, 'trig')

  db.job('inc', function (data, cb) {
    count.get('count', function (err, value) {
      count.put('count', (value || 0) + 1, cb)
    })
  })

  db.on('drain', function (err) {
    count.get('count', function (err, value) {
      t.equal(value, 20)
      t.end()
    })
  })

  db.on('open', function () {
    var i = 20
    while(--i)
      db.put('#' + Math.random(), 'bar', function () {})

  })
})

