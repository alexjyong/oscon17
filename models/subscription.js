import mongoose from 'mongoose'

var subscriptionSchema = new mongoose.Schema({
  endpoint: {
    type: String,
    required: true,
    unique: true
  },
  keys: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  tags: {
    type: [String],
    default: []
  },
  source: {
    type: String
  }
});

subscriptionSchema.index({ endpoint: 1 }, { unique: true });

export default mongoose.model('Subscription', subscriptionSchema);
