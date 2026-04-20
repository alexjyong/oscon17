/*
 * server-routes.js - module to provide server-side routing
*/

import sharp from 'sharp'
import multer from 'multer'
import cb from 'cb'
import webPush from 'web-push'
import SubscriptionModel from '../models/subscription'
import UserModel from '../models/user'
import passport from './auth'

// Set of possible notification classes
const notifyGroups = ["image", "news", "publish", "program", "meeting"]

// Multer handles MIME multi-part uploads
//   Configure it for this usage instance
// const multer = require('multer'),
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/')
    },
  // Add random suffix to avoid filename clashes
  filename: function (req, file, cb) {
    cb(null, file.originalname + '-' + Date.now())
    }
  })
// This function uses multer to handle the upload process
// Note: we still need to set the Dropzone knob for "only one file at a time"
const upload  =  multer( {storage: storage }).single('file')

// Module-wide variables
let savedSubscription = null,
  messageType = null,
  customMessage = null,
  subscriptions = []

function uploadFile(req, res) {
  return new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function sharpToFile(pipeline, outputPath) {
  return new Promise((resolve, reject) => {
    pipeline.toFile(outputPath, (err, info) => {
      if (err) reject(err)
      else resolve(info)
    })
  })
}

async function saveSubscriptionToDatabase(subscription, ipAddr, port) {
  // Persists to MongoDB and updates in-memory cache on success
  console.log('In save part of routine')
  let source = ipAddr + ':' + port
  // Cut syntactic ipv6 cruft from front of address
  source = source.slice(7)
  console.log('Source: ' + source)

  await SubscriptionModel.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    { ...subscription, source },
    { upsert: true, new: true }
  )

  // Update in-memory cache only after successful DB write
  subscriptions[source] = subscription

  for (let [source, subscription] of Object.entries(subscriptions)) {
    console.log("Entry: " + JSON.stringify(subscriptions[source]) + ' for ' + source)
  }
}

function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next()
  res.redirect('/login')
}

export function initSubscriptionsCache(docs) {
  docs.forEach(doc => {
    subscriptions[doc.source] = doc.toObject()
  })
}

