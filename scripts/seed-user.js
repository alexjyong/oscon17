#!/usr/bin/env node
/**
 * seed-user.js — Create a user account in MongoDB
 *
 * Usage:
 *   node scripts/seed-user.js <email> <password> [displayName]
 *
 * Environment:
 *   MONGO_HOST — MongoDB host (default: localhost)
 *
 * Example:
 *   MONGO_HOST=localhost node scripts/seed-user.js admin@example.com mypassword "Admin User"
 */

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const email = process.argv[2]
const password = process.argv[3]
const displayName = process.argv[4] || email.split('@')[0]

if (!email || !password) {
  console.error('Usage: node scripts/seed-user.js <email> <password> [displayName]')
  process.exit(1)
}

const mongoHost = process.env.MONGO_HOST || 'localhost'
const dbName = 'oscon-test'

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  displayName: { type: String }
})
const User = mongoose.model('User', userSchema)

mongoose.connect('mongodb://' + mongoHost + '/' + dbName)
  .then(async function() {
    const passwordHash = await bcrypt.hash(password, 12)
    const user = new User({ email, passwordHash, displayName })
    await user.save()
    console.log('User created:', email)
    process.exit(0)
  })
  .catch(function(err) {
    if (err.code === 11000) {
      console.error('Error: email already registered:', email)
    } else {
      console.error('Error:', err.message)
    }
    process.exit(1)
  })
