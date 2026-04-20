import passport from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import UserModel from '../models/user'

passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async function(email, password, done) {
    try {
      const user = await UserModel.findOne({ email: email.toLowerCase() })
      if (!user) {
        return done(null, false, { message: 'Invalid email or password' })
      }
      const valid = await user.validatePassword(password)
      if (!valid) {
        return done(null, false, { message: 'Invalid email or password' })
      }
      return done(null, user)
    } catch (err) {
      return done(err)
    }
  }
));

passport.serializeUser(function(user, done) {
  done(null, user._id)
});

passport.deserializeUser(async function(id, done) {
  try {
    const user = await UserModel.findById(id)
    done(null, user)
  } catch (err) {
    done(err)
  }
});

export default passport
