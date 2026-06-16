import express from 'express'
import path from 'path'
import morgan from 'morgan'
import graphql from 'graphql'
import graphqlHTTP from 'express-graphql'
import mongoose from 'mongoose'
import cors from 'cors'
import fs from 'fs'
import compression from 'compression'

import http from 'http'
import https from 'https'
import bodyParser from 'body-parser'

import session from 'express-session'
import connectMongo from 'connect-mongo'
const MongoStore = connectMongo(session)

// Our custom schema
import mySchema from './graphql'
// Set server-side routes
import configRoutes, { initSubscriptionsCache } from './js/server-routes'
import SubscriptionModel from './models/subscription'
import passport from './js/auth'

const dbName = 'oscon-test'

const tlsKeyPath = process.env.TLS_KEY_PATH || '/home/brianc/CERTS/scene-history_org.key'
const tlsCertPath = process.env.TLS_CERT_PATH || '/home/brianc/CERTS/www_scene-history_org_combined.crt'
const privateKey = fs.readFileSync(tlsKeyPath);
const certificate = fs.readFileSync(tlsCertPath);
const credentials = {key: privateKey, cert: certificate};

const app = express(),
  router = express.Router()

// Comment this out to quell logging
// app.use(morgan('combined'))

// No non-SSL service in this configuration
// server = http.createServer( app ),

// Redirect all HTTP requests to secure site version

http.createServer(function (req, res) {
  res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
  res.end();
  }).listen(80);

// Note that at present this only works for www.scene-history_org
const sserver = https.createServer( credentials, app )

// CORS allows us to fetch images on local-hosted server
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['https://www.scene-history.org']

app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}))

// Compress outbound service
app.use(compression())

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const mongoUrl = 'mongodb://' + (process.env.MONGO_HOST || 'localhost') + '/' + dbName
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({ url: mongoUrl })
}))
app.use(passport.initialize())
app.use(passport.session())

// GraphqQL server route
// This "route" is special API call to GraphQL interface
app.use('/graphql' ,graphqlHTTP({
  schema: mySchema,
  graphiql: true
}));

// Generic routers
configRoutes(router, sserver)
app.use('/', router)

// Set up path
app.use(express.static(path.join(__dirname, '/public')))

// Configure mongoose as per http://mongoosejs.com/docs/promises.html
// Use native promises
mongoose.Promise = global.Promise;
// assert.equal(query.exec().constructor, global.Promise);

// Connect to mongo database and warm subscription cache
const mongoHost = process.env.MONGO_HOST || 'localhost'
mongoose.connect('mongodb://' + mongoHost + '/' + dbName)
  .then(() => SubscriptionModel.find({}))
  .then(initSubscriptionsCache)
  .catch(err => console.log('Failed to load subscription cache:', err))

// Start HTTPS server
sserver.listen(443)
console.log(
  'Express server listening on port %d in %s mode',
  sserver.address().port, app.settings.env
)
