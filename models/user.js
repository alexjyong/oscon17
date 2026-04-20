import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

var userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  displayName: {
    type: String
  }
});

userSchema.index({ email: 1 }, { unique: true });

// Hash password before saving
userSchema.pre('save', async function() {
  if (this._password) {
    this.passwordHash = await bcrypt.hash(this._password, 12)
    this._password = undefined
  }
  if (!this.displayName) {
    this.displayName = this.email.split('@')[0]
  }
});

// Virtual setter for plain-text password
userSchema.virtual('password').set(function(val) {
  this._password = val
});

// Compare a plaintext password against the stored hash
userSchema.methods.validatePassword = function(plaintext) {
  return bcrypt.compare(plaintext, this.passwordHash)
};

export default mongoose.model('User', userSchema);
