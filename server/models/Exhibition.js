const mongoose = require('mongoose');

const ExhibitionSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  theme: {
    type: String,
    trim: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  director: {
    type: String,
    trim: true
  },
  status: { 
    type: String, 
    enum: ['planning', 'preparation', 'active', 'completed'], 
    default: 'planning' 
  },
  concept: {
    type: String,
    default: ''
  },
  businessProgram: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: 'Выставочный павильон Технопарк'
  },
  image: { 
    type: String,
    default: ''
  },
  images: { 
    type: [String],
    default: []
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

ExhibitionSchema.virtual('isActive').get(function() {
  const now = new Date();
  return this.startDate <= now && this.endDate >= now;
});

ExhibitionSchema.set('toJSON', { virtuals: true });
ExhibitionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Exhibition', ExhibitionSchema);