export default function ( router, server ) {
  const options = {
    root: __dirname + '/../public'
   }

   // Home and view routes
  router.get('/', function(req, res) {
    res.sendFile('index.html', options)
  })

  // These repetitive routes need abstracting
  router.get('/home', function(req, res) {
    console.log('Server home chosen')
    res.sendFile('index.html', options)
  })

  router.get('/login', function(req, res) {
    res.sendFile('index.html', options)
  })

  router.get('/upload', requireAuth, function(req, res) {
    console.log('Server upload chosen')
    res.sendFile('index.html', options)
  })

  router.get('/browse', function(req, res) {
    console.log('Server browse chosen')
    res.sendFile('index.html', options)
  })

  router.get('/slides*', function(req, res) {
    console.log('Server slides chosen')
    res.sendFile('index.html', options)
  });

  router.get('/edit*', requireAuth, function(req, res) {
    console.log('Server edit chosen')
    res.sendFile('index.html', options)
  });

  router.get('/asset*', function(req, res) {
    console.log('Server asset chosen')
    res.sendFile('index.html', options)
  });

  router.get('/zoomer*', function(req, res) {
    console.log('Server zoomer chosen')
    res.sendFile('index.html', options)
  });

  router.get('/announce*', function(req, res) {
    console.log('Server announce chosen')
    res.sendFile('announce.html', options)
  });
  /* Not going to allow server loading until the async thing is figured out
  router.get('/subscribe', function(req, res) {
    console.log('Server notify chosen')
    res.sendFile('index.html', options)
  });
 */

  // Send a notification to one or more subscribed clients
  router.get(['/sknnzix', '/sknnzix/:msg', '/sknnzix/:type/:msg'], function(req, res) {

    messageType = req.params.type
    if (typeof messageType != 'undefined' && (!notifyGroups.includes(messageType))) {
      // console.log('Illegal type detected ' + messageType)
      messageType = 'illegal'
      }
    customMessage = req.params.msg
    // Let the debuggers know what's going on under the hood
    console.log('Sending notifications with ' + customMessage + ' and ' + messageType)
    console.log(' to ' + Object.keys(subscriptions).length + ' subscribers')
    // res.sendFile('index.html', options)
    sendNotifications(customMessage);
    res.sendStatus(200);
  });

  // Auth routes
  router.post('/login', function(req, res, next) {
    if (!req.body || !req.body.email || !req.body.password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }
    passport.authenticate('local', function(err, user, info) {
      if (err) return next(err)
      if (!user) return res.status(401).json({ error: info ? info.message : 'Invalid email or password' })
      req.logIn(user, function(err) {
        if (err) return next(err)
        return res.json({ user: { email: user.email, displayName: user.displayName } })
      })
    })(req, res, next)
  })

  router.post('/logout', function(req, res) {
    req.logout(function() {
      req.session.destroy(function() {
        res.json({ success: true })
      })
    })
  })

  router.get('/api/me', function(req, res) {
    if (req.isAuthenticated()) {
      return res.json({ user: { email: req.user.email, displayName: req.user.displayName } })
    }
    res.json({ user: null })
  })

  router.post('/register', async function(req, res) {
    if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (!req.body || !req.body.email || !req.body.password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }
    try {
      const user = new UserModel({
        email: req.body.email,
        displayName: req.body.displayName
      })
      user.password = req.body.password
      await user.save()
      res.status(201).json({ success: true, email: user.email })
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'Email already registered' })
      }
      throw err
    }
  })

  // Post route to accept demo push subscription
  router.post('/save-subscription/', async function (req, res) {
    if (!req.body || !req.body.endpoint) {
      res.status(400);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({
        error: {
          id: 'no-endpoint',
          message: 'Subscription must have an endpoint.'
        }
      }));
      return;
    }

    try {
      await saveSubscriptionToDatabase(req.body, req.ip, req.connection.remotePort)
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ data: { success: true } }));
    } catch (err) {
      res.status(500);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({
        error: {
          id: 'unable-to-save-subscription',
          message: 'The subscription was received but we were unable to save it to our database.'
        }
      }));
    }
  })

  // Fetch uploaded file handled by "storage" object in multer
  // Process resulting files for later viewing
  router.post('/uploadHandler', async function(req, res) {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    try {
      await uploadFile(req, res)
    } catch (err) {
      return res.end('Error uploading file')
    }

    const storedFilename = req.file.filename,
      filePath = './uploads/' + storedFilename,
      dziBase = './public/tiles/' + storedFilename

    try {
      await Promise.all([
        sharpToFile(sharp(filePath).resize(200).jpeg(),
          './public/thumbs/' + storedFilename + '-thumb'),
        sharpToFile(sharp(filePath).resize(1000).png(),
          './public/images/' + storedFilename + '-1k'),
        sharpToFile(sharp(filePath).tile(256), dziBase)
      ])
    } catch (err) {
      console.log('Image processing error:', err)
    }

    res.send(JSON.stringify(storedFilename))
  })
  // Service routines for push notifications
  function sendNotifications(customMessage) {

    // Iterate through current list of subscriptions
    for (let [source, subscription] of Object.entries(subscriptions)) {
      // console.log("Entry: " + JSON.stringify(subscriptions[source]) + ' for ' + source)

      // Put together (stringified) notiication object

      // First the generic response if no tag/message chosen
      let payload = '{"text": "Generic server message", "url": ""}'

      // If there is a message, then put tag and message into string JSON object
      if (typeof customMessage !== 'undefined') {
         payload = '{"text": "' + customMessage + '", "url": "announce?topic=' + messageType + '"}'
        }

      // Code to send notify; remove item if subscription isn't valid
        if (subscription.tags.includes(messageType) || messageType == null) {
        console.log('Push payload: ' + payload)
        const pushOptions = {
          vapidDetails: {
            subject: process.env.VAPID_SUBJECT || 'mailto:brianc@palaver.net',
            publicKey: process.env.VAPID_PUBLIC_KEY || 'BJZhZZUqIwbwbGci_pheC3wTwNFcF5btmH7JPCFCF22gk7iJaXmrLznrtBQI_C_HtWZh9BFnwCVKfz7oVgTmaPA',
            privateKey: process.env.VAPID_PRIVATE_KEY
          },
        }

        webPush.sendNotification(
          subscription,
          payload,
          pushOptions
        )
        // Remove item from array if message server rejects
        .catch((err) => {
          if (err.statusCode === 410) {
            console.log('Removing bad subscription from array')
            delete subscriptions[source]
          } else {
            console.log('Subscription is no longer valid: ', err);
            delete subscriptions[source]
          }
        })
      }
    }
  }
}
